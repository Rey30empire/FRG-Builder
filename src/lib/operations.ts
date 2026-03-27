import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logActivity } from "@/lib/activity-log";
import { serializeMaintenanceRun, serializeOpsIncident, serializeSupportTicket } from "@/lib/api-serializers";
import { db } from "@/lib/db";
import { getSystemHealth } from "@/lib/health";
import { stringifyJson } from "@/lib/json";

const execFileAsync = promisify(execFile);

export type MaintenanceAction =
  | "backup-local"
  | "cleanup-storage"
  | "health-scan"
  | "follow-up-audit";

export type MaintenanceTrigger = "manual" | "cron";

function getMaintenanceCommand(action: MaintenanceAction) {
  if (action === "backup-local") {
    return ["scripts/backup-local-data.mjs"];
  }

  if (action === "cleanup-storage") {
    return ["scripts/cleanup-local-storage.mjs"];
  }

  return null;
}

async function runFollowUpAudit() {
  const now = new Date();
  const staleDate = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);

  const [overdueLeads, sentEstimatesNeedingFollowUp] = await Promise.all([
    db.lead.findMany({
      where: {
        status: {
          not: "closed",
        },
        nextFollowUp: {
          lte: now,
        },
      },
      orderBy: {
        nextFollowUp: "asc",
      },
      take: 20,
    }),
    db.estimate.findMany({
      where: {
        status: "sent",
        sentAt: {
          lte: staleDate,
        },
        viewedAt: null,
      },
      include: {
        project: true,
      },
      orderBy: {
        sentAt: "asc",
      },
      take: 20,
    }),
  ]);

  return {
    overdueLeadCount: overdueLeads.length,
    staleProposalCount: sentEstimatesNeedingFollowUp.length,
    overdueLeadIds: overdueLeads.map((lead) => lead.id),
    staleEstimateIds: sentEstimatesNeedingFollowUp.map((estimate) => estimate.id),
    summary: `Found ${overdueLeads.length} overdue lead follow-ups and ${sentEstimatesNeedingFollowUp.length} stale sent proposals.`,
  };
}

async function createMaintenanceFailureIncident(action: MaintenanceAction, message: string) {
  return db.opsIncident.create({
    data: {
      title: `Maintenance failure: ${action}`,
      summary: message,
      severity: "critical",
      status: "open",
      source: "maintenance",
      affectedService: action,
      details: stringifyJson({
        action,
        message,
      }),
    },
  });
}

export async function runMaintenanceTask(input: {
  action: MaintenanceAction;
  trigger: MaintenanceTrigger;
  actorId?: string | null;
}) {
  const startedAt = new Date();

  try {
    let result: Record<string, unknown>;

    if (input.action === "health-scan") {
      const health = await getSystemHealth();
      result = {
        summary: `Health scan completed with status ${health.status}.`,
        details: health,
      };
    } else if (input.action === "follow-up-audit") {
      const audit = await runFollowUpAudit();
      result = {
        summary: audit.summary,
        details: audit,
      };
    } else {
      const command = getMaintenanceCommand(input.action);

      if (!command) {
        throw new Error("Unsupported maintenance action.");
      }

      const output = await execFileAsync(process.execPath, command, {
        cwd: process.cwd(),
      });

      result = {
        summary: `${input.action} completed successfully.`,
        details: {
          stdout: output.stdout.trim(),
          stderr: output.stderr.trim(),
        },
      };
    }

    const finishedAt = new Date();
    const run = await db.maintenanceRun.create({
      data: {
        action: input.action,
        trigger: input.trigger,
        status: "completed",
        summary: result.summary as string,
        details: stringifyJson(result.details),
        startedAt,
        finishedAt,
      },
    });

    await logActivity({
      userId: input.actorId || null,
      action: "run",
      entity: "maintenance",
      entityId: run.id,
      details: {
        maintenanceAction: input.action,
        trigger: input.trigger,
      },
      tool: "ops-maintenance",
    });

    return serializeMaintenanceRun(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Maintenance task failed";
    const finishedAt = new Date();

    const run = await db.maintenanceRun.create({
      data: {
        action: input.action,
        trigger: input.trigger,
        status: "failed",
        summary: message,
        details: stringifyJson({
          error: message,
        }),
        startedAt,
        finishedAt,
      },
    });

    await createMaintenanceFailureIncident(input.action, message);
    await logActivity({
      userId: input.actorId || null,
      action: "error",
      entity: "maintenance",
      entityId: run.id,
      details: {
        maintenanceAction: input.action,
        trigger: input.trigger,
        error: message,
      },
      tool: "ops-maintenance",
    });

    throw error;
  }
}

export async function buildOperationsOverview() {
  const now = new Date();
  const staleDate = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
  const health = await getSystemHealth();

  const [
    openTickets,
    openIncidents,
    latestMaintenance,
    overdueFollowUps,
    staleProposals,
  ] = await Promise.all([
    db.supportTicket.findMany({
      where: {
        status: {
          not: "resolved",
        },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    db.opsIncident.findMany({
      where: {
        status: {
          not: "resolved",
        },
      },
      orderBy: [{ severity: "desc" }, { startedAt: "desc" }],
      take: 10,
    }),
    db.maintenanceRun.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
    db.lead.count({
      where: {
        status: {
          not: "closed",
        },
        nextFollowUp: {
          lte: now,
        },
      },
    }),
    db.estimate.count({
      where: {
        status: "sent",
        sentAt: {
          lte: staleDate,
        },
        viewedAt: null,
      },
    }),
  ]);

  const latestRun = latestMaintenance[0];
  const alerts = [
    health.status === "critical" ? "System health is critical." : null,
    openIncidents.some((incident) => incident.severity === "critical")
      ? "There is at least one critical active incident."
      : null,
    overdueFollowUps > 0 ? `${overdueFollowUps} lead follow-ups are overdue.` : null,
    staleProposals > 0 ? `${staleProposals} sent proposals have not been viewed in 72h.` : null,
    openTickets.length > 5 ? `${openTickets.length} support tickets are still open.` : null,
    latestRun?.status === "failed" ? "The latest maintenance run failed." : null,
  ].filter(Boolean) as string[];

  return {
    health,
    stats: {
      openTickets: openTickets.length,
      openIncidents: openIncidents.length,
      overdueFollowUps,
      staleProposals,
      maintenanceRuns: latestMaintenance.length,
    },
    latestMaintenance: latestMaintenance.map((run) => serializeMaintenanceRun(run)),
    openIncidents: openIncidents.map((incident) => serializeOpsIncident(incident)),
    openTickets: openTickets.map((ticket) => serializeSupportTicket(ticket)),
    alerts,
  };
}

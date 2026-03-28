import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadAiSettingsResponse } from "@/lib/ai-settings";
import { db, getConfiguredDatabaseUrl } from "@/lib/db";
import { parseJsonField } from "@/lib/json";
import { buildOperationsOverview } from "@/lib/operations";
import { getCapabilitiesForLevel } from "@/lib/permissions";
import type { PermissionLevel } from "@/types";

function getDatabaseSummary() {
  const databaseUrl = getConfiguredDatabaseUrl();

  if (databaseUrl.startsWith("postgres")) {
    return { kind: "postgres", label: "Postgres", status: "healthy" as const };
  }

  if (databaseUrl.startsWith("file:")) {
    return { kind: "sqlite", label: "SQLite", status: "warning" as const };
  }

  return { kind: "unknown", label: "Unknown", status: "critical" as const };
}

function getStorageSummary() {
  const driver = process.env.STORAGE_DRIVER || "local";
  return {
    driver,
    label: driver === "s3" ? "Durable object storage" : "Local filesystem storage",
    status: driver === "s3" ? ("healthy" as const) : ("warning" as const),
  };
}

function getEmailSummary() {
  const provider = process.env.EMAIL_PROVIDER || "log";
  return {
    provider,
    from: process.env.EMAIL_FROM || "FRG Builder <noreply@frg.local>",
    replyTo: process.env.EMAIL_REPLY_TO || null,
    status: provider === "log" ? ("warning" as const) : ("healthy" as const),
  };
}

async function getLatestLocalBackup() {
  const backupRoot = path.join(process.cwd(), "backups", "local");
  if (!existsSync(backupRoot)) {
    return null;
  }

  const entries = await readdir(backupRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const latest = directories[0];
  if (!latest) {
    return null;
  }

  const manifestPath = path.join(backupRoot, latest, "manifest.json");
  const manifest = existsSync(manifestPath)
    ? parseJsonField<Record<string, unknown> | null>(
        await readFile(manifestPath, "utf8"),
        null
      )
    : null;

  return {
    id: latest,
    path: path.join(backupRoot, latest),
    createdAt:
      typeof manifest?.createdAt === "string" ? manifest.createdAt : latest.replace(/-/g, ":"),
    uploadsIncluded: Boolean(manifest?.uploadsIncluded),
  };
}

export async function buildAdminOverview() {
  const [
    userCount,
    projectCount,
    documentCount,
    estimateCount,
    leadCount,
    campaignCount,
    emailCount,
    conversationCount,
    activityCount,
    skills,
    tools,
    users,
    companyMemory,
    logs,
    aiProviderStatus,
    latestBackup,
    opsOverview,
  ] = await Promise.all([
    db.user.count(),
    db.project.count(),
    db.document.count(),
    db.estimate.count(),
    db.lead.count(),
    db.campaign.count(),
    db.email.count(),
    db.conversation.count(),
    db.activityLog.count(),
    db.skill.findMany({ orderBy: [{ module: "asc" }, { displayName: "asc" }] }),
    db.tool.findMany({ orderBy: [{ requiredLevel: "asc" }, { displayName: "asc" }] }),
    db.user.findMany({
      include: {
        userMemory: true,
        _count: {
          select: {
            projects: true,
            learningItems: true,
            leads: true,
            campaigns: true,
            conversations: true,
          },
        },
      },
      orderBy: [{ level: "desc" }, { name: "asc" }],
    }),
    db.companyMemory.findFirst({ orderBy: { updatedAt: "desc" } }),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    loadAiSettingsResponse(),
    getLatestLocalBackup(),
    buildOperationsOverview(),
  ]);

  const userMap = new Map(users.map((user) => [user.id, user]));
  const database = getDatabaseSummary();
  const storage = getStorageSummary();
  const email = getEmailSummary();
  const permissionSummary = ([0, 1, 2, 3, 4] as PermissionLevel[]).map((level) => ({
    level,
    count: users.filter((user) => user.level === level).length,
    capabilities: getCapabilitiesForLevel(level),
  }));

  const alerts = [
    database.kind === "sqlite" ? "DATABASE_URL still points to SQLite." : null,
    storage.driver !== "s3" ? "STORAGE_DRIVER is still local." : null,
    email.provider === "log" ? "EMAIL_PROVIDER is still log; outbound email is not live." : null,
    !process.env.STRIPE_SECRET_KEY ? "Stripe monetization is not configured yet." : null,
    !latestBackup ? "No local backup snapshot detected yet." : null,
    ...opsOverview.alerts,
  ].filter(Boolean) as string[];

  return {
    metrics: [
      { id: "users", label: "Users", value: userCount, status: "healthy" },
      { id: "projects", label: "Projects", value: projectCount, status: "healthy" },
      { id: "documents", label: "Documents", value: documentCount, status: "healthy" },
      { id: "estimates", label: "Estimates", value: estimateCount, status: "healthy" },
      { id: "crm", label: "Leads", value: leadCount, status: "healthy" },
      { id: "activity", label: "Activity Events", value: activityCount, status: "healthy" },
      {
        id: "support",
        label: "Open Tickets",
        value: opsOverview.stats.openTickets,
        status: opsOverview.stats.openTickets > 0 ? "warning" : "healthy",
      },
      {
        id: "incidents",
        label: "Open Incidents",
        value: opsOverview.stats.openIncidents,
        status: opsOverview.stats.openIncidents > 0 ? "critical" : "healthy",
      },
    ],
    health: [
      { id: "database", label: "Database", value: database.label, status: database.status },
      { id: "storage", label: "Storage", value: storage.label, status: storage.status },
      { id: "email", label: "Email", value: email.provider, status: email.status },
      {
        id: "ai",
        label: "AI",
        value: aiProviderStatus.active
          ? aiProviderStatus.providers[aiProviderStatus.active].label
          : "No active provider",
        status: aiProviderStatus.active ? "healthy" : "warning",
      },
      {
        id: "backup",
        label: "Backups",
        value: latestBackup ? "Snapshot available" : "No backup yet",
        status: latestBackup ? "healthy" : "warning",
      },
      {
        id: "ops",
        label: "Operations",
        value:
          opsOverview.health.status === "healthy"
            ? "Ops healthy"
            : opsOverview.health.status === "warning"
              ? "Ops warning"
              : "Ops critical",
        status: opsOverview.health.status,
      },
    ],
    skills: skills.map((skill) => ({
      ...skill,
      config: parseJsonField(skill.config, null),
    })),
    tools,
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      level: user.level,
      userMemory: user.userMemory,
      stats: user._count,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
    logs: logs.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: parseJsonField(entry.details, null),
      skill: entry.skill,
      tool: entry.tool,
      userId: entry.userId,
      userName: entry.userId ? userMap.get(entry.userId)?.name || null : null,
      userEmail: entry.userId ? userMap.get(entry.userId)?.email || null : null,
    })),
    settings: {
      nodeEnv: process.env.NODE_ENV || "development",
      database,
      storage,
      email,
      aiProviders: aiProviderStatus,
      latestBackup,
    },
    company: companyMemory
      ? {
          ...companyMemory,
          specialties: parseJsonField(companyMemory.specialties, []),
          workZones: parseJsonField(companyMemory.workZones, []),
          crewInfo: parseJsonField(companyMemory.crewInfo, {}),
          baseRates: parseJsonField(companyMemory.baseRates, {}),
          aiProviderConfig: parseJsonField(companyMemory.aiProviderConfig, null),
        }
      : null,
    permissionSummary,
    counts: {
      campaigns: campaignCount,
      emails: emailCount,
      conversations: conversationCount,
      supportTickets: opsOverview.stats.openTickets,
      incidents: opsOverview.stats.openIncidents,
      maintenanceRuns: opsOverview.stats.maintenanceRuns,
    },
    alerts,
  };
}

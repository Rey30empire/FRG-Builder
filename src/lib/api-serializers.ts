import { parseJsonField } from "@/lib/json";
import { normalizeAiSettings } from "@/lib/ai-settings";
import { serializeCustomAgent } from "@/lib/custom-agents";
import { normalizeAgentWorkspaceConfig } from "@/lib/user-workspace";

export function serializeDocument<T extends Record<string, unknown>>(document: T) {
  return {
    ...document,
    analysisResult: parseJsonField(document.analysisResult, null),
  };
}

export function serializeEmail<T extends Record<string, unknown>>(email: T) {
  return {
    ...email,
    metadata: parseJsonField(email.metadata, null),
  };
}

export function serializeEstimate<T extends Record<string, unknown>>(estimate: T) {
  const takeoffItems = Array.isArray(estimate.takeoffItems) ? estimate.takeoffItems : [];

  return {
    ...estimate,
    proposalData: parseJsonField(estimate.proposalData, null),
    regionalContext: parseJsonField(estimate.regionalContext, null),
    proposalDelivery:
      estimate.proposalDelivery && typeof estimate.proposalDelivery === "object"
        ? estimate.proposalDelivery
        : null,
    takeoffItems,
  };
}

export function serializeLead<T extends Record<string, unknown>>(lead: T) {
  return {
    ...lead,
    interactions: parseJsonField(lead.interactions, []),
    emails: Array.isArray(lead.emails)
      ? lead.emails.map((email) => serializeEmail(email as Record<string, unknown>))
      : [],
  };
}

export function serializeCampaign<T extends Record<string, unknown>>(campaign: T) {
  return {
    ...campaign,
    content: parseJsonField(campaign.content, null),
  };
}

export function serializeSupportTicket<T extends Record<string, unknown>>(ticket: T) {
  return {
    ...ticket,
    tags: parseJsonField(ticket.tags, []),
  };
}

export function serializeOpsIncident<T extends Record<string, unknown>>(incident: T) {
  return {
    ...incident,
    details: parseJsonField(incident.details, null),
  };
}

export function serializeMaintenanceRun<T extends Record<string, unknown>>(run: T) {
  return {
    ...run,
    details: parseJsonField(run.details, null),
  };
}

export function serializeLearningItem<T extends Record<string, unknown>>(item: T) {
  return {
    ...item,
    content: parseJsonField(item.content, null),
  };
}

export function serializeAgentRunStep<T extends Record<string, unknown>>(step: T) {
  return {
    ...step,
    details: parseJsonField(step.details, null),
  };
}

export function serializeAgentRun<T extends Record<string, unknown>>(run: T) {
  return {
    ...run,
    steps: Array.isArray(run.steps)
      ? run.steps.map((step) => serializeAgentRunStep(step as Record<string, unknown>))
      : [],
  };
}

export function serializeCustomAgentRecord<T extends Record<string, unknown>>(agent: T) {
  return serializeCustomAgent(agent);
}

export function serializeProject<T extends Record<string, unknown>>(project: T) {
  const documents = Array.isArray(project.documents)
    ? project.documents.map((document) => serializeDocument(document as Record<string, unknown>))
    : [];
  const estimates = Array.isArray(project.estimates)
    ? project.estimates.map((estimate) => serializeEstimate(estimate as Record<string, unknown>))
    : [];
  const emails = Array.isArray(project.emails)
    ? project.emails.map((email) => serializeEmail(email as Record<string, unknown>))
    : [];

  const projectMemory =
    project.projectMemory && typeof project.projectMemory === "object"
      ? {
          ...project.projectMemory,
          addendas: parseJsonField((project.projectMemory as Record<string, unknown>).addendas, []),
          versions: parseJsonField((project.projectMemory as Record<string, unknown>).versions, {}),
          exclusions: parseJsonField(
            (project.projectMemory as Record<string, unknown>).exclusions,
            []
          ),
        }
      : project.projectMemory;

  const bidOpportunity =
    project.bidOpportunity && typeof project.bidOpportunity === "object"
      ? serializeBidOpportunity(project.bidOpportunity as Record<string, unknown>)
      : project.bidOpportunity;

  return {
    ...project,
    documents,
    estimates,
    emails,
    projectMemory,
    bidOpportunity,
  };
}

export function serializeBidOpportunity<T extends Record<string, unknown>>(opportunity: T) {
  const project =
    opportunity.project && typeof opportunity.project === "object"
      ? (opportunity.project as Record<string, unknown>)
      : null;
  const linkedProject = project
    ? {
        id: String(project.id),
        name: String(project.name),
        status: String(project.status),
        address: typeof project.address === "string" ? project.address : undefined,
        client: typeof project.client === "string" ? project.client : undefined,
        updatedAt: project.updatedAt as string | Date,
        documentsCount:
          project._count && typeof project._count === "object"
            ? Number((project._count as Record<string, unknown>).documents || 0)
            : undefined,
        estimatesCount:
          project._count && typeof project._count === "object"
            ? Number((project._count as Record<string, unknown>).estimates || 0)
            : undefined,
      }
    : null;

  return {
    ...opportunity,
    bidFormData: parseJsonField(opportunity.bidFormData, null),
    submitPackage: parseJsonField(opportunity.submitPackage, null),
    project: undefined,
    linkedProject,
  };
}

export function serializeUser<T extends Record<string, unknown>>(user: T) {
  const { passwordHash: _passwordHash, sessions: _sessions, ...safeUser } = user as T & {
    passwordHash?: unknown;
    sessions?: unknown;
  };

  const userMemory =
    safeUser.userMemory && typeof safeUser.userMemory === "object"
      ? {
          ...safeUser.userMemory,
          laborRates: parseJsonField((safeUser.userMemory as Record<string, unknown>).laborRates, {}),
          aiProviderConfig: normalizeAiSettings(
            (safeUser.userMemory as Record<string, unknown>).aiProviderConfig
          ),
          agentWorkspaceConfig: normalizeAgentWorkspaceConfig(
            (safeUser.userMemory as Record<string, unknown>).agentWorkspaceConfig
          ),
          hasSmtpPassword: Boolean(
            (safeUser.userMemory as Record<string, unknown>).smtpPassword
          ),
          smtpPassword: undefined,
          topicsStudied: parseJsonField(
            (safeUser.userMemory as Record<string, unknown>).topicsStudied,
            []
          ),
          frequentErrors: parseJsonField(
            (safeUser.userMemory as Record<string, unknown>).frequentErrors,
            []
          ),
          progressByArea: parseJsonField(
            (safeUser.userMemory as Record<string, unknown>).progressByArea,
            {}
          ),
        }
      : safeUser.userMemory;

  return {
    ...safeUser,
    userMemory,
  };
}

import { parseJsonField } from "@/lib/json";

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

  return {
    ...project,
    documents,
    estimates,
    emails,
    projectMemory,
  };
}

export function serializeUser<T extends Record<string, unknown>>(user: T) {
  const userMemory =
    user.userMemory && typeof user.userMemory === "object"
      ? {
          ...user.userMemory,
          laborRates: parseJsonField((user.userMemory as Record<string, unknown>).laborRates, {}),
          topicsStudied: parseJsonField(
            (user.userMemory as Record<string, unknown>).topicsStudied,
            []
          ),
          frequentErrors: parseJsonField(
            (user.userMemory as Record<string, unknown>).frequentErrors,
            []
          ),
          progressByArea: parseJsonField(
            (user.userMemory as Record<string, unknown>).progressByArea,
            {}
          ),
        }
      : user.userMemory;

  return {
    ...user,
    userMemory,
  };
}

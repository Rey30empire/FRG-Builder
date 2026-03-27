import { db } from "@/lib/db";
import { parseJsonField, stringifyJson } from "@/lib/json";
import type {
  CustomAgent,
  CustomAgentExecutionMode,
  CustomAgentPipelineStage,
  PermissionLevel,
  SkillName,
  ToolName,
} from "@/types";

export const CUSTOM_AGENT_SKILL_OPTIONS: SkillName[] = [
  "estimate_skill",
  "takeoff_skill",
  "plan_reader_skill",
  "construction_teacher_skill",
  "code_reference_skill",
  "marketing_skill",
  "proposal_writer_skill",
  "email_outreach_skill",
  "crm_skill",
  "project_manager_skill",
  "document_skill",
  "image_analysis_skill",
  "local_model_skill",
];

export const CUSTOM_AGENT_TOOL_OPTIONS: ToolName[] = [
  "read_pdf",
  "extract_text",
  "separate_pages",
  "detect_scales",
  "analyze_image",
  "calculate_materials",
  "check_weather",
  "check_costs",
  "generate_proposal",
  "create_excel",
  "create_pdf",
  "save_memory",
  "search_history",
  "write_email",
  "generate_copy",
  "schedule_post",
  "read_folders",
  "export_reports",
  "compare_versions",
  "create_estimate_draft",
  "generate_follow_up",
  "summarize_documents",
  "explain_takeoff",
  "run_project_orchestrator",
];

export const CUSTOM_AGENT_EXECUTION_MODES: CustomAgentExecutionMode[] = [
  "chat",
  "pipeline",
  "both",
];

export const CUSTOM_AGENT_PIPELINE_STAGES: CustomAgentPipelineStage[] = [
  "preflight",
  "takeoff",
  "estimate",
  "delivery",
  "followup",
];

export const CUSTOM_AGENT_PIPELINE_STAGE_LABELS: Record<CustomAgentPipelineStage, string> = {
  preflight: "Preflight",
  takeoff: "Takeoff",
  estimate: "Estimate",
  delivery: "Delivery",
  followup: "Follow-up",
};

export const DEFAULT_CUSTOM_AGENT_DRAFT = {
  name: "",
  slug: "",
  description: "",
  instructions: "",
  baseSkill: "project_manager_skill",
  enabled: true,
  autoRun: false,
  includeProjectContext: true,
  includeDocumentSummary: true,
  includeEstimateSnapshot: true,
  executionMode: "chat",
  pipelineStage: "preflight",
  requiredLevel: 1,
  reviewRequired: true,
  allowedTools: ["summarize_documents"],
  triggerPhrases: [],
  successCriteria: "",
  outputSchema: "",
  sortOrder: 0,
} satisfies Omit<CustomAgent, "id" | "userId" | "createdAt" | "updatedAt">;

function clampPermissionLevel(value: unknown): PermissionLevel {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(4, Math.round(value))) as PermissionLevel;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(4, Math.round(parsed))) as PermissionLevel;
    }
  }

  return 1;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || undefined;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeTriggerPhrases(value: unknown) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return Array.from(
    new Set(
      list
        .map((item) => normalizeString(item).toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeAllowedTools(value: unknown, fallback: ToolName[] = ["summarize_documents"]) {
  const raw = Array.isArray(value) ? value : [];
  const tools = raw.filter(
    (tool): tool is ToolName =>
      typeof tool === "string" && CUSTOM_AGENT_TOOL_OPTIONS.includes(tool as ToolName)
  );

  return tools.length ? Array.from(new Set(tools)) : fallback;
}

export function slugifyCustomAgentName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "custom-agent";
}

export function serializeCustomAgent<T extends Record<string, unknown>>(agent: T): CustomAgent {
  return {
    ...agent,
    description: typeof agent.description === "string" ? agent.description : null,
    instructions: normalizeString(agent.instructions),
    baseSkill: CUSTOM_AGENT_SKILL_OPTIONS.includes(agent.baseSkill as SkillName)
      ? (agent.baseSkill as SkillName)
      : "project_manager_skill",
    enabled: Boolean(agent.enabled),
    autoRun: Boolean(agent.autoRun),
    includeProjectContext: Boolean(agent.includeProjectContext),
    includeDocumentSummary: Boolean(agent.includeDocumentSummary),
    includeEstimateSnapshot: Boolean(agent.includeEstimateSnapshot),
    executionMode: CUSTOM_AGENT_EXECUTION_MODES.includes(agent.executionMode as CustomAgentExecutionMode)
      ? (agent.executionMode as CustomAgentExecutionMode)
      : "chat",
    pipelineStage: CUSTOM_AGENT_PIPELINE_STAGES.includes(agent.pipelineStage as CustomAgentPipelineStage)
      ? (agent.pipelineStage as CustomAgentPipelineStage)
      : null,
    requiredLevel: clampPermissionLevel(agent.requiredLevel),
    reviewRequired: Boolean(agent.reviewRequired),
    allowedTools: normalizeAllowedTools(parseJsonField(agent.allowedTools, [])),
    triggerPhrases: normalizeTriggerPhrases(parseJsonField(agent.triggerPhrases, [])),
    successCriteria: typeof agent.successCriteria === "string" ? agent.successCriteria : null,
    outputSchema: typeof agent.outputSchema === "string" ? agent.outputSchema : null,
    sortOrder: typeof agent.sortOrder === "number" ? agent.sortOrder : 0,
  } as unknown as CustomAgent;
}

export function normalizeCustomAgentInput(
  value: Partial<CustomAgent> | Record<string, unknown> | null | undefined,
  fallback?: Partial<CustomAgent>
) {
  const source = {
    ...DEFAULT_CUSTOM_AGENT_DRAFT,
    ...(fallback || {}),
    ...(value || {}),
  };

  const name = normalizeString(source.name);
  const slug = slugifyCustomAgentName(normalizeString(source.slug) || name);
  const executionMode = CUSTOM_AGENT_EXECUTION_MODES.includes(
    source.executionMode as CustomAgentExecutionMode
  )
    ? (source.executionMode as CustomAgentExecutionMode)
    : DEFAULT_CUSTOM_AGENT_DRAFT.executionMode;
  const pipelineStage = CUSTOM_AGENT_PIPELINE_STAGES.includes(
    source.pipelineStage as CustomAgentPipelineStage
  )
    ? (source.pipelineStage as CustomAgentPipelineStage)
    : DEFAULT_CUSTOM_AGENT_DRAFT.pipelineStage;

  return {
    name,
    slug,
    description: normalizeOptionalString(source.description),
    instructions: normalizeString(source.instructions),
    baseSkill: CUSTOM_AGENT_SKILL_OPTIONS.includes(source.baseSkill as SkillName)
      ? (source.baseSkill as SkillName)
      : DEFAULT_CUSTOM_AGENT_DRAFT.baseSkill,
    enabled: normalizeBoolean(source.enabled, true),
    autoRun: normalizeBoolean(source.autoRun, false),
    includeProjectContext: normalizeBoolean(source.includeProjectContext, true),
    includeDocumentSummary: normalizeBoolean(source.includeDocumentSummary, true),
    includeEstimateSnapshot: normalizeBoolean(source.includeEstimateSnapshot, true),
    executionMode,
    pipelineStage: executionMode === "chat" ? null : pipelineStage,
    requiredLevel: clampPermissionLevel(source.requiredLevel),
    reviewRequired: normalizeBoolean(source.reviewRequired, true),
    allowedTools: normalizeAllowedTools(source.allowedTools, DEFAULT_CUSTOM_AGENT_DRAFT.allowedTools),
    triggerPhrases: normalizeTriggerPhrases(source.triggerPhrases),
    successCriteria: normalizeOptionalString(source.successCriteria),
    outputSchema: normalizeOptionalString(source.outputSchema),
    sortOrder:
      typeof source.sortOrder === "number" && Number.isFinite(source.sortOrder)
        ? Math.round(source.sortOrder)
        : 0,
  };
}

export async function ensureUniqueCustomAgentSlug(
  userId: string,
  desiredSlug: string,
  excludeId?: string
) {
  const baseSlug = slugifyCustomAgentName(desiredSlug);
  let slug = baseSlug;
  let counter = 2;

  for (;;) {
    const existing = await db.customAgent.findFirst({
      where: {
        userId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

export async function loadUserCustomAgents(
  userId: string,
  options?: {
    enabledOnly?: boolean;
    executionMode?: CustomAgentExecutionMode | "chat-capable" | "pipeline-capable";
  }
) {
  const agents = await db.customAgent.findMany({
    where: {
      userId,
      ...(options?.enabledOnly ? { enabled: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return agents
    .map((agent) => serializeCustomAgent(agent as unknown as Record<string, unknown>))
    .filter((agent) => {
      if (!options?.executionMode) return true;
      if (options.executionMode === "chat-capable") {
        return agent.executionMode === "chat" || agent.executionMode === "both";
      }
      if (options.executionMode === "pipeline-capable") {
        return agent.executionMode === "pipeline" || agent.executionMode === "both";
      }
      return agent.executionMode === options.executionMode;
    });
}

export function detectCustomAgentMatch(
  message: string,
  agents: CustomAgent[],
  userLevel: number
) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  const mentionMatch = normalized.match(/@([a-z0-9-]+)/i);
  const mentionSlug = mentionMatch?.[1]?.toLowerCase();

  const eligibleAgents = agents.filter(
    (agent) =>
      agent.enabled &&
      agent.requiredLevel <= userLevel &&
      (agent.executionMode === "chat" || agent.executionMode === "both")
  );

  if (mentionSlug) {
    const directAgent = eligibleAgents.find((agent) => agent.slug.toLowerCase() === mentionSlug);
    if (directAgent) {
      return {
        agent: directAgent,
        reason: "mention",
      } as const;
    }
  }

  const triggeredAgent = eligibleAgents.find(
    (agent) =>
      agent.autoRun &&
      agent.triggerPhrases.some((phrase) => phrase && normalized.includes(phrase))
  );

  if (!triggeredAgent) {
    return null;
  }

  return {
    agent: triggeredAgent,
    reason: "trigger",
  } as const;
}

export function buildCustomAgentPersistence(agent: ReturnType<typeof normalizeCustomAgentInput>) {
  return {
    ...agent,
    allowedTools: stringifyJson(agent.allowedTools),
    triggerPhrases: stringifyJson(agent.triggerPhrases),
  };
}

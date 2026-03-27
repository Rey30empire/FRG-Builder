import { db } from "@/lib/db";
import { AGENT_PIPELINE_CATALOG, DEFAULT_AGENT_WORKSPACE_CONFIG } from "@/lib/agent-catalog";
import { parseJsonField, stringifyJson } from "@/lib/json";
import type {
  AppUser,
  AgentPipelineAgentKey,
  ToolName,
  UserAgentWorkspaceConfig,
  UserSenderSettings,
} from "@/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UserMemorySenderShape = {
  emailFromName?: string | null;
  emailFromAddress?: string | null;
  emailReplyTo?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  hasSmtpPassword?: boolean | null;
  agentWorkspaceConfig?: string | null;
};

function normalizeEmailAddress(value?: string | null) {
  const email = value?.trim().toLowerCase();
  return email && EMAIL_PATTERN.test(email) ? email : undefined;
}

function normalizePort(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return undefined;
}

export function buildSenderName(user: { name?: string | null; email: string }) {
  if (user.name?.trim()) {
    return user.name.trim();
  }

  const localPart = user.email.split("@")[0] || "Builder";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildDefaultSenderSettings(user: { name?: string | null; email: string }) {
  const email = normalizeEmailAddress(user.email);

  return {
    fromName: buildSenderName(user),
    fromAddress: email,
    replyTo: email,
    smtpSecure: false,
  } satisfies UserSenderSettings;
}

export function normalizeSenderSettings(
  value: Partial<UserSenderSettings> | null | undefined,
  fallback?: Partial<UserSenderSettings> | null
) {
  const merged = {
    ...fallback,
    ...value,
  };

  return {
    fromName: merged.fromName?.trim() || undefined,
    fromAddress: normalizeEmailAddress(merged.fromAddress),
    replyTo: normalizeEmailAddress(merged.replyTo),
    smtpHost: merged.smtpHost?.trim() || undefined,
    smtpPort: normalizePort(merged.smtpPort),
    smtpSecure: typeof merged.smtpSecure === "boolean" ? merged.smtpSecure : false,
    smtpUser: merged.smtpUser?.trim() || undefined,
    hasSmtpPassword: Boolean(merged.hasSmtpPassword),
  } satisfies UserSenderSettings;
}

export function normalizeAgentWorkspaceConfig(value: unknown): UserAgentWorkspaceConfig {
  const raw =
    parseJsonField<Partial<UserAgentWorkspaceConfig> | null>(value, null) || {};
  const agents = (raw.agents || {}) as Partial<UserAgentWorkspaceConfig["agents"]>;

  const normalizedAgents = Object.fromEntries(
    (Object.keys(AGENT_PIPELINE_CATALOG) as AgentPipelineAgentKey[]).map((agentKey) => {
      const defaults = DEFAULT_AGENT_WORKSPACE_CONFIG.agents[agentKey];
      const current = agents[agentKey];

      return [
        agentKey,
        {
          enabled:
            typeof current?.enabled === "boolean" ? current.enabled : defaults.enabled,
          reviewRequired:
            typeof current?.reviewRequired === "boolean"
              ? current.reviewRequired
              : defaults.reviewRequired,
          requiredLevel:
            typeof current?.requiredLevel === "number"
              ? current.requiredLevel
              : defaults.requiredLevel,
          allowedTools: Array.isArray(current?.allowedTools)
            ? current.allowedTools.filter((tool): tool is ToolName => typeof tool === "string")
            : defaults.allowedTools,
        },
      ];
    })
  ) as UserAgentWorkspaceConfig["agents"];

  return {
    mode:
      raw.mode === "manual" || raw.mode === "assisted" || raw.mode === "agentic"
        ? raw.mode
        : DEFAULT_AGENT_WORKSPACE_CONFIG.mode,
    autoRunOnChat:
      typeof raw.autoRunOnChat === "boolean"
        ? raw.autoRunOnChat
        : DEFAULT_AGENT_WORKSPACE_CONFIG.autoRunOnChat,
    requireReviewBeforeSend:
      typeof raw.requireReviewBeforeSend === "boolean"
        ? raw.requireReviewBeforeSend
        : DEFAULT_AGENT_WORKSPACE_CONFIG.requireReviewBeforeSend,
    agents: normalizedAgents,
  };
}

export function shouldAutoRunOrchestrator(
  message: string,
  workspace: UserAgentWorkspaceConfig | null | undefined
) {
  if (!workspace || workspace.mode === "manual" || !workspace.autoRunOnChat) {
    return false;
  }

  const normalized = message.toLowerCase();

  const signals = [
    "analiza todo",
    "analiza el proyecto",
    "haz el estimado",
    "has el estimado",
    "crea el estimado",
    "desglosa el trabajo",
    "desglose",
    "prepara proposal",
    "prepare proposal",
    "bid this",
    "review the plans",
    "use the pdf",
    "usa los pdf",
    "usa los planos",
    "takeoff",
    "estimate this project",
    "project intake",
    "bid package",
  ];

  return signals.some((signal) => normalized.includes(signal));
}

export function serializeWorkspaceConfig(value: UserAgentWorkspaceConfig) {
  return stringifyJson(value);
}

export function buildWorkspaceMemoryDefaults(user: { email: string; name?: string | null }) {
  const sender = buildDefaultSenderSettings(user);

  return {
    language: "es",
    explanationStyle: "detailed",
    emailFromName: sender.fromName,
    emailFromAddress: sender.fromAddress,
    emailReplyTo: sender.replyTo,
    smtpSecure: false,
    agentWorkspaceConfig: serializeWorkspaceConfig(DEFAULT_AGENT_WORKSPACE_CONFIG),
  };
}

export async function loadUserWorkspaceSettings(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      userMemory: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const defaults = buildDefaultSenderSettings(user);
  const sender = normalizeSenderSettings(
    {
      fromName: user.userMemory?.emailFromName || undefined,
      fromAddress: user.userMemory?.emailFromAddress || undefined,
      replyTo: user.userMemory?.emailReplyTo || undefined,
      smtpHost: user.userMemory?.smtpHost || undefined,
      smtpPort: user.userMemory?.smtpPort || undefined,
      smtpSecure: user.userMemory?.smtpSecure || false,
      smtpUser: user.userMemory?.smtpUser || undefined,
      hasSmtpPassword: Boolean(user.userMemory?.smtpPassword),
    },
    defaults
  );

  return {
    user,
    sender,
    agentWorkspaceConfig: normalizeAgentWorkspaceConfig(
      user.userMemory?.agentWorkspaceConfig
    ),
  };
}

export function extractUserSenderSettings(user: {
  email: string;
  name?: string | null;
  userMemory?: UserMemorySenderShape | null;
}) {
  const defaults = buildDefaultSenderSettings(user);

  return normalizeSenderSettings(
    {
      fromName: user.userMemory?.emailFromName || undefined,
      fromAddress: user.userMemory?.emailFromAddress || undefined,
      replyTo: user.userMemory?.emailReplyTo || undefined,
      smtpHost: user.userMemory?.smtpHost || undefined,
      smtpPort: user.userMemory?.smtpPort ?? undefined,
      smtpSecure: user.userMemory?.smtpSecure ?? undefined,
      smtpUser: user.userMemory?.smtpUser || undefined,
      hasSmtpPassword: Boolean(user.userMemory?.hasSmtpPassword) || Boolean(user.userMemory?.smtpPassword),
    },
    defaults
  );
}

export function extractUserSenderForDelivery(user: {
  email: string;
  name?: string | null;
  userMemory?: UserMemorySenderShape | null;
}) {
  const sender = extractUserSenderSettings(user);

  return {
    ...sender,
    smtpPassword: user.userMemory?.smtpPassword?.trim() || undefined,
  };
}

export function buildWorkspacePayloadFromUser(user: AppUser) {
  return {
    sender: extractUserSenderSettings({
      email: user.email,
      name: user.name,
      userMemory: user.userMemory
        ? {
            emailFromName: user.userMemory.emailFromName || undefined,
            emailFromAddress: user.userMemory.emailFromAddress || undefined,
            emailReplyTo: user.userMemory.emailReplyTo || undefined,
            smtpHost: user.userMemory.smtpHost || undefined,
            smtpPort: user.userMemory.smtpPort ?? undefined,
            smtpSecure: user.userMemory.smtpSecure ?? undefined,
            smtpUser: user.userMemory.smtpUser || undefined,
            hasSmtpPassword: user.userMemory.hasSmtpPassword || undefined,
          }
        : null,
    }),
    agentWorkspaceConfig: normalizeAgentWorkspaceConfig(
      user.userMemory?.agentWorkspaceConfig
    ),
  };
}

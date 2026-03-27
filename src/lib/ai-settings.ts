import { db } from "@/lib/db";
import { getSystemProviderApiKey, loadAiCredentialSummaries, type AiCredentialSummary } from "@/lib/ai-credentials";
import { parseJsonField, stringifyJson } from "@/lib/json";
import { buildWorkspaceMemoryDefaults } from "@/lib/user-workspace";
import type {
  AiProviderConfig,
  AiProviderName,
  AiProviderSettings,
  AiProviderSettingsResponse,
  AiProviderStatus,
} from "@/types";

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  gemini: "Gemini",
};

export const DEFAULT_AI_SETTINGS: AiProviderSettings = {
  primary: "openai",
  providers: {
    openai: {
      enabled: true,
      model: process.env.OPENAI_MODEL || "gpt-5.2",
    },
    anthropic: {
      enabled: false,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    },
    gemini: {
      enabled: false,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    },
  },
};

function normalizeProviderConfig(
  provider: AiProviderName,
  value: Partial<AiProviderConfig> | undefined
): AiProviderConfig {
  return {
    enabled:
      typeof value?.enabled === "boolean"
        ? value.enabled
        : DEFAULT_AI_SETTINGS.providers[provider].enabled,
    model:
      typeof value?.model === "string" && value.model.trim()
        ? value.model.trim()
        : DEFAULT_AI_SETTINGS.providers[provider].model,
  };
}

export function normalizeAiSettings(value: unknown): AiProviderSettings {
  const raw = parseJsonField<Partial<AiProviderSettings> | null>(value, null) || {};
  const primary = raw.primary && raw.primary in PROVIDER_LABELS ? raw.primary : "openai";
  const providers = (raw.providers || {}) as Partial<Record<AiProviderName, Partial<AiProviderConfig>>>;

  return {
    primary,
    providers: {
      openai: normalizeProviderConfig("openai", providers.openai),
      anthropic: normalizeProviderConfig("anthropic", providers.anthropic),
      gemini: normalizeProviderConfig("gemini", providers.gemini),
    },
  };
}

export function hasProviderApiKey(
  provider: AiProviderName,
  credentialSummaries?: Record<AiProviderName, AiCredentialSummary>
) {
  if (credentialSummaries?.[provider]) {
    return credentialSummaries[provider].hasApiKey;
  }

  return Boolean(getSystemProviderApiKey(provider));
}

export function buildAiSettingsResponse(
  settings: AiProviderSettings,
  credentialSummaries?: Record<AiProviderName, AiCredentialSummary>
): AiProviderSettingsResponse {
  const providers = Object.entries(settings.providers).reduce(
    (acc, [providerName, providerConfig]) => {
      const provider = providerName as AiProviderName;
      const credentialSummary = credentialSummaries?.[provider];
      acc[provider] = {
        ...providerConfig,
        hasApiKey: hasProviderApiKey(provider, credentialSummaries),
        hasPersonalKey: credentialSummary?.hasPersonalKey || false,
        hasSystemKey: credentialSummary?.hasSystemKey || false,
        keySource: credentialSummary?.keySource || "none",
        validationStatus: credentialSummary?.validationStatus || "missing",
        keyHint: credentialSummary?.keyHint || null,
        lastValidatedAt: credentialSummary?.lastValidatedAt || null,
        lastValidationError: credentialSummary?.lastValidationError || null,
        label: PROVIDER_LABELS[provider],
      };
      return acc;
    },
    {} as Record<AiProviderName, AiProviderStatus>
  );

  return {
    primary: settings.primary,
    active: resolveActiveProvider(settings, credentialSummaries),
    providers,
  };
}

export function resolveActiveProvider(
  settings: AiProviderSettings,
  credentialSummaries?: Record<AiProviderName, AiCredentialSummary>
): AiProviderName | null {
  const orderedProviders: AiProviderName[] = [
    settings.primary,
    ...(["openai", "anthropic", "gemini"] as AiProviderName[]).filter(
      (provider) => provider !== settings.primary
    ),
  ];

  for (const provider of orderedProviders) {
    if (settings.providers[provider].enabled && hasProviderApiKey(provider, credentialSummaries)) {
      return provider;
    }
  }

  for (const provider of orderedProviders) {
    if (settings.providers[provider].enabled) {
      return provider;
    }
  }

  return null;
}

export async function loadAiSettings(userId?: string | null) {
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { userMemory: true },
    });

    if (user) {
      return {
        companyMemoryId: null,
        settings: normalizeAiSettings(user.userMemory?.aiProviderConfig),
      };
    }
  }

  const companyMemory = await db.companyMemory.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true, aiProviderConfig: true },
  });

  return {
    companyMemoryId: companyMemory?.id || null,
    settings: normalizeAiSettings(companyMemory?.aiProviderConfig),
  };
}

export async function saveAiSettings(nextSettings: AiProviderSettings, userId?: string | null) {
  const normalized = normalizeAiSettings(nextSettings);

  if (userId) {
    const existingUser = await db.user.findUnique({
      where: { id: userId },
      include: { userMemory: true },
    });

    if (!existingUser) {
      throw new Error("User not found");
    }

    await db.user.update({
      where: { id: userId },
      data: {
        userMemory: {
          upsert: {
            update: {
              aiProviderConfig: stringifyJson(normalized),
            },
            create: {
              ...buildWorkspaceMemoryDefaults(existingUser),
              aiProviderConfig: stringifyJson(normalized),
            },
          },
        },
      },
    });

    return normalized;
  }

  const existing = await db.companyMemory.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    await db.companyMemory.update({
      where: { id: existing.id },
      data: {
        aiProviderConfig: stringifyJson(normalized),
      },
    });
  } else {
    await db.companyMemory.create({
      data: {
        name: "FRG LLC",
        aiProviderConfig: stringifyJson(normalized),
      },
    });
  }

  return normalized;
}

export async function loadAiSettingsResponse(userId?: string | null) {
  const { settings } = await loadAiSettings(userId);
  const credentialSummaries = await loadAiCredentialSummaries(userId);

  return buildAiSettingsResponse(settings, credentialSummaries);
}

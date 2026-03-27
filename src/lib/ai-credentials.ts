import { db } from "@/lib/db";
import { buildSecretHint, canUseSecretVault, decryptSecret, encryptSecret } from "@/lib/secret-vault";
import type { AiProviderName, AiProviderStatus } from "@/types";

export type AiCredentialSummary = Pick<
  AiProviderStatus,
  | "hasApiKey"
  | "hasPersonalKey"
  | "hasSystemKey"
  | "keySource"
  | "validationStatus"
  | "keyHint"
  | "lastValidatedAt"
  | "lastValidationError"
>;

const PROVIDER_ENV_KEYS: Record<AiProviderName, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};

export function getSystemProviderApiKey(provider: AiProviderName) {
  const envKey = PROVIDER_ENV_KEYS[provider];
  return process.env[envKey]?.trim() || null;
}

function isCredentialUsable(status?: string | null) {
  return status !== "invalid";
}

function buildMissingSummary(): AiCredentialSummary {
  return {
    hasApiKey: false,
    hasPersonalKey: false,
    hasSystemKey: false,
    keySource: "none",
    validationStatus: "missing",
    keyHint: null,
    lastValidatedAt: null,
    lastValidationError: null,
  };
}

function buildSystemSummary(provider: AiProviderName): AiCredentialSummary {
  const systemKey = getSystemProviderApiKey(provider);

  if (!systemKey) {
    return buildMissingSummary();
  }

  return {
    hasApiKey: true,
    hasPersonalKey: false,
    hasSystemKey: true,
    keySource: "system",
    validationStatus: "valid",
    keyHint: buildSecretHint(systemKey),
    lastValidatedAt: null,
    lastValidationError: null,
  };
}

export async function loadAiCredentialSummaries(userId?: string | null) {
  const base: Record<AiProviderName, AiCredentialSummary> = {
    openai: buildSystemSummary("openai"),
    anthropic: buildSystemSummary("anthropic"),
    gemini: buildSystemSummary("gemini"),
  };

  if (!userId) {
    return base;
  }

  const records = await db.userAiCredential.findMany({
    where: { userId },
  });

  for (const provider of ["openai", "anthropic", "gemini"] as AiProviderName[]) {
    const record = records.find((entry) => entry.provider === provider);
    if (!record) {
      continue;
    }

    const systemSummary = base[provider];
    const validationStatus =
      record.status === "valid" || record.status === "invalid" ? record.status : "pending";
    const hasUsablePersonalKey = isCredentialUsable(record.status);
    const keySource = hasUsablePersonalKey
      ? "user"
      : systemSummary.hasSystemKey
        ? "system"
        : "none";
    base[provider] = {
      hasApiKey: hasUsablePersonalKey || systemSummary.hasSystemKey,
      hasPersonalKey: true,
      hasSystemKey: systemSummary.hasSystemKey,
      keySource,
      validationStatus,
      keyHint: record.keyHint,
      lastValidatedAt: record.lastValidatedAt?.toISOString() || null,
      lastValidationError: record.lastValidationError,
    };
  }

  return base;
}

export async function resolveProviderApiKey(provider: AiProviderName, userId?: string | null) {
  if (userId) {
    const credential = await db.userAiCredential.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (credential?.encryptedKey && isCredentialUsable(credential.status)) {
      return {
        apiKey: decryptSecret(credential.encryptedKey),
        source: "user" as const,
      };
    }
  }

  const systemKey = getSystemProviderApiKey(provider);

  if (systemKey) {
    return {
      apiKey: systemKey,
      source: "system" as const,
    };
  }

  return {
    apiKey: null,
    source: "none" as const,
  };
}

type ValidationResult = {
  valid: boolean;
  error?: string | null;
  validatedAt?: Date | null;
};

async function validateOpenAiApiKey(apiKey: string): Promise<ValidationResult> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (response.ok) {
    return {
      valid: true,
      validatedAt: new Date(),
    };
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  return {
    valid: false,
    error: payload?.error?.message || "OpenAI key validation failed.",
    validatedAt: new Date(),
  };
}

export async function validateProviderCredential(provider: AiProviderName, apiKey: string) {
  if (provider === "openai") {
    return validateOpenAiApiKey(apiKey);
  }

  return {
    valid: true,
    error: null,
    validatedAt: new Date(),
  } satisfies ValidationResult;
}

export async function saveUserAiCredential(input: {
  userId: string;
  provider: AiProviderName;
  apiKey: string;
}) {
  const normalizedApiKey = input.apiKey.trim();

  if (!canUseSecretVault()) {
    throw new Error("APP_ENCRYPTION_KEY is required before users can save personal AI API keys.");
  }

  if (!normalizedApiKey) {
    throw new Error("API key is required.");
  }

  const validation = await validateProviderCredential(input.provider, normalizedApiKey);
  const encryptedKey = encryptSecret(normalizedApiKey);

  return db.userAiCredential.upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider: input.provider,
      },
    },
    update: {
      encryptedKey,
      keyHint: buildSecretHint(normalizedApiKey),
      status: validation.valid ? "valid" : "invalid",
      lastValidatedAt: validation.validatedAt || new Date(),
      lastValidationError: validation.error || null,
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      encryptedKey,
      keyHint: buildSecretHint(normalizedApiKey),
      status: validation.valid ? "valid" : "invalid",
      lastValidatedAt: validation.validatedAt || new Date(),
      lastValidationError: validation.error || null,
    },
  });
}

export async function deleteUserAiCredential(userId: string, provider: AiProviderName) {
  await db.userAiCredential.deleteMany({
    where: {
      userId,
      provider,
    },
  });
}

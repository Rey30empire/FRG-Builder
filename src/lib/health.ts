import { loadAiSettingsResponse } from "@/lib/ai-settings";
import { db } from "@/lib/db";

type HealthStatus = "healthy" | "warning" | "critical";

function resolveStorageHealth() {
  const driver = process.env.STORAGE_DRIVER || "local";

  if (driver !== "s3") {
    return {
      status: "warning" as const,
      driver,
      message: "Using local filesystem storage. Production should switch to S3-compatible storage.",
    };
  }

  const requiredKeys = [
    "STORAGE_REGION",
    "STORAGE_BUCKET",
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_SECRET_ACCESS_KEY",
  ];
  const missing = requiredKeys.filter((key) => !process.env[key]);

  return {
    status: missing.length === 0 ? ("healthy" as const) : ("critical" as const),
    driver,
    message:
      missing.length === 0
        ? "S3 storage is configured."
        : `Missing storage variables: ${missing.join(", ")}`,
  };
}

function resolveEmailHealth() {
  const provider = process.env.EMAIL_PROVIDER || "log";

  if (provider === "log") {
    return {
      status: "warning" as const,
      provider,
      message: "Email provider is still set to log. Outbound email is not live.",
    };
  }

  if (provider === "resend" && !process.env.RESEND_API_KEY) {
    return {
      status: "critical" as const,
      provider,
      message: "RESEND_API_KEY is missing.",
    };
  }

  if (
    provider === "smtp" &&
    (!process.env.SMTP_HOST ||
      !process.env.SMTP_PORT ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASSWORD)
  ) {
    return {
      status: "critical" as const,
      provider,
      message: "SMTP credentials are incomplete.",
    };
  }

  return {
    status: "healthy" as const,
    provider,
    message: "Email provider is configured.",
  };
}

function resolveDatabaseDriver() {
  const url = process.env.DATABASE_URL || "";

  if (url.startsWith("postgres")) {
    return {
      status: "healthy" as const,
      driver: "postgres",
      message: "Managed Postgres detected.",
    };
  }

  if (url.startsWith("file:")) {
    return {
      status: "warning" as const,
      driver: "sqlite",
      message: "SQLite detected. Suitable for local development, not ideal for production.",
    };
  }

  return {
    status: "critical" as const,
    driver: "unknown",
    message: "DATABASE_URL is missing or invalid.",
  };
}

function summarizeHealthStatus(statuses: HealthStatus[]) {
  if (statuses.includes("critical")) return "critical" as const;
  if (statuses.includes("warning")) return "warning" as const;
  return "healthy" as const;
}

export async function getSystemHealth() {
  const databaseConfig = resolveDatabaseDriver();
  const storage = resolveStorageHealth();
  const email = resolveEmailHealth();

  let databaseRuntime = {
    status: "healthy" as HealthStatus,
    message: "Database query succeeded.",
  };

  try {
    await db.user.count();
  } catch (error) {
    databaseRuntime = {
      status: "critical",
      message: error instanceof Error ? error.message : "Database query failed.",
    };
  }

  const ai = await loadAiSettingsResponse();
  const activeProvider =
    ai.active && ai.providers[ai.active]
      ? ai.providers[ai.active]
      : null;

  const aiStatus: HealthStatus = activeProvider?.hasApiKey
    ? "healthy"
    : activeProvider
      ? "warning"
      : "warning";

  const status = summarizeHealthStatus([
    databaseConfig.status,
    databaseRuntime.status,
    storage.status,
    email.status,
    aiStatus,
  ]);

  return {
    status,
    ok: status !== "critical",
    releaseReady:
      databaseConfig.driver === "postgres" &&
      storage.status === "healthy" &&
      email.status === "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: summarizeHealthStatus([databaseConfig.status, databaseRuntime.status]),
        driver: databaseConfig.driver,
        configMessage: databaseConfig.message,
        runtimeMessage: databaseRuntime.message,
      },
      storage,
      email,
      ai: {
        status: aiStatus,
        primary: ai.primary,
        active: ai.active,
        message: activeProvider?.hasApiKey
          ? `${activeProvider.label} is ready.`
          : "Primary AI provider is missing its API key.",
      },
    },
  };
}

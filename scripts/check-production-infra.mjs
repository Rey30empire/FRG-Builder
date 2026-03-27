import { createEnvReader } from "./env-utils.mjs";

const getEnv = createEnvReader();
const issues = [];
const warnings = [];

const databaseUrl = getEnv("DATABASE_URL");
const storageDriver = getEnv("STORAGE_DRIVER") || "local";

if (!databaseUrl) {
  issues.push("DATABASE_URL is missing.");
} else if (databaseUrl.startsWith("file:")) {
  issues.push("DATABASE_URL still points to SQLite. Production should use managed Postgres.");
}

if (storageDriver !== "s3") {
  issues.push("STORAGE_DRIVER is not set to s3. Production uploads should use durable object storage.");
}

if (storageDriver === "s3") {
  const requiredStorageKeys = [
    "STORAGE_REGION",
    "STORAGE_BUCKET",
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_SECRET_ACCESS_KEY",
  ];
  const missingStorageKeys = requiredStorageKeys.filter((key) => !getEnv(key));

  if (missingStorageKeys.length > 0) {
    issues.push(`Missing S3 storage variables: ${missingStorageKeys.join(", ")}`);
  }

  if (!getEnv("STORAGE_ENDPOINT")) {
    warnings.push(
      "STORAGE_ENDPOINT is empty. That is fine for AWS S3, but S3-compatible providers usually need it."
    );
  }
}

if (!getEnv("OPS_CRON_SECRET")) {
  warnings.push(
    "OPS_CRON_SECRET is empty. Scheduled maintenance calls should be protected before production."
  );
}

if (issues.length > 0) {
  console.error("[infra] Production infrastructure check failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }

  if (warnings.length > 0) {
    console.error("[infra] Additional warnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }

  process.exit(1);
}
console.log("[infra] Production infrastructure check passed.");
if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`[infra] Warning: ${warning}`);
  }
}

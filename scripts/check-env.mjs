import { createEnvReader } from "./env-utils.mjs";

const getEnv = createEnvReader(process.cwd());
const isNetlifyBuild = getEnv("NETLIFY") === "true";
const requireProductionInfra = getEnv("FRG_REQUIRE_PROD_INFRA") === "true";

const requiredKeys = ["DATABASE_URL"];
const missing = requiredKeys.filter((key) => !getEnv(key));

if (missing.length > 0) {
  if (
    missing.length === 1 &&
    missing[0] === "DATABASE_URL" &&
    isNetlifyBuild &&
    !requireProductionInfra
  ) {
    console.warn(
      "[env] DATABASE_URL is missing in Netlify build env. Build can continue with a temporary build-only Postgres fallback, but runtime still needs a real database connection through Netlify DB/Neon or DATABASE_URL."
    );
  } else {
    console.error(
      `[env] Missing required variables: ${missing.join(", ")}. Copy .env.example to .env and fill the required values.`
    );
    process.exit(1);
  }
}

const databaseUrl = getEnv("DATABASE_URL");
const nodeEnv = getEnv("NODE_ENV") || "development";
const storageDriver = getEnv("STORAGE_DRIVER") || "local";
const productionIssues = [];

if (!databaseUrl) {
  console.log("[env] Environment check passed with temporary Netlify build fallback.");
  process.exit(0);
}

if (nodeEnv === "production" && databaseUrl.startsWith("file:")) {
  console.warn(
    "[env] Warning: DATABASE_URL points to SQLite. This is acceptable for local/dev, but production should use managed Postgres."
  );
}

if (nodeEnv === "production" && storageDriver === "local") {
  console.warn(
    "[env] Warning: STORAGE_DRIVER is local. This is acceptable for local/dev, but production should use durable object storage."
  );
}

if (nodeEnv === "production" && !getEnv("STRIPE_SECRET_KEY")) {
  console.warn(
    "[env] Warning: STRIPE_SECRET_KEY is missing. Billing UI will load, but checkout and the portal will stay disabled."
  );
}

if (requireProductionInfra) {
  if (databaseUrl.startsWith("file:")) {
    productionIssues.push("DATABASE_URL must not point to SQLite when FRG_REQUIRE_PROD_INFRA=true.");
  }

  if (storageDriver !== "s3") {
    productionIssues.push("STORAGE_DRIVER must be set to s3 when FRG_REQUIRE_PROD_INFRA=true.");
  } else {
    const requiredStorageKeys = [
      "STORAGE_REGION",
      "STORAGE_BUCKET",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
    ];
    const missingStorageKeys = requiredStorageKeys.filter((key) => !getEnv(key));

    if (missingStorageKeys.length > 0) {
      productionIssues.push(
        `Missing storage variables for production infra: ${missingStorageKeys.join(", ")}.`
      );
    }
  }
}

if (productionIssues.length > 0) {
  console.error(`[env] ${productionIssues.join(" ")}`);
  process.exit(1);
}

console.log("[env] Environment check passed.");

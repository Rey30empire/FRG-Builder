import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadEnvFiles(root = process.cwd()) {
  const envFiles = [".env.local", ".env"];
  const loadedEnv = {};

  for (const file of envFiles) {
    const fullPath = path.join(root, file);

    if (!existsSync(fullPath)) {
      continue;
    }

    const content = readFileSync(fullPath, "utf8");

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in loadedEnv)) {
        loadedEnv[key] = value;
      }
    }
  }

  return loadedEnv;
}

export function createEnvReader(root = process.cwd()) {
  const loadedEnv = loadEnvFiles(root);

  function readRawEnv(key) {
    return process.env[key] || loadedEnv[key] || "";
  }

  return function getEnv(key) {
    if (key === "DATABASE_URL") {
      return readRawEnv("DATABASE_URL") || readRawEnv("NETLIFY_DATABASE_URL");
    }

    if (key === "DIRECT_URL") {
      return (
        readRawEnv("DIRECT_URL") ||
        readRawEnv("NETLIFY_DATABASE_URL_UNPOOLED") ||
        readRawEnv("DATABASE_URL") ||
        readRawEnv("NETLIFY_DATABASE_URL")
      );
    }

    return readRawEnv(key);
  };
}

export function resolveSqliteDatabasePath(databaseUrl, root = process.cwd()) {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const rawPath = databaseUrl.slice("file:".length);
  return path.resolve(root, "prisma", rawPath);
}

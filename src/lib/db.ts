import { PrismaClient } from "@prisma/client";

function resolveDatabaseRuntimeEnv() {
  if (!process.env.DATABASE_URL?.trim() && process.env.NETLIFY_DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = process.env.NETLIFY_DATABASE_URL.trim();
  }

  if (!process.env.DIRECT_URL?.trim()) {
    process.env.DIRECT_URL =
      process.env.NETLIFY_DATABASE_URL_UNPOOLED?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "";
  }

  return {
    databaseUrl: process.env.DATABASE_URL?.trim() || "",
    directUrl: process.env.DIRECT_URL?.trim() || "",
  };
}

resolveDatabaseRuntimeEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

type AppPrismaClient = PrismaClient & {
  customAgent: any;
  agentRun: any;
  agentRunStep: any;
};

export function hasDatabaseUrlConfigured() {
  return Boolean(resolveDatabaseRuntimeEnv().databaseUrl);
}

export function getConfiguredDatabaseUrl() {
  return resolveDatabaseRuntimeEnv().databaseUrl;
}

export const db =
  globalForPrisma.prisma ??
  (new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }) as AppPrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export default db;

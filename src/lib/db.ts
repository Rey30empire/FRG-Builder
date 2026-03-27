import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

type AppPrismaClient = PrismaClient & {
  customAgent: any;
  agentRun: any;
  agentRunStep: any;
};

export const db =
  globalForPrisma.prisma ??
  (new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }) as AppPrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export default db;

import { db } from "@/lib/db";

export const DEFAULT_USER_ID = "default-user";
export const DEFAULT_USER_EMAIL = "builder@frg.local";
export const DEFAULT_USER_NAME = "FRG Builder";

export const SYSTEM_USERS = [
  {
    id: DEFAULT_USER_ID,
    email: DEFAULT_USER_EMAIL,
    name: DEFAULT_USER_NAME,
    role: "admin",
    level: 4,
    memory: {
      language: "es",
      explanationStyle: "detailed",
      companyType: "general_contractor",
      preferredMargins: 18,
      overheadPercent: 12,
      laborRates: JSON.stringify({
        general: 62,
        concrete: 68,
        framing: 64,
        drywall: 60,
        electrical: 82,
        plumbing: 80,
      }),
    },
  },
  {
    id: "estimator-user",
    email: "estimator@frg.local",
    name: "Estimator Mode",
    role: "user",
    level: 2,
    memory: {
      language: "es",
      explanationStyle: "detailed",
      companyType: "subcontractor",
      preferredMargins: 14,
      overheadPercent: 10,
      laborRates: JSON.stringify({
        general: 60,
        concrete: 66,
        framing: 62,
        drywall: 58,
        electrical: 78,
        plumbing: 76,
      }),
    },
  },
  {
    id: "sales-user",
    email: "sales@frg.local",
    name: "Sales Mode",
    role: "user",
    level: 1,
    memory: {
      language: "en",
      explanationStyle: "summary",
      companyType: "business_development",
      preferredMargins: 20,
      overheadPercent: 8,
      laborRates: JSON.stringify({
        general: 58,
        finishes: 59,
        painting: 52,
      }),
    },
  },
] as const;

export async function ensureDefaultUser() {
  return db.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
      role: "admin",
      level: 4,
    },
    create: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
      role: "admin",
      level: 4,
    },
  });
}

export async function ensureSystemUsers() {
  for (const user of SYSTEM_USERS) {
    await db.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level,
        userMemory: {
          upsert: {
            update: user.memory,
            create: user.memory,
          },
        },
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level,
        userMemory: {
          create: user.memory,
        },
      },
    });
  }

  return db.user.findMany({
    include: { userMemory: true },
    orderBy: [{ level: "desc" }, { name: "asc" }],
  });
}

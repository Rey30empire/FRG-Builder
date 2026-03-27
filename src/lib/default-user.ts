import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_AI_SETTINGS } from "@/lib/ai-settings";
import { DEFAULT_AGENT_WORKSPACE_CONFIG } from "@/lib/agent-catalog";
import { stringifyJson } from "@/lib/json";

export const DEFAULT_USER_ID = "default-user";
export const DEFAULT_USER_EMAIL = "builder@frg.local";
export const DEFAULT_USER_NAME = "FRG Builder";
export const DEFAULT_USER_PASSWORD = "Builder123!";

export const SYSTEM_USERS = [
  {
    id: DEFAULT_USER_ID,
    email: DEFAULT_USER_EMAIL,
    name: DEFAULT_USER_NAME,
    role: "admin",
    level: 4,
    password: DEFAULT_USER_PASSWORD,
    memory: {
      language: "es",
      explanationStyle: "detailed",
      companyType: "general_contractor",
      preferredMargins: 18,
      overheadPercent: 12,
      emailFromName: DEFAULT_USER_NAME,
      emailFromAddress: DEFAULT_USER_EMAIL,
      emailReplyTo: DEFAULT_USER_EMAIL,
      aiProviderConfig: stringifyJson(DEFAULT_AI_SETTINGS),
      agentWorkspaceConfig: stringifyJson(DEFAULT_AGENT_WORKSPACE_CONFIG),
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
    password: "Estimator123!",
    memory: {
      language: "es",
      explanationStyle: "detailed",
      companyType: "subcontractor",
      preferredMargins: 14,
      overheadPercent: 10,
      emailFromName: "Estimator Mode",
      emailFromAddress: "estimator@frg.local",
      emailReplyTo: "estimator@frg.local",
      aiProviderConfig: stringifyJson(DEFAULT_AI_SETTINGS),
      agentWorkspaceConfig: stringifyJson({
        ...DEFAULT_AGENT_WORKSPACE_CONFIG,
        mode: "assisted",
        autoRunOnChat: true,
      }),
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
    password: "Sales123!",
    memory: {
      language: "en",
      explanationStyle: "summary",
      companyType: "business_development",
      preferredMargins: 20,
      overheadPercent: 8,
      emailFromName: "Sales Mode",
      emailFromAddress: "sales@frg.local",
      emailReplyTo: "sales@frg.local",
      aiProviderConfig: stringifyJson(DEFAULT_AI_SETTINGS),
      agentWorkspaceConfig: stringifyJson({
        ...DEFAULT_AGENT_WORKSPACE_CONFIG,
        mode: "agentic",
        autoRunOnChat: true,
      }),
      laborRates: JSON.stringify({
        general: 58,
        finishes: 59,
        painting: 52,
      }),
    },
  },
] as const;

const SYSTEM_CUSTOM_AGENTS = [
  {
    userId: DEFAULT_USER_ID,
    slug: "scope-auditor",
    name: "Scope Auditor",
    description: "Reviews bid scope gaps, missing files, and addenda risk before takeoff.",
    instructions:
      "Review the bid package like a senior estimator. Flag missing files, unclear inclusions, addenda risk, and what needs manual review before takeoff continues.",
    baseSkill: "project_manager_skill",
    enabled: true,
    autoRun: true,
    includeProjectContext: true,
    includeDocumentSummary: true,
    includeEstimateSnapshot: false,
    executionMode: "both",
    pipelineStage: "preflight",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: stringifyJson(["summarize_documents", "compare_versions", "save_memory"]),
    triggerPhrases: stringifyJson(["scope gap", "review addenda", "missing files", "scope audit"]),
    successCriteria:
      "Return missing files, risk notes, scope clarifications needed, and the next estimator action.",
    outputSchema: "Summary / Missing files / Scope risks / Human review / Next action",
    sortOrder: 1,
  },
  {
    userId: DEFAULT_USER_ID,
    slug: "bid-qa",
    name: "Bid QA",
    description: "Reviews the outgoing proposal and submit package before delivery.",
    instructions:
      "Audit the outgoing proposal package as a quality-control reviewer. Check readiness to submit, consistency across estimate, bid form, and proposal, and call out anything that should block delivery.",
    baseSkill: "proposal_writer_skill",
    enabled: true,
    autoRun: false,
    includeProjectContext: true,
    includeDocumentSummary: false,
    includeEstimateSnapshot: true,
    executionMode: "pipeline",
    pipelineStage: "delivery",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: stringifyJson(["generate_proposal", "create_pdf", "save_memory"]),
    triggerPhrases: stringifyJson(["qa proposal", "review bid package"]),
    successCriteria:
      "Return go/no-go, missing attachments, client-facing copy issues, and submission blockers.",
    outputSchema: "Go or No-Go / Issues / Attachments / Revisions / Ready to send",
    sortOrder: 2,
  },
  {
    userId: "sales-user",
    slug: "closeout-followup",
    name: "Closeout Follow-up",
    description: "Creates sharp follow-up strategy after proposal delivery.",
    instructions:
      "Act like a commercial closer. Draft the next follow-up steps after proposal delivery, balancing urgency and professionalism.",
    baseSkill: "email_outreach_skill",
    enabled: true,
    autoRun: true,
    includeProjectContext: true,
    includeDocumentSummary: false,
    includeEstimateSnapshot: true,
    executionMode: "both",
    pipelineStage: "followup",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: stringifyJson(["generate_follow_up", "write_email", "save_memory"]),
    triggerPhrases: stringifyJson(["follow up the bid", "close the client", "send reminder"]),
    successCriteria:
      "Return next contact timing, exact message direction, and what objection to address next.",
    outputSchema: "Objective / Timing / Suggested message / Objection to address / Next step",
    sortOrder: 1,
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
      passwordHash: hashPassword(DEFAULT_USER_PASSWORD),
    },
    create: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
      role: "admin",
      level: 4,
      passwordHash: hashPassword(DEFAULT_USER_PASSWORD),
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
        passwordHash: hashPassword(user.password),
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level,
        passwordHash: hashPassword(user.password),
      },
    });

    await db.userMemory.upsert({
      where: { userId: user.id },
      update: user.memory,
      create: {
        userId: user.id,
        ...user.memory,
      },
    });
  }

  for (const agent of SYSTEM_CUSTOM_AGENTS) {
    await db.customAgent.upsert({
      where: {
        userId_slug: {
          userId: agent.userId,
          slug: agent.slug,
        },
      },
      update: agent,
      create: agent,
    });
  }

  return db.user.findMany({
    include: { userMemory: true },
    orderBy: [{ level: "desc" }, { name: "asc" }],
  });
}

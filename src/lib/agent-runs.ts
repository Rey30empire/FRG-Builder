import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import type { AgentWorkspaceMode, SkillName, ToolName } from "@/types";

export async function createAgentRun(input: {
  userId: string;
  projectId?: string | null;
  conversationId?: string | null;
  trigger: "chat" | "quick-action" | "auto-chat";
  mode: AgentWorkspaceMode;
  prompt?: string | null;
}) {
  return db.agentRun.create({
    data: {
      userId: input.userId,
      projectId: input.projectId || null,
      conversationId: input.conversationId || null,
      trigger: input.trigger,
      mode: input.mode,
      prompt: input.prompt || null,
      status: "running",
    },
    include: {
      steps: true,
    },
  });
}

export async function recordAgentRunStep(input: {
  runId: string;
  agentKey: string;
  agentLabel: string;
  status: "completed" | "skipped" | "failed";
  tool?: ToolName | null;
  skill?: SkillName | null;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  startedAt?: Date;
  finishedAt?: Date;
}) {
  return db.agentRunStep.create({
    data: {
      runId: input.runId,
      agentKey: input.agentKey,
      agentLabel: input.agentLabel,
      status: input.status,
      tool: input.tool || null,
      skill: input.skill || null,
      summary: input.summary || null,
      details: stringifyJson(input.details),
      startedAt: input.startedAt || new Date(),
      finishedAt: input.finishedAt || new Date(),
    },
  });
}

export async function finalizeAgentRun(input: {
  runId: string;
  status: "completed" | "failed";
  summary?: string | null;
  output?: string | null;
}) {
  return db.agentRun.update({
    where: { id: input.runId },
    data: {
      status: input.status,
      summary: input.summary || null,
      output: input.output || null,
    },
    include: {
      steps: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

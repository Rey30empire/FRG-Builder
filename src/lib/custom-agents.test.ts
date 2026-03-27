import { describe, expect, it } from "vitest";
import {
  detectCustomAgentMatch,
  normalizeCustomAgentInput,
  slugifyCustomAgentName,
} from "@/lib/custom-agents";
import type { CustomAgent } from "@/types";

describe("custom agents", () => {
  it("normalizes a draft into a safe persisted shape", () => {
    const normalized = normalizeCustomAgentInput({
      name: "Scope Auditor",
      triggerPhrases: [" Scope Gap ", "scope gap", "Review Addenda"],
      allowedTools: ["summarize_documents", "save_memory", "invalid-tool"],
      executionMode: "pipeline",
      pipelineStage: "estimate",
    });

    expect(normalized.slug).toBe("scope-auditor");
    expect(normalized.triggerPhrases).toEqual(["scope gap", "review addenda"]);
    expect(normalized.allowedTools).toEqual(["summarize_documents", "save_memory"]);
    expect(normalized.pipelineStage).toBe("estimate");
  });

  it("matches chat mentions and trigger phrases against enabled custom agents", () => {
    const agent = {
      id: "agent-1",
      userId: "user-1",
      slug: "scope-auditor",
      name: "Scope Auditor",
      description: null,
      instructions: "Review the bid scope.",
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
      allowedTools: ["summarize_documents"],
      triggerPhrases: ["scope gap"],
      successCriteria: null,
      outputSchema: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies CustomAgent;

    const mention = detectCustomAgentMatch("@scope-auditor review this bid", [agent], 2);
    const trigger = detectCustomAgentMatch("we have a scope gap on this project", [agent], 2);

    expect(slugifyCustomAgentName("Scope Auditor")).toBe("scope-auditor");
    expect(mention?.agent.slug).toBe("scope-auditor");
    expect(mention?.reason).toBe("mention");
    expect(trigger?.reason).toBe("trigger");
  });
});

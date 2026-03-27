import { describe, expect, it } from "vitest";
import { canUsePipelineAutomationForAccount, getPlanDefinition } from "@/lib/billing";

describe("billing entitlements", () => {
  it("blocks pipeline automation for starter", () => {
    expect(
      canUsePipelineAutomationForAccount({
        planKey: "starter",
        status: "free",
      })
    ).toBe(false);
  });

  it("allows pipeline automation for active pro", () => {
    expect(
      canUsePipelineAutomationForAccount({
        planKey: "pro",
        status: "active",
      })
    ).toBe(true);
  });

  it("falls back to starter access when paid plan is incomplete", () => {
    expect(
      canUsePipelineAutomationForAccount({
        planKey: "growth",
        status: "incomplete",
      })
    ).toBe(false);
    expect(getPlanDefinition("growth").features.pipelineAutomation).toBe(true);
  });
});

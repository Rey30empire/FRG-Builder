import { describe, expect, it } from "vitest";
import { buildAiSettingsResponse, DEFAULT_AI_SETTINGS, resolveActiveProvider } from "@/lib/ai-settings";
import type { AiCredentialSummary } from "@/lib/ai-credentials";
import type { AiProviderName } from "@/types";

function buildSummary(
  patch: Partial<AiCredentialSummary> = {}
): AiCredentialSummary {
  return {
    hasApiKey: false,
    hasPersonalKey: false,
    hasSystemKey: false,
    keySource: "none",
    validationStatus: "missing",
    keyHint: null,
    lastValidatedAt: null,
    lastValidationError: null,
    ...patch,
  };
}

function buildCredentialMap(overrides: Partial<Record<AiProviderName, AiCredentialSummary>>) {
  return {
    openai: buildSummary(),
    anthropic: buildSummary(),
    gemini: buildSummary(),
    ...overrides,
  };
}

describe("ai settings", () => {
  it("falls back to the next enabled provider with a usable key", () => {
    const settings = {
      ...DEFAULT_AI_SETTINGS,
      providers: {
        openai: { enabled: true, model: "gpt-test" },
        anthropic: { enabled: true, model: "claude-test" },
        gemini: { enabled: false, model: "gemini-test" },
      },
    };

    const active = resolveActiveProvider(
      settings,
      buildCredentialMap({
        openai: buildSummary({
          hasApiKey: false,
          hasPersonalKey: true,
          validationStatus: "invalid",
          lastValidationError: "bad key",
        }),
        anthropic: buildSummary({
          hasApiKey: true,
          hasSystemKey: true,
          keySource: "system",
          validationStatus: "valid",
        }),
      })
    );

    expect(active).toBe("anthropic");
  });

  it("returns provider metadata in the response payload", () => {
    const response = buildAiSettingsResponse(
      DEFAULT_AI_SETTINGS,
      buildCredentialMap({
        openai: buildSummary({
          hasApiKey: true,
          hasPersonalKey: true,
          keySource: "user",
          validationStatus: "valid",
          keyHint: "••••1234",
        }),
      })
    );

    expect(response.providers.openai.hasPersonalKey).toBe(true);
    expect(response.providers.openai.keySource).toBe("user");
    expect(response.providers.openai.keyHint).toBe("••••1234");
  });
});

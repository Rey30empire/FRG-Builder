import { describe, expect, it } from "vitest";
import { consumeRateLimit } from "@/lib/rate-limit";

describe("rate limit", () => {
  it("blocks requests after the configured maximum", () => {
    const store = new Map();
    const rule = { windowMs: 60_000, max: 2 };

    expect(consumeRateLimit("chat:user-1", rule, 1_000, store).allowed).toBe(true);
    expect(consumeRateLimit("chat:user-1", rule, 2_000, store).allowed).toBe(true);
    expect(consumeRateLimit("chat:user-1", rule, 3_000, store).allowed).toBe(false);
  });

  it("resets once the time window expires", () => {
    const store = new Map();
    const rule = { windowMs: 1_000, max: 1 };

    expect(consumeRateLimit("email:user-1", rule, 10, store).allowed).toBe(true);
    expect(consumeRateLimit("email:user-1", rule, 20, store).allowed).toBe(false);
    expect(consumeRateLimit("email:user-1", rule, 1_500, store).allowed).toBe(true);
  });
});

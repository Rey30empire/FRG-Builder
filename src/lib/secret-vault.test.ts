import { afterEach, describe, expect, it } from "vitest";
import { buildSecretHint, decryptSecret, encryptSecret } from "@/lib/secret-vault";

const previousKey = process.env.APP_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) {
    delete process.env.APP_ENCRYPTION_KEY;
    return;
  }

  process.env.APP_ENCRYPTION_KEY = previousKey;
});

describe("secret vault", () => {
  it("encrypts and decrypts API keys", () => {
    process.env.APP_ENCRYPTION_KEY = "test-encryption-key";

    const encrypted = encryptSecret("sk-test-123456");

    expect(encrypted).not.toContain("sk-test-123456");
    expect(decryptSecret(encrypted)).toBe("sk-test-123456");
  });

  it("builds a short masked hint", () => {
    expect(buildSecretHint("sk-live-9876")).toBe("••••9876");
  });
});

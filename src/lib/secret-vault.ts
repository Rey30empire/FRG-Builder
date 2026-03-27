import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const source =
    process.env.APP_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SESSION_SECRET ||
    "";

  if (!source.trim()) {
    return null;
  }

  return createHash("sha256").update(source).digest();
}

export function canUseSecretVault() {
  return Boolean(getEncryptionKey());
}

export function encryptSecret(value: string) {
  const key = getEncryptionKey();

  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is required to store user AI credentials.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string) {
  const key = getEncryptionKey();

  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is required to read user AI credentials.");
  }

  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function buildSecretHint(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const last4 = trimmed.slice(-4);
  return `••••${last4}`;
}

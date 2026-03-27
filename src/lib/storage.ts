import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const LOCAL_DOCUMENTS_DIRECTORY = path.join(process.cwd(), "public", "uploads", "documents");
const LOCAL_PUBLIC_PREFIX = "/uploads/documents/";
const DEFAULT_STORAGE_PREFIX = "frg-builder";
const S3_SCHEME = "s3://";

type StorageDriver = "local" | "s3";

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getStorageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

function getStoragePrefix() {
  return (process.env.STORAGE_PREFIX || DEFAULT_STORAGE_PREFIX).replace(/^\/+|\/+$/g, "");
}

function createObjectName(originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  const originalBaseName = path.basename(originalName, extension);
  const safeName = sanitizeFileName(originalBaseName || "document");
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}${extension}`;
}

function createDocumentStoragePath(fileName: string) {
  return `${getStoragePrefix()}/documents/${fileName}`;
}

function getStoragePublicBaseUrl() {
  return process.env.STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, "") || "";
}

function getSignedUrlTtlSeconds() {
  const rawValue = Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS || 900);
  return Number.isFinite(rawValue) ? Math.max(60, Math.min(rawValue, 60 * 60 * 24)) : 900;
}

function getS3Client() {
  const region = process.env.STORAGE_REGION;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 storage requires STORAGE_REGION, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY."
    );
  }

  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

function parseStoredPath(storedPath: string) {
  if (storedPath.startsWith(S3_SCHEME)) {
    return {
      driver: "s3" as const,
      key: storedPath.slice(S3_SCHEME.length),
    };
  }

  return {
    driver: "local" as const,
    localPath: storedPath,
  };
}

function resolveLocalDiskPath(localPath: string) {
  if (!localPath.startsWith(LOCAL_PUBLIC_PREFIX)) {
    throw new Error("Unsupported local storage path.");
  }

  return path.join(process.cwd(), "public", localPath.replace(/^\/+/, ""));
}

export function isConfiguredForObjectStorage() {
  return getStorageDriver() === "s3";
}

export async function storeDocumentUpload(input: {
  originalName: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const fileName = createObjectName(input.originalName);

  if (getStorageDriver() === "s3") {
    const objectKey = createDocumentStoragePath(fileName);
    const { bucket, client } = getS3Client();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.contentType || "application/octet-stream",
      })
    );

    return {
      path: `${S3_SCHEME}${objectKey}`,
    };
  }

  await mkdir(LOCAL_DOCUMENTS_DIRECTORY, { recursive: true });
  const publicPath = `${LOCAL_PUBLIC_PREFIX}${fileName}`;
  await writeFile(path.join(LOCAL_DOCUMENTS_DIRECTORY, fileName), input.buffer);

  return {
    path: publicPath,
  };
}

export async function loadStoredFileBuffer(storedPath: string) {
  const parsed = parseStoredPath(storedPath);

  if (parsed.driver === "s3") {
    const { bucket, client } = getS3Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: parsed.key,
      })
    );

    if (!response.Body) {
      throw new Error("Stored object body is empty.");
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  return readFile(resolveLocalDiskPath(parsed.localPath));
}

export async function deleteStoredFile(storedPath: string) {
  const parsed = parseStoredPath(storedPath);

  if (parsed.driver === "s3") {
    const { bucket, client } = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: parsed.key,
      })
    );
    return;
  }

  await unlink(resolveLocalDiskPath(parsed.localPath)).catch(() => undefined);
}

export async function resolveStoredFileAccessUrl(storedPath: string) {
  const parsed = parseStoredPath(storedPath);

  if (parsed.driver === "s3") {
    const publicBaseUrl = getStoragePublicBaseUrl();
    if (publicBaseUrl) {
      return `${publicBaseUrl}/${parsed.key}`;
    }

    const { bucket, client } = getS3Client();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: parsed.key,
      }),
      { expiresIn: getSignedUrlTtlSeconds() }
    );
  }

  return parsed.localPath;
}

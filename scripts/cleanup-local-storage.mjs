import { PrismaClient } from "@prisma/client";
import { readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const uploadsDirectory = path.join(process.cwd(), "public", "uploads", "documents");
const maxAgeHours = Number(process.env.LOCAL_STORAGE_CLEANUP_MIN_AGE_HOURS || 24);
const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;

try {
  if (!existsSync(uploadsDirectory)) {
    console.log("[cleanup] No local uploads directory found.");
    process.exit(0);
  }

  const documents = await prisma.document.findMany({
    select: {
      path: true,
    },
  });

  const referencedPaths = new Set(
    documents
      .map((document) => document.path)
      .filter((storedPath) => storedPath.startsWith("/uploads/documents/"))
      .map((storedPath) => path.join(process.cwd(), "public", storedPath.replace(/^\/+/, "")))
  );

  const files = await readdir(uploadsDirectory);
  let removed = 0;
  let skipped = 0;

  for (const file of files) {
    const absolutePath = path.join(uploadsDirectory, file);

    if (referencedPaths.has(absolutePath)) {
      skipped += 1;
      continue;
    }

    const metadata = await stat(absolutePath);
    if (metadata.mtimeMs > cutoffTime) {
      skipped += 1;
      continue;
    }

    await rm(absolutePath, { force: true });
    removed += 1;
  }

  console.log(
    `[cleanup] Local storage cleanup complete. Removed ${removed} orphaned files, skipped ${skipped}.`
  );
} finally {
  await prisma.$disconnect();
}

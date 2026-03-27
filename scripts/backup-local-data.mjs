import { copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createEnvReader, resolveSqliteDatabasePath } from "./env-utils.mjs";

const root = process.cwd();
const getEnv = createEnvReader(root);
const databaseUrl = getEnv("DATABASE_URL");
const sqlitePath = resolveSqliteDatabasePath(databaseUrl, root);

if (!sqlitePath) {
  console.error("[backup] Local backup only supports SQLite DATABASE_URL values.");
  process.exit(1);
}

const uploadsDirectory = path.join(root, "public", "uploads", "documents");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDirectory = path.join(root, "backups", "local", timestamp);

await mkdir(backupDirectory, { recursive: true });

if (existsSync(sqlitePath)) {
  await copyFile(sqlitePath, path.join(backupDirectory, path.basename(sqlitePath)));
}

if (existsSync(uploadsDirectory)) {
  await cp(uploadsDirectory, path.join(backupDirectory, "documents"), {
    recursive: true,
  });
}

await writeFile(
  path.join(backupDirectory, "manifest.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      databaseUrl,
      sqlitePath,
      uploadsIncluded: existsSync(uploadsDirectory),
    },
    null,
    2
  )
);

console.log(`[backup] Local backup created at ${backupDirectory}`);

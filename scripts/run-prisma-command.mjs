import { spawnSync } from "node:child_process";

const env = { ...process.env };

if (!env.DATABASE_URL && env.NETLIFY_DATABASE_URL) {
  env.DATABASE_URL = env.NETLIFY_DATABASE_URL;
}

if (!env.DIRECT_URL) {
  env.DIRECT_URL =
    env.NETLIFY_DATABASE_URL_UNPOOLED || env.DATABASE_URL || env.NETLIFY_DATABASE_URL || "";
}

if (!env.DATABASE_URL && env.NETLIFY === "true") {
  env.DATABASE_URL = "postgresql://build:build@127.0.0.1:5432/frg_builder?schema=public";
}

if (!env.DIRECT_URL && env.DATABASE_URL) {
  env.DIRECT_URL = env.DATABASE_URL;
}

const result = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env,
});

process.exit(result.status ?? 1);

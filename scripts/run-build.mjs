import { spawnSync } from "node:child_process";

const env = { ...process.env };
let usingTemporaryBuildDatabase = false;

if (!env.DATABASE_URL && env.NETLIFY_DATABASE_URL) {
  env.DATABASE_URL = env.NETLIFY_DATABASE_URL;
}

if (!env.DIRECT_URL) {
  env.DIRECT_URL =
    env.NETLIFY_DATABASE_URL_UNPOOLED || env.DATABASE_URL || env.NETLIFY_DATABASE_URL || "";
}

if (!env.DATABASE_URL && env.NETLIFY === "true") {
  env.DATABASE_URL = "postgresql://build:build@127.0.0.1:5432/frg_builder?schema=public";
  env.DIRECT_URL = env.DATABASE_URL;
  usingTemporaryBuildDatabase = true;
  console.warn(
    "[build] Injected temporary Postgres DATABASE_URL for Netlify build only. Connect Netlify DB/Neon or configure a real DATABASE_URL for runtime."
  );
}

const prismaGenerate = spawnSync("node", ["scripts/run-prisma-command.mjs", "generate"], {
  stdio: "inherit",
  shell: true,
  env,
});

if (prismaGenerate.status !== 0) {
  process.exit(prismaGenerate.status ?? 1);
}

if (env.NETLIFY === "true" && !usingTemporaryBuildDatabase) {
  const prismaPush = spawnSync("node", ["scripts/run-prisma-command.mjs", "db", "push"], {
    stdio: "inherit",
    shell: true,
    env,
  });

  if (prismaPush.status !== 0) {
    process.exit(prismaPush.status ?? 1);
  }
}

const nextBuild = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env,
});

if (nextBuild.status !== 0) {
  process.exit(nextBuild.status ?? 1);
}

const prepareStandalone = spawnSync("node", ["scripts/prepare-standalone.mjs"], {
  stdio: "inherit",
  shell: true,
  env,
});

process.exit(prepareStandalone.status ?? 0);

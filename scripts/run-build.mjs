import { spawnSync } from "node:child_process";

const env = { ...process.env };

if (!env.DATABASE_URL && env.NETLIFY === "true") {
  env.DATABASE_URL = "file:../db/netlify-build.db";
  console.warn(
    "[build] Injected temporary SQLite DATABASE_URL for Netlify build only. Configure a real DATABASE_URL in Netlify environment variables for runtime."
  );
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

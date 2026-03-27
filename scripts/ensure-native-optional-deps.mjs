import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const packages = ["@tailwindcss/oxide", "lightningcss"];

for (const pkg of packages) {
  const result = spawnSync(npmCommand, ["rebuild", pkg, "--update-binary"], {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    console.warn(`[postinstall] Optional native rebuild skipped for ${pkg}.`);
  }
}

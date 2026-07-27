import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = realpathSync(process.cwd());
const vitestEntry = resolve(projectRoot, "node_modules/vitest/vitest.mjs");
const result = spawnSync(
  process.execPath,
  [vitestEntry, "run", ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);

// Passes an explicit file list to `node --test` instead of a glob string:
// Node's --test only gained native glob support in v22, and this project's
// engines field allows Node 20, so relying on it would break there.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(projectRoot, "test");

const testFiles = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => path.join("test", name));

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  cwd: projectRoot,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

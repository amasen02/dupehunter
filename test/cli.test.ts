import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { withTempDir, writeFileAt } from "./helpers.js";

const CLI_ENTRY = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts");

interface CliResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

async function runCli(args: string[], options: { cwd?: string; input?: string } = {}): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", CLI_ENTRY, ...args], {
      cwd: options.cwd,
      env: { ...process.env, NO_COLOR: "1" },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });

    if (options.input !== undefined) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}

void test("cli: --help prints usage and exits 0", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage:/);
});

void test("cli: --version prints a semver-looking string and exits 0", async () => {
  const result = await runCli(["--version"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+/);
});

void test("cli: an invalid flag exits 1 with a message on stderr", async () => {
  const result = await runCli(["--not-a-real-flag"]);
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /dupehunter:/);
});

void test("cli: --delete and --hardlink together exits 1", async () => {
  const result = await runCli(["--delete", "--hardlink"]);
  assert.equal(result.exitCode, 1);
});

void test("cli: scanning a directory with no duplicates exits 0", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "unique a");
    await writeFileAt(dir, "b.txt", "unique b");

    const result = await runCli([dir]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /No duplicate files found/);
  });
});

void test("cli: --json emits parseable JSON describing the duplicate groups", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "same");
    await writeFileAt(dir, "b.txt", "same");

    const result = await runCli([dir, "--json"]);
    assert.equal(result.exitCode, 0);

    const parsed: unknown = JSON.parse(result.stdout);
    assert.ok(typeof parsed === "object" && parsed !== null);
    const report = parsed as { groups: unknown[]; filesScanned: number };
    assert.equal(report.groups.length, 1);
    assert.equal(report.filesScanned, 2);
  });
});

void test("cli: --delete without --yes on a non-TTY stdin aborts without deleting", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "same");
    await writeFileAt(dir, "b.txt", "same");

    const result = await runCli([dir, "--delete"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Aborted/);

    const verify = await runCli([dir, "--json"]);
    const report = JSON.parse(verify.stdout) as { groups: unknown[] };
    assert.equal(report.groups.length, 1);
  });
});

void test("cli: --delete --yes actually deletes duplicates, keeping one copy", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "same");
    await writeFileAt(dir, "b.txt", "same");

    const result = await runCli([dir, "--delete", "--yes", "--keep", "first"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /1 file\(s\) deleted successfully/);

    const verify = await runCli([dir, "--json"]);
    const report = JSON.parse(verify.stdout) as { groups: unknown[]; filesScanned: number };
    assert.equal(report.groups.length, 0);
    assert.equal(report.filesScanned, 1);
  });
});

void test("cli: --delete --dry-run leaves files untouched", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "same");
    await writeFileAt(dir, "b.txt", "same");

    const result = await runCli([dir, "--delete", "--dry-run", "--yes"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /dry run/);

    const verify = await runCli([dir, "--json"]);
    const report = JSON.parse(verify.stdout) as { groups: unknown[] };
    assert.equal(report.groups.length, 1);
  });
});

void test("cli: scanning a non-existent directory reports a warning instead of crashing", async () => {
  await withTempDir(async (dir) => {
    const result = await runCli([path.join(dir, "does-not-exist-either")]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /No duplicate files found/);
    assert.match(result.stdout, /could not be read/);
  });
});

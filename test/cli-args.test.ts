import assert from "node:assert/strict";
import { test } from "node:test";
import { CliArgError, DEFAULT_EXCLUDES, parseCliArgs } from "../src/cli-args.js";

void test("parseCliArgs: applies sensible defaults with no arguments", () => {
  const options = parseCliArgs([]);
  assert.equal(options.rootDir, process.cwd());
  assert.equal(options.minSizeBytes, 1);
  assert.equal(options.followSymlinks, false);
  assert.deepEqual(options.excludeGlobs, DEFAULT_EXCLUDES);
  assert.equal(options.json, false);
  assert.equal(options.delete, false);
  assert.equal(options.hardlink, false);
  assert.equal(options.keepPolicy, "oldest");
  assert.equal(options.assumeYes, false);
  assert.equal(options.dryRun, false);
});

void test("parseCliArgs: accepts a bare positional as the directory", () => {
  const options = parseCliArgs(["/some/dir"]);
  assert.equal(options.rootDir, "/some/dir");
});

void test("parseCliArgs: --dir works when no positional is given", () => {
  const options = parseCliArgs(["--dir", "/via/flag"]);
  assert.equal(options.rootDir, "/via/flag");
});

void test("parseCliArgs: a positional directory takes precedence over --dir", () => {
  const options = parseCliArgs(["/positional/dir", "--dir", "/via/flag"]);
  assert.equal(options.rootDir, "/positional/dir");
});

void test("parseCliArgs: --min-size parses human sizes", () => {
  const options = parseCliArgs(["--min-size", "10KB"]);
  assert.equal(options.minSizeBytes, 10 * 1024);
});

void test("parseCliArgs: --include-empty forces minSizeBytes to 0", () => {
  const options = parseCliArgs(["--include-empty"]);
  assert.equal(options.minSizeBytes, 0);
});

void test("parseCliArgs: --exclude is additive to the always-on defaults", () => {
  const options = parseCliArgs(["--exclude", "*.log", "--exclude", "dist"]);
  assert.deepEqual(options.excludeGlobs, [...DEFAULT_EXCLUDES, "*.log", "dist"]);
});

void test("parseCliArgs: --concurrency parses a positive integer", () => {
  const options = parseCliArgs(["--concurrency", "8"]);
  assert.equal(options.concurrency, 8);
});

void test("parseCliArgs: rejects a non-positive --concurrency", () => {
  assert.throws(() => parseCliArgs(["--concurrency", "0"]), CliArgError);
  assert.throws(() => parseCliArgs(["--concurrency", "-1"]), CliArgError);
  assert.throws(() => parseCliArgs(["--concurrency", "abc"]), CliArgError);
});

void test("parseCliArgs: rejects an invalid --keep policy", () => {
  assert.throws(() => parseCliArgs(["--keep", "bogus"]), CliArgError);
});

void test("parseCliArgs: accepts every valid --keep policy", () => {
  for (const policy of ["first", "oldest", "newest"]) {
    assert.equal(parseCliArgs(["--keep", policy]).keepPolicy, policy);
  }
});

void test("parseCliArgs: rejects combining --delete and --hardlink", () => {
  assert.throws(() => parseCliArgs(["--delete", "--hardlink"]), CliArgError);
});

void test("parseCliArgs: rejects an invalid --min-size", () => {
  assert.throws(() => parseCliArgs(["--min-size", "not-a-size"]), CliArgError);
});

void test("parseCliArgs: rejects an unknown flag", () => {
  assert.throws(() => parseCliArgs(["--not-a-real-flag"]), CliArgError);
});

void test("parseCliArgs: --help short-circuits other validation", () => {
  const options = parseCliArgs(["--help", "--concurrency", "not-a-number"]);
  assert.equal(options.help, true);
});

void test("parseCliArgs: -h and -y short flags work", () => {
  assert.equal(parseCliArgs(["-h"]).help, true);
  assert.equal(parseCliArgs(["-y"]).assumeYes, true);
});

void test("parseCliArgs: --json, --delete, --hardlink, --dry-run, --follow-symlinks flags toggle on", () => {
  assert.equal(parseCliArgs(["--json"]).json, true);
  assert.equal(parseCliArgs(["--delete"]).delete, true);
  assert.equal(parseCliArgs(["--hardlink"]).hardlink, true);
  assert.equal(parseCliArgs(["--dry-run"]).dryRun, true);
  assert.equal(parseCliArgs(["--follow-symlinks"]).followSymlinks, true);
});

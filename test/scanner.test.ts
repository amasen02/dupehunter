import assert from "node:assert/strict";
import { symlink } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { walkDirectory } from "../src/scanner.js";
import { withTempDir, writeFileAt } from "./helpers.js";

const NO_EXCLUDES: readonly string[] = [];

void test("walkDirectory: finds files recursively across nested directories", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "a");
    await writeFileAt(dir, "sub/b.txt", "b");
    await writeFileAt(dir, "sub/deeper/c.txt", "c");

    const { files, warnings } = await walkDirectory(dir, {
      followSymlinks: false,
      excludeGlobs: NO_EXCLUDES,
    });

    assert.deepEqual(warnings, []);
    const relativePaths = files.map((file) => path.relative(dir, file.filePath)).sort();
    assert.deepEqual(relativePaths, [path.join("sub", "b.txt"), path.join("sub", "deeper", "c.txt"), "a.txt"].sort());
  });
});

void test("walkDirectory: reports accurate size and mtime for each file", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "hello");

    const { files } = await walkDirectory(dir, { followSymlinks: false, excludeGlobs: NO_EXCLUDES });

    assert.equal(files.length, 1);
    const [file] = files;
    assert.ok(file);
    assert.equal(file.sizeBytes, 5);
    assert.ok(file.modifiedAtMs > 0);
  });
});

void test("walkDirectory: excludes directories and files matching exclude patterns", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "keep.txt", "keep");
    await writeFileAt(dir, "node_modules/pkg/index.js", "skip");
    await writeFileAt(dir, "debug.tmp", "skip");

    const { files } = await walkDirectory(dir, {
      followSymlinks: false,
      excludeGlobs: ["node_modules", "*.tmp"],
    });

    const relativePaths = files.map((file) => path.relative(dir, file.filePath));
    assert.deepEqual(relativePaths, ["keep.txt"]);
  });
});

void test("walkDirectory: records a warning instead of throwing when a subdirectory is unreadable", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "a");

    const { files, warnings } = await walkDirectory(path.join(dir, "does-not-exist"), {
      followSymlinks: false,
      excludeGlobs: NO_EXCLUDES,
    });

    assert.deepEqual(files, []);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.path, path.join(dir, "does-not-exist"));
  });
});

void test("walkDirectory: does not follow symlinked directories by default", async (t) => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "real/inside.txt", "inside");

    try {
      await symlink(path.join(dir, "real"), path.join(dir, "link"), "junction");
    } catch {
      t.skip("symlink creation not permitted in this environment");
      return;
    }

    const { files } = await walkDirectory(dir, { followSymlinks: false, excludeGlobs: NO_EXCLUDES });
    const relativePaths = files.map((file) => path.relative(dir, file.filePath));
    assert.deepEqual(relativePaths, [path.join("real", "inside.txt")]);
  });
});

void test("walkDirectory: follows symlinked directories when enabled, without infinite looping", async (t) => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "real/inside.txt", "inside");

    try {
      await symlink(path.join(dir, "real"), path.join(dir, "link"), "junction");
      await symlink(dir, path.join(dir, "real", "cycle"), "junction");
    } catch {
      t.skip("symlink creation not permitted in this environment");
      return;
    }

    const { files } = await walkDirectory(dir, { followSymlinks: true, excludeGlobs: NO_EXCLUDES });
    const relativePaths = new Set(files.map((file) => path.relative(dir, file.filePath)));

    assert.ok(relativePaths.has(path.join("real", "inside.txt")));
    assert.ok(relativePaths.has(path.join("link", "inside.txt")));
  });
});

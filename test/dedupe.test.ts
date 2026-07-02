import assert from "node:assert/strict";
import { link } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { findDuplicates } from "../src/dedupe.js";
import type { DuplicateGroup, ScanOptions } from "../src/types.js";
import { withTempDir, writeFileAt } from "./helpers.js";

const BASE_OPTIONS: Omit<ScanOptions, "rootDir"> = {
  minSizeBytes: 1,
  followSymlinks: false,
  excludeGlobs: [],
  concurrency: 4,
};

function allPaths(dir: string, group: DuplicateGroup): string[] {
  return group.files.flatMap((file) => file.paths).map((filePath) => path.relative(dir, filePath));
}

void test("findDuplicates: groups files with identical content", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "same content");
    await writeFileAt(dir, "b.txt", "same content");
    await writeFileAt(dir, "unique.txt", "one of a kind");

    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir });

    assert.equal(report.groups.length, 1);
    const group = report.groups[0];
    assert.ok(group);
    assert.equal(group.files.length, 2);
    assert.deepEqual(allPaths(dir, group).sort(), ["a.txt", "b.txt"]);
  });
});

void test("findDuplicates: files with the same size but different content are not grouped", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "aaaaa");
    await writeFileAt(dir, "b.txt", "bbbbb");

    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir });
    assert.equal(report.groups.length, 0);
  });
});

void test("findDuplicates: excludes zero-byte files by default", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "empty1.txt", "");
    await writeFileAt(dir, "empty2.txt", "");

    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir });
    assert.equal(report.groups.length, 0);
    assert.equal(report.filesScanned, 0);
  });
});

void test("findDuplicates: includes zero-byte files when minSizeBytes is 0", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "empty1.txt", "");
    await writeFileAt(dir, "empty2.txt", "");

    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir, minSizeBytes: 0 });
    assert.equal(report.groups.length, 1);
    assert.equal(report.groups[0]?.files.length, 2);
  });
});

void test("findDuplicates: respects minSizeBytes threshold", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "small1.txt", "hi");
    await writeFileAt(dir, "small2.txt", "hi");
    await writeFileAt(dir, "big1.txt", "much longer content here");
    await writeFileAt(dir, "big2.txt", "much longer content here");

    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir, minSizeBytes: 10 });

    assert.equal(report.groups.length, 1);
    const group = report.groups[0];
    assert.ok(group);
    assert.deepEqual(allPaths(dir, group).sort(), ["big1.txt", "big2.txt"]);
  });
});

void test("findDuplicates: an already-hardlinked pair collapses into one physical file with two paths", async (t) => {
  await withTempDir(async (dir) => {
    const original = await writeFileAt(dir, "original.txt", "shared content");
    const linkPath = path.join(dir, "hardlink.txt");

    try {
      await link(original, linkPath);
    } catch {
      t.skip("hardlink creation not permitted in this environment");
      return;
    }
    await writeFileAt(dir, "separate-copy.txt", "shared content");

    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir });

    assert.equal(report.groups.length, 1);
    const group = report.groups[0];
    assert.ok(group);
    assert.equal(group.files.length, 2);

    const physicalFileWithTwoPaths = group.files.find((file) => file.paths.length === 2);
    assert.ok(physicalFileWithTwoPaths, "expected the hardlinked pair to collapse into one physical file");
    assert.deepEqual(
      physicalFileWithTwoPaths.paths.map((p) => path.relative(dir, p)).sort(),
      ["hardlink.txt", "original.txt"],
    );
  });
});

void test("findDuplicates: reclaimable space accounts for existing hardlinks, not raw path count", async (t) => {
  await withTempDir(async (dir) => {
    const original = await writeFileAt(dir, "original.txt", "shared content!!");
    try {
      await link(original, path.join(dir, "hardlink.txt"));
    } catch {
      t.skip("hardlink creation not permitted in this environment");
      return;
    }
    await writeFileAt(dir, "separate-copy.txt", "shared content!!");

    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir });
    const group = report.groups[0];
    assert.ok(group);
    // 2 physical files of this size exist (the hardlinked pair counts once); reclaiming keeps 1, frees 1x size.
    const reclaimable = group.sizeBytes * (group.files.length - 1);
    assert.equal(reclaimable, group.sizeBytes);
  });
});

void test("findDuplicates: ignores excluded directories", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "node_modules/pkg/a.txt", "dup");
    await writeFileAt(dir, "b.txt", "dup");

    const report = await findDuplicates({
      ...BASE_OPTIONS,
      rootDir: dir,
      excludeGlobs: ["node_modules"],
    });

    assert.equal(report.groups.length, 0);
    assert.equal(report.filesScanned, 1);
  });
});

void test("findDuplicates: three-way duplicate group and unrelated singletons", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "1.txt", "triplet");
    await writeFileAt(dir, "2.txt", "triplet");
    await writeFileAt(dir, "3.txt", "triplet");
    await writeFileAt(dir, "solo.txt", "alone");

    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir });

    assert.equal(report.groups.length, 1);
    assert.equal(report.groups[0]?.files.length, 3);
    assert.equal(report.filesScanned, 4);
  });
});

void test("findDuplicates: empty directory yields no groups and zero counts", async () => {
  await withTempDir(async (dir) => {
    const report = await findDuplicates({ ...BASE_OPTIONS, rootDir: dir });
    assert.deepEqual(report.groups, []);
    assert.equal(report.filesScanned, 0);
    assert.equal(report.bytesScanned, 0);
  });
});

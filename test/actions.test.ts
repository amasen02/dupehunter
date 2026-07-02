import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  chooseFileToKeep,
  deleteDuplicates,
  hardlinkDuplicates,
  planActions,
} from "../src/actions.js";
import { findDuplicates } from "../src/dedupe.js";
import type { PhysicalFile } from "../src/types.js";
import { withTempDir, writeFileAt } from "./helpers.js";

function physicalFile(overrides: Partial<PhysicalFile>): PhysicalFile {
  return {
    paths: ["/tmp/a"],
    sizeBytes: 10,
    device: 1,
    inode: 1,
    modifiedAtMs: 0,
    ...overrides,
  };
}

void test("chooseFileToKeep: 'oldest' picks the file with the smallest mtime", () => {
  const files = [
    physicalFile({ paths: ["/a"], modifiedAtMs: 200 }),
    physicalFile({ paths: ["/b"], modifiedAtMs: 100 }),
    physicalFile({ paths: ["/c"], modifiedAtMs: 300 }),
  ];
  assert.deepEqual(chooseFileToKeep(files, "oldest").paths, ["/b"]);
});

void test("chooseFileToKeep: 'newest' picks the file with the largest mtime", () => {
  const files = [
    physicalFile({ paths: ["/a"], modifiedAtMs: 200 }),
    physicalFile({ paths: ["/b"], modifiedAtMs: 100 }),
    physicalFile({ paths: ["/c"], modifiedAtMs: 300 }),
  ];
  assert.deepEqual(chooseFileToKeep(files, "newest").paths, ["/c"]);
});

void test("chooseFileToKeep: 'first' picks the alphabetically-first primary path", () => {
  const files = [physicalFile({ paths: ["/z"] }), physicalFile({ paths: ["/a"] })];
  assert.deepEqual(chooseFileToKeep(files, "first").paths, ["/a"]);
});

void test("chooseFileToKeep: throws on an empty group", () => {
  assert.throws(() => chooseFileToKeep([], "oldest"), RangeError);
});

void test("planActions: reclaimableBytes equals size times the number of removed files", () => {
  const group = {
    hash: "abc",
    sizeBytes: 100,
    files: [
      physicalFile({ paths: ["/a"], modifiedAtMs: 1 }),
      physicalFile({ paths: ["/b"], modifiedAtMs: 2 }),
      physicalFile({ paths: ["/c"], modifiedAtMs: 3 }),
    ],
  };

  const [plan] = planActions([group], "oldest");
  assert.ok(plan);
  assert.deepEqual(plan.keep.paths, ["/a"]);
  assert.equal(plan.remove.length, 2);
  assert.equal(plan.reclaimableBytes, 200);
});

void test("deleteDuplicates: removes every path of every non-kept physical file, keeps the chosen one", async () => {
  await withTempDir(async (dir) => {
    await writeFileAt(dir, "a.txt", "dup");
    await writeFileAt(dir, "b.txt", "dup");
    await writeFileAt(dir, "c.txt", "dup");

    const report = await findDuplicates({
      rootDir: dir,
      minSizeBytes: 1,
      followSymlinks: false,
      excludeGlobs: [],
      concurrency: 4,
    });
    const actions = planActions(report.groups, "first");

    const outcomes = await deleteDuplicates(actions);
    assert.equal(outcomes.filter((o) => o.error === undefined).length, 2);

    const keptPath = path.join(dir, "a.txt");
    await assert.doesNotReject(() => stat(keptPath));
    await assert.rejects(() => stat(path.join(dir, "b.txt")));
    await assert.rejects(() => stat(path.join(dir, "c.txt")));
  });
});

void test("deleteDuplicates: records a failure outcome instead of throwing when unlink fails", async () => {
  await withTempDir(async (dir) => {
    const missingPath = path.join(dir, "missing.txt");
    const action = {
      group: { hash: "x", sizeBytes: 1, files: [] },
      keep: physicalFile({ paths: [path.join(dir, "kept.txt")] }),
      remove: [physicalFile({ paths: [missingPath] })],
      reclaimableBytes: 1,
    };

    const outcomes = await deleteDuplicates([action]);
    assert.equal(outcomes.length, 1);
    const [outcome] = outcomes;
    assert.ok(outcome);
    assert.equal(outcome.path, missingPath);
    assert.ok(outcome.error);
  });
});

void test("hardlinkDuplicates: replaces duplicates with hardlinks that share the kept file's content and inode", async (t) => {
  await withTempDir(async (dir) => {
    const keptPath = await writeFileAt(dir, "a.txt", "dup content");
    const removedPath = await writeFileAt(dir, "b.txt", "dup content");

    const action = {
      group: { hash: "x", sizeBytes: 12, files: [] },
      keep: physicalFile({ paths: [keptPath] }),
      remove: [physicalFile({ paths: [removedPath] })],
      reclaimableBytes: 12,
    };

    const outcomes = await hardlinkDuplicates([action]);
    if (outcomes[0]?.error?.includes("EPERM") === true) {
      t.skip("hardlink creation not permitted in this environment");
      return;
    }
    assert.equal(outcomes[0]?.error, undefined);

    const [keptStat, removedStat] = await Promise.all([stat(keptPath), stat(removedPath)]);
    assert.equal(keptStat.ino, removedStat.ino);
    assert.equal(await readFile(removedPath, "utf8"), "dup content");
  });
});

void test("hardlinkDuplicates: leaves the original file untouched if linking fails", async () => {
  await withTempDir(async (dir) => {
    const removedPath = await writeFileAt(dir, "b.txt", "still here");
    const action = {
      group: { hash: "x", sizeBytes: 1, files: [] },
      keep: physicalFile({ paths: [path.join(dir, "does-not-exist.txt")] }),
      remove: [physicalFile({ paths: [removedPath] })],
      reclaimableBytes: 1,
    };

    const outcomes = await hardlinkDuplicates([action]);
    assert.ok(outcomes[0]?.error);
    assert.equal(await readFile(removedPath, "utf8"), "still here");
  });
});

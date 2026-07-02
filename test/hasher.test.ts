import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { HASH_ALGORITHM, hashFile } from "../src/hasher.js";
import { withTempDir, writeFileAt } from "./helpers.js";

void test("hashFile: matches a direct sha256 digest of the same content", async () => {
  await withTempDir(async (dir) => {
    const content = "the quick brown fox jumps over the lazy dog";
    const filePath = await writeFileAt(dir, "file.txt", content);

    const expected = createHash(HASH_ALGORITHM).update(content).digest("hex");
    assert.equal(await hashFile(filePath), expected);
  });
});

void test("hashFile: identical content produces identical hashes", async () => {
  await withTempDir(async (dir) => {
    const a = await writeFileAt(dir, "a.txt", "same content");
    const b = await writeFileAt(dir, "b.txt", "same content");
    assert.equal(await hashFile(a), await hashFile(b));
  });
});

void test("hashFile: different content produces different hashes", async () => {
  await withTempDir(async (dir) => {
    const a = await writeFileAt(dir, "a.txt", "content a");
    const b = await writeFileAt(dir, "b.txt", "content b");
    assert.notEqual(await hashFile(a), await hashFile(b));
  });
});

void test("hashFile: hashes content spanning multiple stream chunks", async () => {
  await withTempDir(async (dir) => {
    const large = "x".repeat(5 * 1024 * 1024);
    const filePath = await writeFileAt(dir, "large.bin", large);

    const expected = createHash(HASH_ALGORITHM).update(large).digest("hex");
    assert.equal(await hashFile(filePath), expected);
  });
});

void test("hashFile: rejects when the file does not exist", async () => {
  await withTempDir(async (dir) => {
    await assert.rejects(() => hashFile(`${dir}/missing.txt`), /ENOENT/);
  });
});

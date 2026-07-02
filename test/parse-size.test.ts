import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSize } from "../src/parse-size.js";

void test("parseSize: bare number is bytes", () => {
  assert.equal(parseSize("0"), 0);
  assert.equal(parseSize("2048"), 2048);
});

void test("parseSize: recognizes each unit, case-insensitively", () => {
  assert.equal(parseSize("1B"), 1);
  assert.equal(parseSize("1kb"), 1024);
  assert.equal(parseSize("1KB"), 1024);
  assert.equal(parseSize("1mb"), 1024 ** 2);
  assert.equal(parseSize("1GB"), 1024 ** 3);
  assert.equal(parseSize("1tb"), 1024 ** 4);
});

void test("parseSize: supports decimal magnitudes", () => {
  assert.equal(parseSize("1.5MB"), Math.round(1.5 * 1024 ** 2));
});

void test("parseSize: tolerates whitespace between magnitude and unit, and surrounding", () => {
  assert.equal(parseSize("  10 KB  "), 10 * 1024);
});

void test("parseSize: rejects malformed input", () => {
  assert.throws(() => parseSize("abc"), /invalid size/);
  assert.throws(() => parseSize("10XB"), /invalid size/);
  assert.throws(() => parseSize(""), /invalid size/);
  assert.throws(() => parseSize("-5"), /invalid size/);
});

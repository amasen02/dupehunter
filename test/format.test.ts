import assert from "node:assert/strict";
import { test } from "node:test";
import { colorsEnabled, createColors, formatBytes } from "../src/format.js";

void test("formatBytes: renders sub-kilobyte values as whole bytes", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
});

void test("formatBytes: picks the largest unit that keeps the value >= 1", () => {
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
  assert.equal(formatBytes(1024 ** 3), "1 GB");
});

void test("formatBytes: shows one decimal place under 10 units, none at or above", () => {
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(15 * 1024), "15 KB");
});

void test("formatBytes: caps at petabytes for absurdly large inputs", () => {
  assert.match(formatBytes(1024 ** 6), /PB$/);
});

void test("colorsEnabled: NO_COLOR always disables, even on a TTY", () => {
  const stream = { isTTY: true } as NodeJS.WriteStream;
  assert.equal(colorsEnabled(stream, { NO_COLOR: "1" }), false);
});

void test("colorsEnabled: FORCE_COLOR enables even without a TTY", () => {
  const stream = { isTTY: false } as NodeJS.WriteStream;
  assert.equal(colorsEnabled(stream, { FORCE_COLOR: "1" }), true);
});

void test("colorsEnabled: FORCE_COLOR=0 does not force-enable", () => {
  const stream = { isTTY: false } as NodeJS.WriteStream;
  assert.equal(colorsEnabled(stream, { FORCE_COLOR: "0" }), false);
});

void test("colorsEnabled: falls back to the stream's TTY-ness", () => {
  assert.equal(colorsEnabled({ isTTY: true } as NodeJS.WriteStream, {}), true);
  assert.equal(colorsEnabled({ isTTY: false } as NodeJS.WriteStream, {}), false);
});

void test("createColors: disabled returns empty strings for every code", () => {
  const colors = createColors(false);
  for (const value of Object.values(colors)) {
    assert.equal(value, "");
  }
});

void test("createColors: enabled returns non-empty escape codes", () => {
  const colors = createColors(true);
  // AnsiCodes has no index signature, so Object.values falls back to `any[]`;
  // every field is a string by the interface, so this cast is safe.
  const values = Object.values(colors) as string[];
  for (const value of values) {
    assert.ok(value.length > 0);
  }
});

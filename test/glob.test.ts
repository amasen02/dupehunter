import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesAnyPattern } from "../src/glob.js";

void test("matchesAnyPattern: exact literal match is case-insensitive", () => {
  assert.equal(matchesAnyPattern("Node_Modules", ["node_modules"]), true);
  assert.equal(matchesAnyPattern("src", ["node_modules"]), false);
});

void test("matchesAnyPattern: * wildcard matches any run of characters", () => {
  assert.equal(matchesAnyPattern("report.tmp", ["*.tmp"]), true);
  assert.equal(matchesAnyPattern("report.tmp.bak", ["*.tmp"]), false);
  assert.equal(matchesAnyPattern("anything", ["*"]), true);
});

void test("matchesAnyPattern: ? wildcard matches exactly one character", () => {
  assert.equal(matchesAnyPattern("a.txt", ["?.txt"]), true);
  assert.equal(matchesAnyPattern("ab.txt", ["?.txt"]), false);
});

void test("matchesAnyPattern: returns false when patterns list is empty", () => {
  assert.equal(matchesAnyPattern("anything", []), false);
});

void test("matchesAnyPattern: matches if any pattern in the list matches", () => {
  assert.equal(matchesAnyPattern(".git", ["node_modules", ".git"]), true);
});

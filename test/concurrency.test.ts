import assert from "node:assert/strict";
import { test } from "node:test";
import { runWithConcurrencyLimit } from "../src/concurrency.js";

void test("runWithConcurrencyLimit: preserves input order regardless of completion order", async () => {
  const items = [30, 10, 20];
  const results = await runWithConcurrencyLimit(items, 3, async (delayMs) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return delayMs;
  });
  assert.deepEqual(results, [30, 10, 20]);
});

void test("runWithConcurrencyLimit: never runs more than `limit` tasks at once", async () => {
  let active = 0;
  let maxActive = 0;
  const items = Array.from({ length: 10 }, (_, index) => index);

  await runWithConcurrencyLimit(items, 3, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return item;
  });

  assert.ok(maxActive <= 3, `expected max 3 concurrent tasks, saw ${maxActive}`);
});

void test("runWithConcurrencyLimit: handles an empty input array", async () => {
  const results = await runWithConcurrencyLimit([], 4, (item) => Promise.resolve(item));
  assert.deepEqual(results, []);
});

void test("runWithConcurrencyLimit: handles limit greater than item count", async () => {
  const results = await runWithConcurrencyLimit([1, 2], 100, (item) => Promise.resolve(item * 2));
  assert.deepEqual(results, [2, 4]);
});

void test("runWithConcurrencyLimit: rejects a non-positive limit", async () => {
  await assert.rejects(() => runWithConcurrencyLimit([1], 0, (item) => Promise.resolve(item)), RangeError);
});

void test("runWithConcurrencyLimit: propagates a worker rejection", async () => {
  await assert.rejects(
    () =>
      runWithConcurrencyLimit([1, 2, 3], 2, (item) => {
        if (item === 2) {
          throw new Error("boom");
        }
        return Promise.resolve(item);
      }),
    /boom/,
  );
});

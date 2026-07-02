/**
 * Runs `tasks` with at most `limit` running concurrently, preserving the
 * input order in the returned results array.
 */
export async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit < 1) {
    throw new RangeError(`concurrency limit must be >= 1, got ${limit}`);
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const currentIndex = nextIndex++;
    if (currentIndex >= items.length) {
      return;
    }
    const item = items[currentIndex] as T;
    results[currentIndex] = await worker(item, currentIndex);
    await runNext();
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));

  return results;
}

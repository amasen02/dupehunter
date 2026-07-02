/**
 * Returns the first element of a non-empty array, throwing instead of
 * silently returning `undefined` when the caller's non-emptiness invariant
 * has been violated.
 */
export function firstOrThrow<T>(items: readonly T[], message = "expected a non-empty array"): T {
  const [first] = items;
  if (first === undefined) {
    throw new RangeError(message);
  }
  return first;
}

import type { PhysicalFile } from "./types.js";

/**
 * Returns the canonical path for a physical file (the first path it was
 * discovered at). Every `PhysicalFile` is constructed with at least one path,
 * so an empty `paths` array indicates a broken invariant rather than a
 * recoverable runtime condition.
 */
export function primaryPath(file: PhysicalFile): string {
  const [first] = file.paths;
  if (first === undefined) {
    throw new Error("invariant violated: PhysicalFile has no paths");
  }
  return first;
}

import { randomUUID } from "node:crypto";
import { link, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { firstOrThrow } from "./array-utils.js";
import { primaryPath } from "./physical-file.js";
import type { DuplicateGroup, KeepPolicy, PhysicalFile, PlannedAction } from "./types.js";

const POLICY_COMPARATORS: Record<KeepPolicy, (a: PhysicalFile, b: PhysicalFile) => number> = {
  first: (a, b) => primaryPath(a).localeCompare(primaryPath(b)),
  oldest: (a, b) => a.modifiedAtMs - b.modifiedAtMs,
  newest: (a, b) => b.modifiedAtMs - a.modifiedAtMs,
};

/** Picks which physical file in a duplicate group to keep, per the given policy. */
export function chooseFileToKeep(files: readonly PhysicalFile[], policy: KeepPolicy): PhysicalFile {
  return firstOrThrow(
    [...files].sort(POLICY_COMPARATORS[policy]),
    "cannot choose a file to keep from an empty group",
  );
}

/** Builds the set of planned removals for every duplicate group, without touching the filesystem. */
export function planActions(groups: readonly DuplicateGroup[], keepPolicy: KeepPolicy): PlannedAction[] {
  return groups.map((group) => {
    const keep = chooseFileToKeep(group.files, keepPolicy);
    const remove = group.files.filter((file) => file !== keep);
    return {
      group,
      keep,
      remove,
      reclaimableBytes: remove.length * group.sizeBytes,
    };
  });
}

export interface ActionOutcome {
  readonly path: string;
  readonly error?: string;
}

/** Deletes every path belonging to the removed physical files (all aliases, not just one). */
export async function deleteDuplicates(actions: readonly PlannedAction[]): Promise<ActionOutcome[]> {
  const outcomes: ActionOutcome[] = [];
  for (const action of actions) {
    for (const file of action.remove) {
      for (const filePath of file.paths) {
        try {
          await unlink(filePath);
          outcomes.push({ path: filePath });
        } catch (error) {
          outcomes.push({ path: filePath, error: describeError(error) });
        }
      }
    }
  }
  return outcomes;
}

/**
 * Replaces every path belonging to the removed physical files with a hardlink
 * to the kept file, freeing the duplicated disk space while preserving every
 * original path.
 *
 * Uses a link-to-temp-then-rename sequence so the original file is never
 * unlinked before its replacement hardlink exists — a failed `link()` leaves
 * the original file untouched instead of destroying data.
 */
export async function hardlinkDuplicates(actions: readonly PlannedAction[]): Promise<ActionOutcome[]> {
  const outcomes: ActionOutcome[] = [];
  for (const action of actions) {
    const keptPath = primaryPath(action.keep);
    for (const file of action.remove) {
      for (const filePath of file.paths) {
        const tempPath = path.join(path.dirname(filePath), `.dupehunter-${randomUUID()}.tmp`);
        try {
          await link(keptPath, tempPath);
          await rename(tempPath, filePath);
          outcomes.push({ path: filePath });
        } catch (error) {
          await unlink(tempPath).catch(() => undefined);
          outcomes.push({ path: filePath, error: describeError(error) });
        }
      }
    }
  }
  return outcomes;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

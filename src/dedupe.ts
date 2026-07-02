import { firstOrThrow } from "./array-utils.js";
import { runWithConcurrencyLimit } from "./concurrency.js";
import { hashFile } from "./hasher.js";
import { primaryPath } from "./physical-file.js";
import { walkDirectory, type ScannedFile, type WalkWarning } from "./scanner.js";
import type { DuplicateGroup, PhysicalFile, ScanOptions, ScanReport } from "./types.js";

const MIN_GROUP_SIZE_FOR_DUPLICATES = 2;

export interface FindDuplicatesResult extends ScanReport {
  readonly warnings: WalkWarning[];
}

export async function findDuplicates(options: ScanOptions): Promise<FindDuplicatesResult> {
  const { files, warnings } = await walkDirectory(options.rootDir, {
    followSymlinks: options.followSymlinks,
    excludeGlobs: options.excludeGlobs,
  });

  const eligibleFiles = files.filter((file) => file.sizeBytes >= options.minSizeBytes);
  const physicalFiles = collapseHardlinks(eligibleFiles);
  const sizeGroups = groupBy(physicalFiles, (file) => String(file.sizeBytes));

  const groups: DuplicateGroup[] = [];
  for (const candidates of sizeGroups.values()) {
    if (candidates.length < MIN_GROUP_SIZE_FOR_DUPLICATES) {
      continue;
    }
    groups.push(...(await hashAndGroupCandidates(candidates, options.concurrency)));
  }

  groups.sort((a, b) => b.sizeBytes * b.files.length - a.sizeBytes * a.files.length);

  return {
    groups,
    filesScanned: eligibleFiles.length,
    bytesScanned: eligibleFiles.reduce((sum, file) => sum + file.sizeBytes, 0),
    warnings,
  };
}

/** Collapses files that are already hardlinked together (same device+inode) into one PhysicalFile. */
function collapseHardlinks(files: readonly ScannedFile[]): PhysicalFile[] {
  const byIdentity = new Map<string, PhysicalFile & { paths: string[] }>();

  for (const file of files) {
    const key = `${file.device}:${file.inode}`;
    const existing = byIdentity.get(key);
    if (existing) {
      existing.paths.push(file.filePath);
      continue;
    }
    byIdentity.set(key, {
      paths: [file.filePath],
      sizeBytes: file.sizeBytes,
      device: file.device,
      inode: file.inode,
      modifiedAtMs: file.modifiedAtMs,
    });
  }

  return [...byIdentity.values()];
}

interface HashedFile {
  readonly file: PhysicalFile;
  readonly hash: string;
}

async function hashAndGroupCandidates(
  candidates: readonly PhysicalFile[],
  concurrency: number,
): Promise<DuplicateGroup[]> {
  const hashed = await runWithConcurrencyLimit(
    candidates,
    concurrency,
    async (file): Promise<HashedFile> => ({ file, hash: await hashFile(primaryPath(file)) }),
  );

  const byHash = new Map<string, PhysicalFile[]>();
  for (const { file, hash } of hashed) {
    const bucket = byHash.get(hash);
    if (bucket) {
      bucket.push(file);
    } else {
      byHash.set(hash, [file]);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [hash, groupFiles] of byHash) {
    if (groupFiles.length < MIN_GROUP_SIZE_FOR_DUPLICATES) {
      continue;
    }
    groups.push({ hash, sizeBytes: firstOrThrow(groupFiles).sizeBytes, files: groupFiles });
  }
  return groups;
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

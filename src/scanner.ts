import type { Stats } from "node:fs";
import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { matchesAnyPattern } from "./glob.js";

export interface ScannedFile {
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly device: number;
  readonly inode: number;
  readonly modifiedAtMs: number;
}

export interface WalkOptions {
  readonly followSymlinks: boolean;
  readonly excludeGlobs: readonly string[];
}

export interface WalkWarning {
  readonly path: string;
  readonly message: string;
}

export interface WalkResult {
  readonly files: ScannedFile[];
  readonly warnings: WalkWarning[];
}

/**
 * Recursively walks `rootDir`, returning every regular file found.
 * Directory/file names matching `excludeGlobs` are skipped entirely.
 * Symlinks are skipped unless `followSymlinks` is set, in which case
 * already-visited real directory paths are tracked to avoid symlink cycles.
 */
export async function walkDirectory(rootDir: string, options: WalkOptions): Promise<WalkResult> {
  const files: ScannedFile[] = [];
  const warnings: WalkWarning[] = [];
  const visitedRealDirs = new Set<string>();

  await walk(rootDir);
  return { files, warnings };

  async function walk(currentDir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      warnings.push({ path: currentDir, message: describeError(error) });
      return;
    }

    for (const entry of entries) {
      if (matchesAnyPattern(entry.name, options.excludeGlobs)) {
        continue;
      }

      const entryPath = path.join(currentDir, entry.name);

      if (entry.isSymbolicLink()) {
        if (options.followSymlinks) {
          await visitSymlink(entryPath);
        }
        continue;
      }

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isFile()) {
        await visitFile(entryPath);
      }
    }
  }

  /**
   * Resolves a symlink and dispatches to file/directory handling.
   *
   * Guards against infinite recursion by tracking the real path of every
   * symlinked directory already entered: re-encountering the same real
   * directory through another symlink stops that branch. This guarantees
   * termination but does not dedupe plain (non-symlink) directories reached
   * through different symlink chains, so a cyclic symlink layout can surface
   * the same underlying file at more than one path - harmless here since
   * `findDuplicates` already collapses same-file paths by device+inode.
   */
  async function visitSymlink(entryPath: string): Promise<void> {
    try {
      const real = await realpath(entryPath);
      const stats = await stat(real);
      if (stats.isDirectory()) {
        if (visitedRealDirs.has(real)) {
          return;
        }
        visitedRealDirs.add(real);
        await walk(entryPath);
      } else if (stats.isFile()) {
        visitFileStats(entryPath, stats);
      }
    } catch (error) {
      warnings.push({ path: entryPath, message: describeError(error) });
    }
  }

  async function visitFile(entryPath: string): Promise<void> {
    try {
      const stats = await stat(entryPath);
      visitFileStats(entryPath, stats);
    } catch (error) {
      warnings.push({ path: entryPath, message: describeError(error) });
    }
  }

  function visitFileStats(entryPath: string, stats: Stats): void {
    if (!stats.isFile()) {
      return;
    }
    files.push({
      filePath: entryPath,
      sizeBytes: stats.size,
      device: stats.dev,
      inode: stats.ino,
      modifiedAtMs: stats.mtimeMs,
    });
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

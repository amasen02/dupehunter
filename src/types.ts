export interface PhysicalFile {
  /** Every path on disk that resolves to this same physical file (i.e. existing hardlinks). */
  readonly paths: string[];
  readonly sizeBytes: number;
  readonly device: number;
  readonly inode: number;
  readonly modifiedAtMs: number;
}

export interface DuplicateGroup {
  readonly hash: string;
  readonly sizeBytes: number;
  readonly files: PhysicalFile[];
}

export interface ScanReport {
  readonly groups: DuplicateGroup[];
  readonly filesScanned: number;
  readonly bytesScanned: number;
}

export type KeepPolicy = "first" | "oldest" | "newest";

export interface ScanOptions {
  readonly rootDir: string;
  readonly minSizeBytes: number;
  readonly followSymlinks: boolean;
  readonly excludeGlobs: readonly string[];
  readonly concurrency: number;
}

export interface PlannedAction {
  readonly group: DuplicateGroup;
  readonly keep: PhysicalFile;
  readonly remove: PhysicalFile[];
  readonly reclaimableBytes: number;
}

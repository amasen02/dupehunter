export { chooseFileToKeep, deleteDuplicates, hardlinkDuplicates, planActions } from "./actions.js";
export type { ActionOutcome } from "./actions.js";
export { findDuplicates } from "./dedupe.js";
export type { FindDuplicatesResult } from "./dedupe.js";
export { formatBytes } from "./format.js";
export { hashFile, HASH_ALGORITHM } from "./hasher.js";
export { walkDirectory } from "./scanner.js";
export type { ScannedFile, WalkOptions, WalkResult, WalkWarning } from "./scanner.js";
export type {
  DuplicateGroup,
  KeepPolicy,
  PhysicalFile,
  PlannedAction,
  ScanOptions,
  ScanReport,
} from "./types.js";

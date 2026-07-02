import os from "node:os";
import { parseArgs } from "node:util";
import { parseSize } from "./parse-size.js";
import type { KeepPolicy } from "./types.js";

export const DEFAULT_EXCLUDES: readonly string[] = ["node_modules", ".git"];
const DEFAULT_MIN_SIZE_BYTES = 1;
const KEEP_POLICIES: readonly KeepPolicy[] = ["first", "oldest", "newest"];

export interface CliOptions {
  readonly rootDir: string;
  readonly minSizeBytes: number;
  readonly followSymlinks: boolean;
  readonly excludeGlobs: readonly string[];
  readonly concurrency: number;
  readonly json: boolean;
  readonly delete: boolean;
  readonly hardlink: boolean;
  readonly keepPolicy: KeepPolicy;
  readonly assumeYes: boolean;
  readonly dryRun: boolean;
  readonly help: boolean;
  readonly version: boolean;
}

export class CliArgError extends Error {}

function defaultConcurrency(): number {
  return typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
}

export function parseCliArgs(argv: readonly string[]): CliOptions {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        dir: { type: "string", short: "d" },
        "min-size": { type: "string" },
        "include-empty": { type: "boolean", default: false },
        "follow-symlinks": { type: "boolean", default: false },
        exclude: { type: "string", multiple: true, default: [] },
        concurrency: { type: "string" },
        json: { type: "boolean", default: false },
        delete: { type: "boolean", default: false },
        hardlink: { type: "boolean", default: false },
        keep: { type: "string", default: "oldest" },
        yes: { type: "boolean", short: "y", default: false },
        "dry-run": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
  } catch (error) {
    throw new CliArgError(error instanceof Error ? error.message : String(error));
  }

  const { values, positionals } = parsed;

  if (values.help || values.version) {
    return buildDefaults({ help: values.help, version: values.version });
  }

  if (values.delete && values.hardlink) {
    throw new CliArgError("--delete and --hardlink cannot be used together");
  }

  const keepPolicy = values.keep;
  if (!KEEP_POLICIES.includes(keepPolicy as KeepPolicy)) {
    throw new CliArgError(`--keep must be one of: ${KEEP_POLICIES.join(", ")} (got "${keepPolicy}")`);
  }

  const minSizeBytes = values["include-empty"] ? 0 : parseSizeOption(values["min-size"]);
  const concurrency = parseConcurrencyOption(values.concurrency);
  const rootDir = positionals[0] ?? values.dir ?? process.cwd();

  return {
    rootDir,
    minSizeBytes,
    followSymlinks: values["follow-symlinks"],
    excludeGlobs: [...DEFAULT_EXCLUDES, ...values.exclude],
    concurrency,
    json: values.json,
    delete: values.delete,
    hardlink: values.hardlink,
    keepPolicy: keepPolicy as KeepPolicy,
    assumeYes: values.yes,
    dryRun: values["dry-run"],
    help: false,
    version: false,
  };
}

function parseSizeOption(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_MIN_SIZE_BYTES;
  }
  try {
    return parseSize(raw);
  } catch (error) {
    throw new CliArgError(error instanceof Error ? error.message : String(error));
  }
}

function parseConcurrencyOption(raw: string | undefined): number {
  if (raw === undefined) {
    return defaultConcurrency();
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    throw new CliArgError(`--concurrency must be a positive integer (got "${raw}")`);
  }
  return value;
}

function buildDefaults(overrides: Partial<CliOptions>): CliOptions {
  return {
    rootDir: process.cwd(),
    minSizeBytes: DEFAULT_MIN_SIZE_BYTES,
    followSymlinks: false,
    excludeGlobs: DEFAULT_EXCLUDES,
    concurrency: defaultConcurrency(),
    json: false,
    delete: false,
    hardlink: false,
    keepPolicy: "oldest",
    assumeYes: false,
    dryRun: false,
    help: false,
    version: false,
    ...overrides,
  };
}

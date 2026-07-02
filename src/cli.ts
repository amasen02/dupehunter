#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { deleteDuplicates, hardlinkDuplicates, planActions, type ActionOutcome } from "./actions.js";
import { CliArgError, parseCliArgs } from "./cli-args.js";
import { findDuplicates } from "./dedupe.js";
import { colorsEnabled } from "./format.js";
import { renderPlanText, renderReportText, toJsonReport } from "./render.js";

const EXIT_SUCCESS = 0;
const EXIT_ARG_ERROR = 1;
const EXIT_RUNTIME_ERROR = 2;

const HELP_TEXT = `dupehunter - find and reclaim duplicate files

Usage:
  dupehunter [directory] [options]

Options:
  -d, --dir <path>          Directory to scan (default: current directory)
      --min-size <size>     Ignore files smaller than this (default: 1B), e.g. 10KB, 1.5MB
      --include-empty       Include zero-byte files (implies --min-size 0)
      --follow-symlinks     Follow symlinked files and directories
      --exclude <pattern>   Skip files/dirs matching a name pattern (repeatable).
                             Always excludes: node_modules, .git
      --concurrency <n>     Max files hashed in parallel (default: CPU count)
      --json                Print machine-readable JSON instead of text
      --delete              Delete duplicates, keeping one copy per group
      --hardlink            Replace duplicates with hardlinks to the kept copy
      --keep <policy>       Which copy to keep: first | oldest | newest (default: oldest)
  -y, --yes                 Skip the confirmation prompt for --delete/--hardlink
      --dry-run             Show what --delete/--hardlink would do, without changing anything
  -h, --help                Show this help text
  -v, --version             Show the installed version

Exit codes:
  0  ran successfully (regardless of whether duplicates were found)
  1  invalid command-line arguments
  2  a filesystem or runtime error prevented the scan from completing
`;

function readPackageVersion(): string {
  const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const contents = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(contents) as { version: string };
  return parsed.version;
}

async function confirmDestructiveAction(prompt: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${prompt} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function main(): Promise<number> {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CliArgError) {
      process.stderr.write(`dupehunter: ${error.message}\n`);
      return EXIT_ARG_ERROR;
    }
    throw error;
  }

  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return EXIT_SUCCESS;
  }

  if (options.version) {
    process.stdout.write(`${readPackageVersion()}\n`);
    return EXIT_SUCCESS;
  }

  let report;
  try {
    report = await findDuplicates(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`dupehunter: ${message}\n`);
    return EXIT_RUNTIME_ERROR;
  }

  const useColor = colorsEnabled(process.stdout, process.env);

  if (options.json && !options.delete && !options.hardlink) {
    process.stdout.write(`${JSON.stringify(toJsonReport(report), null, 2)}\n`);
    return EXIT_SUCCESS;
  }

  process.stdout.write(`${renderReportText(report, useColor)}\n`);

  if (!options.delete && !options.hardlink) {
    return EXIT_SUCCESS;
  }

  if (report.groups.length === 0) {
    return EXIT_SUCCESS;
  }

  const actions = planActions(report.groups, options.keepPolicy);
  const verb = options.delete ? "delete" : "hardlink";
  const pastTenseVerb = options.delete ? "deleted" : "hardlinked";

  process.stdout.write(`\n${renderPlanText(actions, verb, useColor)}\n`);

  if (options.dryRun) {
    process.stdout.write("\n(dry run - no files were changed)\n");
    return EXIT_SUCCESS;
  }

  if (!options.assumeYes) {
    const confirmed = await confirmDestructiveAction(`\nProceed to ${verb} the files listed above?`);
    if (!confirmed) {
      process.stdout.write("Aborted - no files were changed.\n");
      return EXIT_SUCCESS;
    }
  }

  const outcomes = options.delete ? await deleteDuplicates(actions) : await hardlinkDuplicates(actions);
  const failures = outcomes.filter(
    (outcome): outcome is ActionOutcome & { error: string } => outcome.error !== undefined,
  );

  process.stdout.write(`\n${outcomes.length - failures.length} file(s) ${pastTenseVerb} successfully.\n`);
  if (failures.length > 0) {
    process.stderr.write(`${failures.length} file(s) failed:\n`);
    for (const failure of failures) {
      process.stderr.write(`    ${failure.path}: ${failure.error}\n`);
    }
    return EXIT_RUNTIME_ERROR;
  }

  return EXIT_SUCCESS;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    const details = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`dupehunter: unexpected error: ${details}\n`);
    process.exitCode = EXIT_RUNTIME_ERROR;
  });

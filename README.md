# dupehunter — hardlink-aware duplicate file finder & reclaimer

[![CI](https://github.com/amasen02/dupehunter/actions/workflows/ci.yml/badge.svg)](https://github.com/amasen02/dupehunter/actions/workflows/ci.yml)
[![CodeQL](https://github.com/amasen02/dupehunter/actions/workflows/codeql.yml/badge.svg)](https://github.com/amasen02/dupehunter/actions/workflows/codeql.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-blue)](CODE_OF_CONDUCT.md)

A fast CLI that finds duplicate files by content (not name), and can safely delete or hardlink
them to reclaim disk space. Zero runtime dependencies.

```
$ dupehunter ~/Downloads
#1 4.2 MB each × 3 copies (8.4 MB reclaimable)
    /home/ama/Downloads/report(1).pdf
    /home/ama/Downloads/report(2).pdf
    /home/ama/Downloads/old/report.pdf

Summary: scanned 812 files (1.3 GB), found 1 duplicate group(s), 8.4 MB reclaimable.
```

## Why hardlink-aware matters

Most duplicate finders compare file content and stop there. dupehunter goes one step further:
before hashing, it groups files by **device + inode**, so files that are *already* hardlinked
together (common after backups, `cp -al`, or a previous dupehunter run) are recognized as a
single physical file rather than N separate copies.

| Without hardlink awareness | With dupehunter |
|---|---|
| Reports 3 "duplicates" for a 2-copy file that's already hardlinked twice + one real copy elsewhere, overstating reclaimable space | Correctly reports 1 real duplicate and the exact space `--delete`/`--hardlink` will actually free |
| Re-running after a `--hardlink` pass still shows the same "duplicates" | Re-running after a `--hardlink` pass shows **zero** duplicates — the tool recognizes its own prior work |

This also makes `--hardlink` safe to run repeatedly: it's idempotent.

## Install

Requires Node.js **20+**. Not yet published to npm — install from source:

```bash
git clone https://github.com/amasen02/dupehunter.git
cd dupehunter
npm install
npm run build
npm link          # makes `dupehunter` available on your PATH
```

Or run it without installing:

```bash
npm install
npm run build
node dist/cli.js <directory>
```

## Usage

```
dupehunter [directory] [options]
```

| Flag | Meaning |
|---|---|
| `-d, --dir <path>` | Directory to scan (default: current directory). A bare positional argument works too. |
| `--min-size <size>` | Ignore files smaller than this (default: `1B`), e.g. `10KB`, `1.5MB`. |
| `--include-empty` | Include zero-byte files (implies `--min-size 0`). |
| `--follow-symlinks` | Follow symlinked files and directories. |
| `--exclude <pattern>` | Skip files/dirs matching a name pattern (repeatable, supports `*`/`?`). Always excludes `node_modules` and `.git`. |
| `--concurrency <n>` | Max files hashed in parallel (default: CPU count). |
| `--json` | Print machine-readable JSON instead of text. |
| `--delete` | Delete duplicates, keeping one copy per group. |
| `--hardlink` | Replace duplicates with hardlinks to the kept copy — same content, no wasted space, every path still exists. |
| `--keep <policy>` | Which copy to keep: `first` (alphabetically) / `oldest` / `newest` (default: `oldest`). |
| `-y, --yes` | Skip the confirmation prompt for `--delete`/`--hardlink`. |
| `--dry-run` | Show what `--delete`/`--hardlink` would do, without changing anything. |
| `-h, --help` / `-v, --version` | Show help or the installed version. |

Exit codes: `0` ran successfully, `1` invalid arguments, `2` a filesystem error prevented the scan.

### Examples

```bash
# Just look — read-only, safe to run anywhere
dupehunter ~/Pictures

# Preview what a cleanup would do
dupehunter ~/Pictures --delete --dry-run

# Reclaim space by hardlinking instead of deleting (every path still resolves)
dupehunter ~/Pictures --hardlink --yes

# Automate in a script; machine-readable output
dupehunter ~/Pictures --json --min-size 1MB > report.json
```

## Tests

```bash
npm test
```

The suite (90 tests, `node:test`) exercises the real filesystem in temporary directories rather
than mocking it — this tool's entire value is correct filesystem behavior. It covers: recursive
scanning with excludes and size filters, streaming hash correctness, hardlink collapsing and
reclaimable-space accounting, the delete/hardlink actions (including the failure path where a
link never destroys the original), CLI argument parsing, and end-to-end CLI invocations spawned
as a real subprocess. Platform-dependent cases (symlinks, hardlinks) skip gracefully with
`t.skip()` on environments that don't permit creating them, instead of failing the build.

## Architecture (separation of concerns)

```
src/
  cli.ts            CLI entry: parse args -> scan -> render -> (confirm ->) act -> exit code
  cli-args.ts        argv parsing (node:util parseArgs) + validation
  parse-size.ts       "10KB" / "1.5MB" -> byte count
  scanner.ts          recursive filesystem walk, symlink-cycle-safe, exclude-aware
  hasher.ts           streaming SHA-256 of a file's contents
  concurrency.ts       bounded-concurrency task runner
  dedupe.ts           orchestrates scan -> hardlink-collapse -> size-group -> hash-group
  physical-file.ts    the "every PhysicalFile has >=1 path" invariant, enforced centrally
  actions.ts          keep-policy selection, delete, and safe hardlink-replace
  format.ts / render.ts   byte formatting, ANSI colour handling, text/JSON rendering
  array-utils.ts       first-or-throw helper (fail loud on broken invariants, not silently)
  index.ts            public API surface for programmatic use
test/                node:test unit + integration tests, one file per src module
```

## Contributing

Contributions are welcome — bug fixes, new options, better docs. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and coding bar, and please be mindful of the
[Code of Conduct](CODE_OF_CONDUCT.md). Use the issue templates; green CI (lint, typecheck, build,
test) is required on every pull request. Report security issues privately per
[`SECURITY.md`](SECURITY.md) — never as a public issue.

## Open source commitments

This project is, and will remain, free and open source. As maintainer I commit to:

- **A permissive licence, kept stable.** [MIT](LICENSE) — use it commercially, fork it, build on
  it. No relicensing of accepted contributions.
- **No CLA.** Contributions are accepted under the MIT licence; you keep the copyright to your work.
- **An honest history.** Real, walkable commits — no fabricated activity, no rewritten releases.
- **Best-effort, transparent triage.** Issues and pull requests are read and answered; security
  reports are acknowledged within 72 hours.
- **A welcoming community** governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Reproducible builds.** Green CI — lint, typecheck, tests, and CodeQL security analysis — on
  every change.

## License

MIT — see [`LICENSE`](LICENSE). You are free to use, modify, and distribute this software,
including for commercial purposes, provided the copyright notice is retained.

## Author

**Ama Senevirathne** — [GitHub](https://github.com/amasen02)

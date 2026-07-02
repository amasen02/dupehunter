# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-03

### Added

- Recursive directory scanner with configurable size threshold, exclude patterns, and optional
  symlink following.
- Streaming SHA-256 content hashing with a bounded-concurrency worker pool.
- Hardlink-aware deduplication: files already hardlinked together are collapsed into a single
  physical file before comparison, so reclaimable-space totals are never inflated.
- `--delete` and `--hardlink` actions with a `--keep` policy (`first` / `oldest` / `newest`),
  a confirmation prompt, `--yes` to skip it, and `--dry-run` to preview without changing anything.
- Hardlinking uses a link-to-temp-then-rename sequence so a failed link never destroys the
  original file.
- Human-readable and `--json` output formats.
- Zero runtime dependencies.

[1.0.0]: https://github.com/amasen02/dupehunter/releases/tag/v1.0.0

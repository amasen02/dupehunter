# Contributing to dupehunter

Pull requests are welcome — bug fixes, new options, performance work, or better docs — provided
they keep the tone and quality of the codebase.

## Ground rules

1. **One concern per pull request.** No drive-by refactors mixed with feature work.
2. **Branch from `main`**, keep the branch short, and squash-merge back.
3. **Conventional commits** (`feat:`, `fix:`, `perf:`, `refactor:`, `test:`, `docs:`, `chore:`).
4. **Green CI is non-negotiable.** Lint, typecheck, build, and test must all pass before review.
5. **The PR template must be filled.** Empty checkboxes block review.

## Coding standards

- **TypeScript strict mode.** No `any`, no unjustified `as`/`!` assertions — see `tsconfig.json`.
- **Zero runtime dependencies.** This is a deliberate design constraint; a new feature is not a
  reason to add one. Discuss first if you think an exception is warranted.
- **Intention-revealing names.** Full descriptive identifiers; `c`, `tmp`, `mgr` are rejected.
- **Comments explain *why*, never *what*.** No filler comments.
- **SOLID / KISS / DRY / YAGNI.** One responsibility per module; the simplest correct solution wins.

## Build, test, run

```bash
npm install
npm run lint          # eslint
npm run typecheck     # tsc --noEmit, src and test
npm run build          # tsc -> dist/
npm test              # node's built-in test runner via tsx
node dist/cli.js --help
```

## Tests

A pull request that ships behavior without a test is sent back unless it is purely documentation.

Tests run against real temporary directories on disk (via `node:fs` and `node:test`) rather than
mocking the filesystem — this project's entire value proposition is correct filesystem behavior
(hashing, hardlink detection, safe deletion), so the tests exercise the real thing. Platform-
dependent behavior (symlinks, hardlinks) skips gracefully with `t.skip()` on environments that
don't permit it, rather than failing.

## Reporting bugs and proposing features

Use the issue templates. For security vulnerabilities, **do not open a public issue** — follow
[`SECURITY.md`](SECURITY.md).

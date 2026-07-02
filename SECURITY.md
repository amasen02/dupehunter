# Security policy

dupehunter is a command-line tool that reads files under a directory **you** specify and,
only when explicitly asked, deletes or hardlinks files **you** confirmed. Its security surface
is small and entirely local; the notes below document the few areas worth understanding.

## Security-relevant behaviour

| Area | Behaviour |
|---|---|
| Destructive actions require opt-in | Scanning is always read-only. Deleting or hardlinking only happens with `--delete` or `--hardlink`, and both prompt for confirmation on a TTY unless `--yes` is passed. `--dry-run` shows the plan without touching anything. |
| No unlink-before-safety window | `--hardlink` links the replacement to a temp path and atomically renames it over the original. A failed link leaves the original file untouched instead of destroying data. |
| No network access | dupehunter never makes a network call. All work is local filesystem I/O. |
| No telemetry | Nothing is collected, logged externally, or phoned home. |
| Symlinks | Not followed by default (`--follow-symlinks` opts in), and cyclic symlink layouts cannot cause unbounded recursion — see the implementation note in `src/scanner.ts`. |
| Path handling | No path is executed as a shell command or template; every path comes directly from `fs.readdir`/`fs.stat`. |

## Reporting a vulnerability

Email `amasen02@gmail.com` with the subject prefix `[SECURITY]`, or open a private
[GitHub security advisory](https://github.com/amasen02/dupehunter/security/advisories/new).
**Do not open a public issue.** Expect acknowledgement within 72 hours.

## Coordinated disclosure window

90 days from acknowledgement, unless mutually extended.

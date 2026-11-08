# Task 032: Add pre‑commit hook to run lint and format checks

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Configure a Git pre‑commit hook (using Husky or simple script) that runs ESLint and Prettier before each commit, aborting commit on lint errors.

## Context
- Files: `.husky/pre-commit` or `scripts/pre-commit.sh`.

## Requirements (Test Descriptions)
- [x] `it executes eslint --max-warnings=0 and prettier --check`
- [x] `it prevents commit when linting fails`
- [x] `it works on Windows and Unix environments`

## Acceptance Criteria
- Developers cannot commit code with lint errors.
- Hook is documented in README.

## Implementation Notes
- Chose the lightweight plain-script approach over Husky (no new dependency): the
  hook is a POSIX-`sh` script at `.husky/pre-commit`, wired via
  `git config core.hooksPath .husky`. This works on Windows (Git for Windows runs
  hooks through its bundled sh) and on Unix with the same file.
- `.husky/pre-commit` runs `npx --no-install eslint . --max-warnings=0` and
  `npx --no-install prettier . --check`; any failure prints a message to stderr
  and exits 1, which makes git abort the commit (warnings are treated as errors).
- Wiring is automatic for fresh installs: `package.json` has a `prepare` script
  that runs `git config core.hooksPath .husky` (falls back to an echo when git is
  unavailable so `npm install` never fails). The local repository was wired
  immediately with `git config core.hooksPath .husky`.
- `.gitattributes` pins `.husky/**` to LF so the hook keeps its LF endings and
  `#!/bin/sh` works everywhere.
- README.md (created; brief) documents the hook, its setup, and the
  (discouraged) `--no-verify` bypass; on Unix developers should
  `chmod +x .husky/pre-commit` after creating/cloning.

### Verification evidence
`npx vitest run tests/unit/precommit` → `Tests 3 passed (3)`:
- `executes eslint --max-warnings=0 and prettier --check`: hook file contains the
  two commands; hook executed over a clean probe file via
  `sh .husky/pre-commit` (POSIX sh, cwd-controlled) exits 0 with both check names
  in its output.
- `prevents commit when linting fails`: hook run over a probe file violating
  `@typescript-eslint/no-unused-vars` exits non-zero, prints
  "Pre-commit: ESLint failed, commit aborted." and "✖ 1 problem (1 error, 0
  warnings)".
- `works on Windows and Unix environments`: `#!/bin/sh` shebang, LF-only, no
  cmd/ps1/`%VAR%` Windows-only syntax; passes via `sh` on this Windows 11 machine
  (GNU bash/msys sh, git 2.52); `git config core.hooksPath` returns `.husky`;
  package.json contains the `prepare` script that wires it.
- Tests run pass/fail scenarios inside `tmp-precommit-scratch/` (removed
  afterwards) rather than the repo root, so results stay hermetic while other
  files in the repository are being edited in parallel; the hook itself lints the
  working tree from its cwd, which for real commits is the repo root.
- The hook was tested exclusively by direct invocation (per instructions); no
  git commits were created.

---
description: Run the full quality gate — lint, format check, typecheck, tests, build and the security-relevant checks. Never publishes and never pushes without the user's explicit consent.
agent: orchestrator
---

Run the DartHub release check. Report every result honestly. **Do not publish,
do not push, do not tag, do not release** — a publication is a separate step
that requires the user's explicit consent, every time.

Scope (empty for the whole repository):

$ARGUMENTS

## 1. Preflight

```bash
git status --short
git diff --stat
```

Record the working tree state before the check so it can be compared afterwards.
Existing uncommitted work must survive this check untouched — no `git reset`,
no `git clean`, no `git restore`, no checkout of files.

## 2. The quality gate — run every step and record the real exit code

```bash
npm run lint          # eslint .            (warnings are errors in the hook)
npm run format:check  # prettier . --check
npm run typecheck     # tsc --noEmit
npm run test          # vitest run          (full suite, parallel)
npm run build         # next build
```

Rules:

- Run **all** of them, even when an earlier one fails. Collect all results,
  then report.
- Quote the real output and the exit code of each step.
- Never report a step as passed without its output.
- If `npm run build` fails because of a missing environment variable (no
  database, no `AUTH_SECRET`), report that as an **environment limitation**,
  not as a code defect — and state it explicitly.

## 3. Security-relevant checks

```bash
# No secret may have been committed or written.
git diff --cached --name-only | grep -E "\.env$" && echo "SECRET IN INDEX"

# Dependency surface: the runtime dependency list must not grow silently.
git diff -- package.json

# The domain core must stay framework-free.
grep -rnE "from \"(react|next|socket\.io)" src/game-engine src/board src/ai || echo "clean"

# The GDPR audit trail and the anti-cheat path must still exist.
ls src/privacy/auditService.ts src/realtime/antiCheatMiddleware.ts src/auth/requireAuth.ts
```

Also confirm, by reading the diff:

- every new route validates its input and authorises the resource;
- no password, token, session secret or personal identifier is logged;
- no new runtime dependency and no paid service entered the project;
- no `.env` file was modified.

## 4. E2E (optional, needs the dev server)

```bash
npx playwright test --reporter=list
```

Use `--reporter=list` — the configured `html` reporter starts a blocking
report server on failure. The dev server must run on `http://localhost:3000`.
Report it as "not run" with the reason if it cannot be run; do not silently
skip it.

## 5. Report

A table with one row per step: command, exit code, result (pass / fail / not
run + reason), and for failures the first actionable error.

Then:

- the security findings, if any;
- the diff between the working tree before and after the check (there must be
  none — the check must not modify anything);
- **what is blocking a release**, if anything.

End with `RELEASE_CHECK_PASSED` (every step passed) or
`RELEASE_CHECK_FAILED` (name every failing step). Never round a partial
result up.

**No commit, no tag, no push, no release** — without the user's explicit
consent for that specific action.

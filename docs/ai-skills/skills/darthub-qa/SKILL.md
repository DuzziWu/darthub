---
name: darthub-qa
description: This skill should be used when the user asks to "run the tests", "write a test", "verify this change", "the test is failing", "add regression coverage", "check coverage" or otherwise touches DartHub's test suite. Encodes the CI command order, the test layout, the environment prerequisites and the known pre-existing failures that must not be mistaken for regressions.
paths:
  - "tests/**"
  - "e2e/**"
---

# DartHub QA

Guide for verifying changes with DartHub's own tooling, and for telling a
regression apart from breakage that was already there.

## Know the baseline first

DartHub's build is **green**. The baseline is:

**Typecheck — 0 errors**

**Vitest — 96/96 files pass, 447/447 tests pass, 0 errors**

**Lint / format — pass**

Two checks are conditional on the environment and skip rather than fail:

| Test                                            | Skipped when                                                 |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `tests/unit/dockerignore.test.ts`               | no Docker **daemon** reachable (the CLI alone is not enough) |
| `tests/unit/tailwind/tailwindToolchain.test.ts` | no successful `npm run build` output present                 |

**Always diff against this baseline, never against zero.** Report the delta.

## Run the checks in CI order

`.github/workflows/ci.yml` runs exactly this sequence, and the local run should
match it:

```bash
npm run lint          # eslint . --max-warnings=0 (pre-commit uses --max-warnings=0)
npm run format:check  # prettier . --check
npm run typecheck     # tsc --noEmit --incremental false
npm run test          # vitest run
```

The pre-commit hook (`.husky/pre-commit`) runs the lint and format steps and
aborts the commit on failure, so style issues should never reach a review.

## Test layout

| Location               | Runner     | Needs                                 |
| ---------------------- | ---------- | ------------------------------------- |
| `tests/unit/**`        | Vitest     | nothing (use in-memory doubles)       |
| `tests/integration/**` | Vitest     | `DATABASE_URL` + reachable PostgreSQL |
| `e2e/**`               | Playwright | `npm run dev` on port 3000            |

Unit tests mirror the source tree under `tests/`. The vitest config resolves
the `@/` alias to `src/`.

### Component tests and the jsdom gap

`vitest.config.ts` sets `environment: "node"` globally. React component tests
therefore throw `ReferenceError: window is not defined` — 11 of the 15
failures above. `jsdom` is installed (`jsdom@^29.1.1`), so this is a config
gap, not a missing dependency.

When adding a component test, prefer a per-file docblock over changing the
global config casually:

```ts
// @vitest-environment jsdom
```

## Environment prerequisites

- `npx prisma generate` after `npm install` — npm 12 blocks install scripts by
  default, so `@prisma/client` is not generated otherwise.
- `docker` daemon running for `tests/unit/dockerignore.test.ts`.
- `DATABASE_URL` set and PostgreSQL reachable for the integration suite.
- A successful `npm run build` for `tests/unit/tailwind/tailwindToolchain.test.ts`.
- `npx playwright install` for the browser binaries, if not already present.

## Fixtures and helpers

- `tests/support/run-command.ts` — the helper for shelling out to project
  commands in tests.
- `tests/support/inMemoryAuthRepository.ts` — the in-memory
  repository double; prefer it over a real database in unit tests.
- `tests/unit/career/helpers/validQuestFixture.ts` — the valid quest fixture.
- `tests/unit/game/helpers.ts`, `tests/unit/board/helpers.ts` — shared builders.
- `e2e/visual-qc-helpers.ts` — the shared visual-QC helpers.

## Writing a new test

1. Put it in the directory that mirrors the source file it covers.
2. Name it `*.test.ts` / `*.test.tsx` (unit, integration) or `*.spec.ts` (e2e).
3. Write the title as a descriptive sentence: `it('restores the state before the dart', ...)`.
4. Cover the failure path, not only the happy path.
5. For a new game-engine rule, add a correction-replay case: the state after
   a correction must equal the state of a match built without that dart.
6. For a new `MutableMatchState` fixture, include `throws` and `corrections` —
   their absence is exactly what broke the two game-center test files.
7. Aim for ≥ 80 % coverage per `.claude/testing.md`.

## Verification

```bash
# Fast loop for one area
npx vitest run tests/unit/game-engine/

# Full suite (~2 minutes)
npm run test

# End-to-end (needs the dev server)
npm run dev &
npx playwright test
```

## Additional Resources

### Reference Files

- **`references/test-matrix.md`** — the full test-file inventory by category,
  its required environment, its expected baseline result, and the
  known-failure triage table.

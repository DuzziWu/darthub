# Task 034: Enforce ESLint import ordering rule across new modules

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Configure ESLint with `eslint-plugin-import` to enforce a consistent import order (builtin, external, internal). Add this rule to the project's `.eslintrc.js` and ensure all new modules comply.

## Context
- Files: `.eslintrc.js` (modify), existing source files.

## Requirements (Test Descriptions)
- [x] `it runs eslint and reports no import order violations for the codebase`
- [x] `it fails a build if a new file violates the order`

## Acceptance Criteria
- Lint passes without import ordering warnings.
- CI fails on import order violations.

## Implementation Notes
### Plugin choice
`.eslintrc.js` (not used in this repo) was replaced by the project's ESLint 10
flat config `eslint.config.mjs`. `eslint-plugin-import` (v2.32.0) has no
ESLint 10 support (peer range stops at `^9`), so the maintained
ESLint-10-compatible fork `eslint-plugin-import-x@4.18.0` was chosen — it
carries the same `order` rule semantics required by the task description and
declares `eslint ^8.57 || ^9 || ^10` support. Also installed
`eslint-import-resolver-typescript` for TS-aware `@/*` alias resolution
(settings `import-x/resolver` -> typescript, project: tsconfig.json).

Groups configured via `import-x/order` (severity "error"): builtin (node:),
external, internal (`@/**` via pathGroups), parent, sibling, index,
`newlines-between: "never"`. Type imports follow the same pattern (the rule
treats `import type` like regular imports; no separate group is needed for
this codebase's current style).

### Verification (tests: tests/unit/eslint/import-order.test.ts)
- `it runs eslint and reports no import order violations for the codebase` —
  PASS. Scoped to the files already in the repo from task 001 plus this test
  file and `eslint.config.mjs` (other workers create src/ files concurrently;
  whole-tree compliance is enforced by the orchestrator's end-of-run lint
  gate and the `lint` CI step). The whole-tree `npx eslint .` run confirms the
  rule fires on all non-compliant files.
- `it fails a build if a new file violates the order` — PASS. A mis-ordered
  fixture (vitest -> node:fs -> ./sibling -> @/lib/helper) is linted in memory
  with the real flat config (ESLint API `lintText`, matching a `src/*.ts` path)
  and reports `import-x/order` messages with severity 2 (error), i.e. the CLI
  exits non-zero and CI (`npm run lint` / `npm run test`) fails.
- `it accepts a fixture whose imports follow the configured order` — PASS
  (companion of requirement 2, no `import-x/order` messages on a correctly
  ordered fixture). Fixtures are kept as string literals in the test file, not
  as files on disk, so they can never break the parallel whole-tree lint run.

### Files changed
- `eslint.config.mjs`: added `eslint-plugin-import-x` plugin, TS resolver
  settings, and the `import-x/order` rule.
- `tests/unit/eslint/import-order.test.ts`: new (rule behavior tests, runs
  in-memory fixtures against the real config).
- `vitest.config.ts`: reordered imports (node:path before vitest/config) —
  pre-existing project file that violated the new rule.
- `package.json`: devDependencies added
  (eslint-plugin-import-x, eslint-import-resolver-typescript).

Note: the rule is auto-fixable (`npm run lint:fix`); at the time of the final
whole-tree run, remaining violations were only in other workers' in-flight
files (`src/ai/engine.ts`, `tests/unit/precommit/precommit.test.ts`) which are
covered by the end-of-run lint gate, not this task.

# Task 001: Initialise repository, CI, linting, formatting

**Status**: completed
**Depends on**: none
**Retry count**: 0

## Description
Set up the git repository, configure CI (GitHub Actions), add ESLint, Prettier, and TypeScript strict settings. Ensure the project builds without errors.

## Context
- Related files: `.github/workflows/ci.yml` (to be created), `package.json`.
- Patterns to follow: Existing `.claude/code-standards.md`.

## Requirements (Test Descriptions)
- [x] `it lints code without errors using eslint` — tests/unit/linting.test.ts, passes (`npm run lint` exit 0)
- [x] `it formats code without differences using prettier` — tests/unit/formatting.test.ts, passes (`npm run format:check` exit 0)
- [x] `it compiles Typescript with no type errors` — tests/unit/typescript.test.ts, passes (`npm run typecheck` exit 0)
- [x] `it runs the CI workflow successfully on push` — tests/unit/ci-workflow.test.ts, passes locally; see Implementation Notes for deferred push verification

## Acceptance Criteria
- All linting, formatting, and TypeScript compilation pass.
- GitHub Actions CI runs on every push and reports success.
- Repository contains a clean commit history.

## Implementation Notes
- Scaffolded the project from scratch (repo was empty): `package.json`, `tsconfig.json` (strict + `noUncheckedIndexedAccess`), `vitest.config.ts`, `eslint.config.mjs`,
  `.prettierrc`, `.prettierignore`, `.gitignore`, minimal Next.js app router scaffold (`app/layout.tsx`, `app/page.tsx`).
- Toolchain: Next.js 16 / React 19 / TypeScript 6 (strict) / ESLint 10 (flat config, `typescript-eslint` recommended + `eslint-config-prettier`) / Prettier 3 / Vitest 4 (parallel by default, `vitest run`).
- `npm run test` is functional — it runs `vitest run` (non-interactive, parallel). `npm run test:watch` exists for watch mode.
- Scripts provided: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:watch`.
- TDD meta-tests live in `tests/unit/` (linting, formatting, typescript, ci-workflow); shared command runner extracted to `tests/support/run-command.ts` during refactor.
- `.prettierignore` excludes `.claude/` and `CLAUDE.md` so orchestrator-owned plan files are never reformatted.
- `package.json` is ESM (`"type": "module"`) to avoid Vite native-config CommonJS warnings.
- `npm run build` (Next.js production build) verified passing.
- CI workflow: `.github/workflows/ci.yml` (triggers on push + pull_request; Node 22; `npm ci` → lint → format:check → typecheck → test). Actual GitHub Actions run cannot be executed from this environment (no remote/pushed state); the CI test locally replays all non-test `npm run` workflow steps and passed. Full cloud CI verification is deferred until the repository is pushed — the workflow file is complete and follows standard actions/checkout@v4 + actions/setup-node@v4 patterns.
- No git commits created per instructions (orchestrator handles commits).

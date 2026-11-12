# Testing Configuration

The authoritative testing reference is [`docs/TESTING.md`](../docs/TESTING.md).
It describes the frameworks, the test pyramid, the directory organisation, the naming
conventions, the coverage targets and the CI pipeline.

This file used to say "None (to be configured later)" and claimed Vitest was not yet
installed. Both were wrong — Vitest and Playwright are configured and the suites run.
The file now points at the single source of truth instead of repeating it.

## Quick reference

```bash
npm run test            vitest run, full parallel suite
npx vitest run <path>   single file or directory while iterating
npm run lint            eslint over the repository
npm run typecheck       tsc --noEmit
npm run format          prettier write
```

## Test file locations

- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Shared helpers and fixtures: `tests/support/`
- End-to-end tests: `e2e/` (Playwright, `*.spec.ts`)

## Conventions

- Test files are named `*.test.ts`; Playwright specs are named `*.spec.ts`.
- Test titles are descriptive sentences using `it('...')`; a test name states the
  requirement it verifies, so a failing test reads as the missing behaviour.
- A task is not started until its tests exist and fail.

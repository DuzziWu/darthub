# Testing Configuration

## Test Framework
None (to be configured later). Preferred: Vitest with parallel execution.

## TDD Methodology

Each task follows strict Red → Green → Refactor:

1. Write a failing test for one requirement
2. Write minimum code to pass the test
3. Refactor while tests stay green
4. Repeat for next requirement
5. Commit when task complete

## Commands
```bash
# Run all tests (parallel) – placeholder
# Once Vitest is set up, use the npm script `test` which runs Vitest in watch mode.

npm run test
# NOTE: command not yet functional – Vitest scripts not installed
```

## Parallel Execution
- **Default**: Tests should run in parallel once Vitest is set up.
- **Parallel command**: `npm run test`
- **Sequential fallback**: `npm run test`

## Test File Locations
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- End‑to‑end tests: `tests/e2e/`

## Coverage Requirements
- Minimum: 80%
- New code must have tests

## Test Naming Convention
- Test files: `*.test.ts` or `*.spec.ts`
- Test titles: descriptive sentences using `it('...')`

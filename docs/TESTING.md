# Testing Strategy

## Table of Contents

- [Overview](#overview)
- [Frameworks](#frameworks)
- [Test Pyramid](#test-pyramid)
- [Organisation](#organisation)
- [Naming Conventions](#naming-conventions)
- [Coverage Targets](#coverage-targets)
- [Commands](#commands)
- [Continuous Integration](#continuous-integration)
- [Related Documents](#related-documents)

## Overview

DartHub is verified by Vitest unit and integration tests plus Playwright end-to-end journeys. Parallel execution is preferred so test suites never become a serialisation bottleneck between concurrent work streams.

## Frameworks

- **Vitest**: unit and integration tests, run with `vitest run` for a single parallel pass.
- **Playwright**: end-to-end tests for login, matchmaking, and career flows.
- **ESLint and Prettier**: enforced independently of tests, with a pre-commit hook (task 032).

## Test Pyramid

| Level       | Scope                                                                 | Runner     |
| ----------- | --------------------------------------------------------------------- | ---------- |
| Unit        | Domain rules, engine logic, AI distributions, DTO validation          | Vitest     |
| Integration | Service plus repository against a real database, Socket.IO room flows | Vitest     |
| End-to-End  | Full browser journeys across auth, lobby, match, career               | Playwright |

## Organisation

Tests mirror the source structure under `tests/`:

```text
tests/
  unit/        mirrors src modules, one test file per module
  integration/ service and repository flows
  support/     shared helpers and fixtures
e2e/           Playwright specs (*.spec.ts)
```

Test files are named `*.test.ts` and live beside their mirrored module path. Playwright
specs live in the top-level `e2e/` directory and are named `*.spec.ts`.

## Naming Conventions

- Test titles are descriptive sentences using `it('...')`.
- A test name states the requirement it verifies, so a failing test reads as the missing behaviour.
- Each planned task lists its test descriptions up front; implementation is considered started only after its tests exist and fail.

## Coverage Targets

- Global coverage target is at or above 80 percent line coverage.
- Domain rules and the game engine target 100 percent branch coverage on scoring paths.
- Coverage is measured on `vitest run --coverage`; no coverage gates are bypassed for speed.

## Commands

```text
npm run test            vitest run, full parallel suite
npx vitest run <path>   single file or directory while iterating
npm run lint            eslint over the repository
npm run typecheck       tsc --noEmit
npm run format          prettier write
```

E2E tests run with their own Playwright command against a locally started app instance.

### The Docker image build

`tests/unit/dockerignore.test.ts` has two levels. The **structural** checks —
the `.dockerignore` file list and the filtered build context — run in every
suite run and need neither the `docker` CLI nor a daemon. The **live** build,
which builds the real image and enforces the 200 MB size limit, is opt-in:

```text
DART_DOCKER_BUILD=1 npm test -- tests/unit/dockerignore.test.ts
```

Without the flag the live block is skipped, the reason is printed to stdout
(`[dockerignore] DART_DOCKER_BUILD is not set: …`) and the test title names
the flag; the default suite run never touches the Docker daemon — it does not
even run `docker info`. With the flag set the build needs a reachable daemon,
and a **missing daemon is a hard failure**, not a skip.

## Continuous Integration

- CI installs dependencies, lints, typechecks, then runs the Vitest suite in parallel.
- The live Docker image build runs in its own step (`Test (Docker image)`) with `DART_DOCKER_BUILD=1`, so the 200 MB image-size limit stays verified on every push. `tests/unit/ci-workflow.test.ts` guards that step: the plain unit-suite step must not set the flag, and the meta test must not replay the docker step locally.
- Playwright runs on demand and before release cuts; a failed E2E journey blocks the release milestone it guards.
- Tasks must be verifiable: a task may not be marked complete without validated test results.

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [API Specification](./API.md)
- [Roadmap](./ROADMAP.md)
- [Security](./SECURITY.md)

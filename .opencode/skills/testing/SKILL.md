---
name: Testing
description: Use when writing or running tests, planning test coverage, reproducing a bug, setting up a regression guard, or judging whether a change is verified enough to accept. Covers the real Vitest and Playwright setup of this repository, the test layout, the mandatory negative and boundary cases, and the verification commands.
---

# Testing (DartHub)

## The real setup — do not trust the old notes

`.claude/testing.md` is **stale**: it still claims that no test framework is
configured and that `npm run test` is not functional. It is wrong. The truth:

| Tool        | Reality                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Vitest      | installed, configured in `vitest.config.ts`; `npm run test` = `vitest run`                          |
| Playwright  | installed, configured in `playwright.config.ts`; `testDir: ./e2e`; `baseURL: http://localhost:3000` |
| React tests | `@testing-library/react` + `jsdom` are installed                                                    |

Details that break people:

- `vitest.config.ts` uses `environment: "node"` **globally**. A React test
  must opt in with `// @vitest-environment jsdom` on the first line.
- `tests/setup.ts` calls `cleanup()` after each test — React trees are
  unmounted before jsdom is torn down.
- Test file pattern: `tests/**/*.test.ts` and `tests/**/*.test.tsx`.
- Playwright's configured reporter is `html` and it **starts a blocking report
  server on failure**. Use `--reporter=list` when you run it from an agent.
- `npx vitest run <path>` runs one file or directory.

## Layout

```text
tests/unit/<module>/      mirrors src/<module>/, one file per module
tests/integration/        service + repository and route flows
tests/support/            shared helpers, e.g. run-command.ts
tests/setup.ts            global setup
e2e/                      Playwright specs
```

Ownership: the test file that mirrors a module belongs to the agent that
implements that module. `qa-engineer` owns the harness, the tooling
configuration, the cross-cutting meta tests and everything in `e2e/`.

## Writing a test

1. **Name the requirement.** `it("refuses a correction that would make a later
dart bust")` — a failing test should read as the missing behaviour.
   Descriptive sentences, never `it("works")`.
2. **Red first.** Write the test, run it, watch it fail for the right reason.
   A test that never failed proves nothing.
3. **Assert observable behaviour**, through the public API and the resulting
   state — not through internal spies and not through implementation details.
4. **Cover the negative case and the boundary.** Mandatory, not optional:
   - zero, minimum and maximum values (0 points, 60 points, 50 bull);
   - empty input, malformed JSON, missing field, wrong type;
   - unauthenticated, not-authorised, not-found;
   - the bust, the invalid checkout, the refused correction;
   - the multi-player case where one player's result depends on another's state.
5. **Stay deterministic.** No clock, no unseeded randomness, no network, no
   sleeps, no dependence on a local database.

## Test pyramid

| Layer       | Scope                                                    | Runner     |
| ----------- | -------------------------------------------------------- | ---------- |
| Unit        | Rules, validation, pure functions, boundaries            | Vitest     |
| Integration | Service + repository + route wiring, auth, error mapping | Vitest     |
| E2E         | User journeys: login, lobby, match, career               | Playwright |

Coverage target: **≥ 80 % lines** globally; the domain rules and the game
engine target full branch coverage on the scoring paths. Measure with
`vitest run --coverage`; never bypass a coverage gate for speed.

## Reproducing a bug

1. Write the failing test that captures the defect — exact input, exact
   wrong result.
2. Run it. Paste the real failure output.
3. Hand the case to the owning agent.
4. After the fix, the test stays as the regression guard.

A bug report without a reproduction is an opinion, not a defect.

## Verifying a change

```bash
npm run test                       # the full Vitest suite, parallel
npx vitest run tests/unit/<x>      # one area while iterating
npm run lint
npm run typecheck
npx playwright test --reporter=list # E2E (dev server on :3000)
```

For a release-grade check run all of the above plus `npm run build` — see the
`/release-check` command.

## Reporting

State the matrix you covered (layer × case), the files you added, the **actual
output** of every command including the pass/fail counts, the defects you
reproduced with their failing test names, and the coverage status of the area.

End with `QA_COMPLETE` or `QA_BLOCKED`.

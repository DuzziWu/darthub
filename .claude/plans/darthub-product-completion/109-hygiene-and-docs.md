# Task 109: Untrack scratch artifacts, install coverage, correct the documentation

**Status**: pending
**Depends on**: 100
**Retry count**: 0

## Description
Fourteen scratch files are tracked in the repository root, the build cache is tracked despite being in `.gitignore`, and the documentation describes a tree that no longer exists. `docs/TESTING.md` claims coverage is measured by `vitest run --coverage` when no coverage provider is installed. `docs/ROADMAP.md` still shows most of the 48 tasks as pending. This task cleans the tree and makes the documentation true.

## Context
- Related files: the tracked scratch files, `.gitignore`, `docs/TESTING.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/DEPLOYMENT.md`, `package.json`, `vitest.config.ts`, `tests/unit/docs/docs.test.ts`
- Tracked scratch files in the repository root: `build_output.log`, `build_v2_output.log`, `eslint_v2_output.log`, `lint_output.log`, `prettier_v2_output.log`, `typecheck_output.log`, `typecheck_full_output.log`, `typecheck_v2_output.log`, `test_anticheat_focused_output.log`, `test_full_suite_output.log`, `test_invitation_output.log`, `test_invite_focused_output.log`, `test_latest_output.log`, `p17.raw`.
- `tsconfig.tsbuildinfo` is tracked, although `.gitignore` already lists `*.tsbuildinfo`.
- `docs/TESTING.md:56-58` — "Global coverage target is at or above 80 percent line coverage", "Domain rules and the game engine target 100 percent branch coverage", "Coverage is measured on `vitest run --coverage`". **`@vitest/coverage-v8` is not installed**, so that command cannot run.
- `docs/TESTING.md:75` — "Playwright runs on demand and before release cuts". Task 100 makes it run on every push.
- `docs/ROADMAP.md` "Delivery Status" — shows 002, 007, 012, 018, 020, 026 as `in progress` and "others — pending". All 48 tasks are `completed` in `.claude/plans/darthub-full-product-planning/_plan.md`.
- `docs/DECISIONS.md` "Open Decisions" — the matchmaking persistence and CV decisions are still correctly open, but the CV decision should now record that the stub-raising behaviour is deliberate and tested.
- `docs/DEPLOYMENT.md` §Verification Status — states the Docker path was never run live.
- `tests/unit/docs/docs.test.ts` and `tests/unit/docs/deploymentDocs.test.ts` exist but did not catch any of these.

## Requirements (Test Descriptions)
- [ ] `it tracks no scratch log files in the repository root`
- [ ] `it tracks no build cache files`
- [ ] `it has a coverage provider installed`
- [ ] `it reports coverage for the domain modules`
- [ ] `it states the real Playwright trigger in the testing documentation`
- [ ] `it states the real delivery status in the roadmap`
- [ ] `it does not claim a coverage target that cannot be measured`

## Acceptance Criteria
- The repository root contains no scratch logs and no build cache. The files are removed from the index and ignored, not merely deleted from the working tree.
- `npm run test:coverage` runs and reports coverage. The provider is installed and the script exists.
- `docs/TESTING.md`, `docs/ROADMAP.md` and `docs/DECISIONS.md` describe the tree as it is after this plan.
- Where a documentation claim is mechanically checkable, a test asserts it.
- No documentation file claims a verification that did not happen.

## Implementation Notes

**Untrack, do not just delete.** `git rm --cached <file>` removes the file from the index while keeping it on disk, and the `.gitignore` entry stops it coming back. Deleting the files outright loses local work that may still be useful for debugging.

Add to `.gitignore`: `*.log`, `*.raw`, `*.tsbuildinfo` (already present), and keep the existing `reports/` entry. The current `.gitignore` already lists `playwright*_output.log` — generalising it to `*.log` covers the rest.

**Coverage: install the provider, then measure before claiming a number.** `npm i -D @vitest/coverage-v8` and add `"test:coverage": "vitest run --coverage"`. Then **run it and look at the real numbers** before writing any percentage into the documentation.

This matters: the documented target is 80% line coverage and 100% branch coverage on scoring paths. The real numbers may well be below 80% — `src/camera/vision/` is four stub files, and the realtime and auth modules have thin integration coverage. If the measured coverage is below the target, the honest options are to improve the coverage or to state the real figure and the gap. Writing "80%" because the document said so would be the same class of error as the drift being fixed. Report the measured number in the documentation, and record any gap as a known issue.

**The `vitest.config.ts` needs the coverage settings.** The thresholds, the reporter and the include/exclude patterns belong in the config, not only in the document — that is what makes the target enforceable. If the threshold is set and the suite falls below it, the run fails, which is the point. But set it to the measured reality, not to an aspirational number, or the gate is permanently red.

**Fix the ROADMAP status table from the plan, not from memory.** The authoritative source is `.claude/plans/darthub-full-product-planning/_plan.md`, where all 48 tasks are `completed`. The ROADMAP's phase table maps tasks to phases and is correct; the "Delivery Status" table is not. Replace it with the real status. Also update the phase table if tasks from this plan are to be tracked there — this plan is a new phase and the roadmap should show it.

**Update the Playwright trigger sentence.** Task 100 makes the suite run on every push. `docs/TESTING.md` must say so, including that the suite runs against a production build and that browsers are installed in the CI job.

**Record the CV deferral precisely.** `docs/DECISIONS.md` already has the CV decision as open with a good rationale. Add the fact that the stubs deliberately raise `NotImplementedInCvPhaseError` so a stub result can never be mistaken for a real detection, and that this behaviour is tested. A deferral with a guard test is a stronger position than a deferral alone.

**The deployment verification status is honest but should become specific.** `docs/DEPLOYMENT.md` says the live build-and-serve run "has been deferred in this environment" and asks for a clean-room run. After task 104 the compose file has a real realtime service, so the guide must describe the topology that actually exists. If a live compose run still has not happened, say exactly that — do not upgrade "reviewed against the sources" into "verified".

**Do not touch `docs/ai-skills/` or `.agents/skills/`.** The skill suite is committed and byte-identical between `docs/ai-skills/skills/` and `.agents/skills/`. Editing either side breaks that invariant. If a skill needs a change, edit the source and copy across.

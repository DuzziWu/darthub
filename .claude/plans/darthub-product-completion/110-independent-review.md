# Task 110: Independent review of the whole change

**Status**: pending
**Depends on**: 101, 102, 103, 104, 105, 106, 107, 108, 109
**Retry count**: 0

## Description
A final pass over everything this plan changed, performed by someone who did not write it. The plan touches security (the socket handshake, the migration transaction), correctness (the shared undo/correct across five views), architecture (the realtime deployment split) and documentation (the claims that were false). Those four categories fail in different ways, and a review that only looks for one kind of defect will miss the others.

## Context
- Related files: every file changed by tasks 101–109
- The changes span `src/auth/`, `src/realtime/`, `src/components/game/`, `src/components/x01/`, `app/login/`, `app/lobby/`, `app/dashboard/`, `app/career/`, `e2e/`, `docs/`, `.github/workflows/`, `Dockerfile.realtime`, `docker-compose.yml`, `tests/`
- The project's own review checklist lives in the vendored skill at `docs/ai-skills/skills/darthub-code-review/references/review-checklist.md`. Use it rather than inventing a second one.
- The repo's architectural invariants are in `docs/ai-skills/README.md` §2.3. `AGENTS.md` says to read that section before making a structural change.

## Requirements (Test Descriptions)

This task produces a review report, not tests. The report must cover, at minimum:

- [ ] **Security** — is the socket handshake authenticated end to end? Can a client claim an identity it did not authenticate as? Is the migration transaction genuinely atomic? Does the guest migration token remain a secret in the client? Are the bearer tokens handled safely (no `localStorage`, no logging)?
- [ ] **Correctness** — do all five match views behave identically for undo and correction? Is there any remaining path where the client computes a score the server owns? Can a rating be recorded twice for one match?
- [ ] **Architecture** — does the new code respect the service-repository-DTO layering and the injected-service route pattern? Is the realtime server's separation from Next.js consistent with the documented architecture? Has any second implementation of an existing rule been introduced?
- [ ] **Documentation** — do the docs describe the tree as it now is? Does any document claim a verification that did not happen?
- [ ] **Test quality** — do the new tests assert behaviour rather than implementation? Would they fail against the pre-fix code? Are the skipped placeholders genuinely gone rather than merely relocated?

## Acceptance Criteria
- The review report exists and is committed.
- Every finding is either fixed in its own commit or recorded as an explicit, reasoned acceptance with a named owner.
- No finding is closed by weakening a test.
- The full gate is green at the end: lint, format:check, typecheck, unit tests, build, and the Playwright suite.

## Implementation Notes

**Review the diff, not the intention.** `git diff <first-commit>..HEAD` is the artefact. Read it as a reviewer who has not seen the plan, because the plan's reasoning is exactly what the code must not depend on.

**Check the failure paths specifically.** The happy paths were exercised during development. The interesting questions are what happens when the socket disconnects mid-match, when the migration token is replayed, when two players queue and one leaves, when the rating service throws, when a quest file is malformed. Each of those is a place where a plausible implementation is wrong.

**The "would this test fail before the fix" discipline applies to the whole plan.** For each new test, check that it actually discriminates. A test that passes both before and after a fix proves nothing, and the atomicity test in task 101 is the one most likely to have this flaw — the in-memory repository did not roll back, so a naive test would have passed against the broken code.

**Look for the second implementation.** The specific risk in this plan is a rule that exists in the engine or the server and has been reimplemented in the client or in a page: scoring in the browser, unlock rules in the career page, Elo in a component. `grep` for the rule's vocabulary across `src/` and `app/` and confirm each rule has exactly one owner.

**Do not fix findings inside the review commit.** Each finding gets its own commit, so the history shows the review was acted upon rather than absorbed.

**Use the vendored checklist.** `docs/ai-skills/skills/darthub-code-review/references/review-checklist.md` is the project's own standard. Reading it is also a check that the skill suite installed in `.agents/skills/` is actually usable — which is part of the value the AI-skill work was meant to deliver.

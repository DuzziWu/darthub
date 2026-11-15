---
name: Code Review
description: Use when an important change needs an independent review before it is accepted, or when preparing a review report. Covers the review scope, the security/architecture/correctness/test-coverage checklist for DartHub, the severity scale and the finding format. Read-only — a review never changes the code it reviews.
---

# Code review (DartHub)

An independent review is the gate that keeps a plausible-looking change from
becoming a shipped defect. The reviewer is **read-only**: it reports, it never
fixes, and it never reviews its own work.

## Scope

1. **Establish the intent** — the plan, the task file or the requirement. What
   was the change supposed to achieve, and which acceptance criteria does it
   claim?
2. **Read the real diff** — `git diff`, `git status` — and then the **whole**
   changed files, not only the hunks. A defect in unchanged code that the
   change exposes is still a finding.
3. **Verify every claim.** "Tests pass" means you run them. "The state is
   unchanged on refusal" means you read that code path. An unverified claim is
   itself a finding.
4. **Look for what is missing.** The dangerous defect is the case nobody
   wrote a test for.

## Checklist

**Correctness**

- Does the behaviour match the requirement, including the edge cases (zero,
  max, empty, one player, malformed, duplicate, concurrent)?
- Are state transitions consistent? In the engine: is a bust recorded but not
  scored, does a refused correction change _nothing_, is the state derived by
  replay rather than patched?
- Are the error classes used correctly (`GameEngineValidationError` vs.
  `GameEngineStateError`)? Are exceptions swallowed where they should fail?

**Security**

- Is every client input validated for type _and_ range?
- Is every endpoint authorised for **the resource**, not only for the caller?
  Can user A reach user B's data with a valid token?
- Are passwords, tokens, session secrets or personal identifiers ever logged
  or returned?
- Does the server trust client state? Does anti-cheat run on every path that
  applies a throw?
- Are SQL queries parameterised? Is the GDPR audit trail intact?

**Architecture**

- Does the dependency direction hold: routes → services → domain core →
  repositories → Prisma?
- Is the domain core free of React, Next.js, Socket.IO, Node built-ins and DOM
  globals?
- Is business logic in the service and not in the route handler? Do DTOs cross
  the boundary instead of raw ORM entities?
- Did the change introduce a directory that does not exist
  (`src/services/`, `src/repositories/`, `src/dto/`, `src/domain/`,
  `src/infrastructure/`), a new runtime dependency or a paid service?
- Are the public exports of `src/game-engine/index.ts` still compatible?
- Does the UI render what the engine says, or does it invent data?

**Tests**

- Does every new behaviour have a test — including the negative case?
- Would the test fail if the implementation broke? (Look for tautological
  assertions, over-mocking, assertions on implementation internals.)
- Are the boundaries covered: 0, max, empty, one element, malformed?
- Is the test deterministic (no clock, no randomness, no network, no sleeps)?

**Conventions**

- TypeScript strict, `noUncheckedIndexedAccess` respected.
- ESLint and Prettier clean; import order `builtin → external → internal (@/)
→ parent → sibling → index` without blank lines between groups.
- One class/module per file; tests mirror the source structure under `tests/`.
- No `console.log` left in production code; no commented-out code; no comment
  that merely restates the code.

## Severity

| Level    | Meaning                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------- |
| CRITICAL | Security hole, data loss, corrupted game state, broken invariant that invalidates results                 |
| HIGH     | Wrong behaviour on a realistic path, missing authorisation, missing migration, broken build or type error |
| MEDIUM   | Missing edge-case handling, missing test on a risky path, maintainability trap that will cause a defect   |
| LOW      | Style, naming, duplication, comment quality                                                               |

Do not inflate. Do not report a preference as a defect. If you cannot state
the concrete failure a change causes, it is at most a suggestion — label it as
one.

## Finding format

Findings ordered by severity, most severe first:

```text
[SEVERITY] Short title
  file: src/<path>/<file>.ts:123
  What:  one sentence — the defect
  Why:   the concrete failure (input → wrong result)
  Fix:   the smallest correct change
```

Then the verdict:

- `APPROVE` — no CRITICAL or HIGH finding.
- `APPROVE_WITH_COMMENTS` — only MEDIUM/LOW findings.
- `REQUEST_CHANGES` — at least one CRITICAL or HIGH finding.

## Report

State what you read, what you ran and the **real output**, and what you could
not verify. Never claim a test passes without running it, and never fix
anything yourself.

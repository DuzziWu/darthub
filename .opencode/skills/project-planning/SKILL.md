---
name: Project Planning
description: Use when a DartHub request needs a plan before code is written — a new feature, a substantial change, a cross-module refactor or anything that touches more than one module. Produces a verifiable work-package plan under .opencode/plans/ with owning agent, file ownership, acceptance criteria and verification commands.
---

# Project planning (DartHub)

Planning is the gate that keeps the autonomous team from writing code nobody
agreed to. A plan is not a to-do list of intentions; it is a set of **work
packages**, each with an owner, a file set, acceptance criteria that can be
checked mechanically, and the command that proves it.

## When to load this skill

- A new feature or a substantial change is requested.
- The work spans more than one module (`src/game-engine`, `src/components`,
  `app/api`, `prisma`, …).
- A decision needs to be recorded before code (architecture, schema, protocol).
- A previous plan is stale and has to be re-planned.

Do **not** load it for a one-line fix or a typo — those go straight to the
implementing agent.

## Step 1 — Understand before you plan

Read, in this order:

1. `AGENTS.md` — the project rules and the ownership map.
2. The source the request touches. Verify every path — `docs/ARCHITECTURE.md`
   explicitly lists directories that **do not exist** (`src/services/`,
   `src/repositories/`, `src/dto/`, `src/domain/`,
   `src/infrastructure/`). Never plan against them.
3. The relevant existing documentation:
   `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATABASE.md`,
   `docs/SECURITY.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`,
   `src/game-engine/README.md`.
4. The existing tests that cover the area — they tell you what behaviour is
   already locked in and must not regress.

Write down, in one sentence each:

- the **problem** (not the solution),
- the **observable outcome** that proves it is solved,
- the **constraints** (server authority, pure domain core, design system,
  no paid services, no new runtime dependency).

## Step 2 — Design the change

Load the `architect` agent for the design if the change crosses a layer
boundary, changes a data model, or changes a public contract. The architect
writes the decision and the plan skeleton; you fill in the work packages.

Decide explicitly:

- **Which files change.** Write the paths down. This is the ownership map the
  orchestrator uses to decide what may run in parallel.
- **Which agent owns each file.** See the ownership table in `AGENTS.md`.
  Two packages may run in parallel only if their file sets are disjoint.
- **What the public contract is.** If an existing export, route, event or
  schema column changes shape, say so — that is a breaking change and needs
  its own work package with a migration/compatibility step.

## Step 3 — Write the plan

Plans live in the repository, so a later session can resume the work:

```
.opencode/plans/<feature-slug>/
  _plan.md          # the plan itself
  001-<task>.md     # one file per work package
```

`<feature-slug>` is kebab-case and matches the feature
(`throw-correction-undo`, `career-quests-v2`, …).

### `_plan.md` structure

```markdown
# Plan: <Feature name>

## Created

2026-XX-XX

## Status

planned | in_progress | done | blocked

## Objective

One paragraph: the problem and the observable outcome.

## Discovery Notes

What you verified in the code — file:line facts, not assumptions. This is the
section that stops the next session from guessing.

## Scope

### In Scope

### Out of Scope

## Success Criteria

- [ ] Observable criterion 1
- [ ] Observable criterion 2

## Task Overview

| Task | Description | Owner       | Depends On | Files               | Status  |
| ---- | ----------- | ----------- | ---------- | ------------------- | ------- |
| 001  | ...         | game-engine | -          | src/game-engine/... | pending |
| 002  | ...         | frontend    | 001        | src/components/...  | pending |

## API Contract

The shapes that frontend and backend must agree on before either starts.

## Risks & Mitigations

| Risk | Mitigation |

## Progress log

- 2026-XX-XX — 001 done: <command and result>
```

### `NNN-<task>.md` structure

````markdown
# Task NNN: <title>

## Owner

game-engine

## Scope

What changes, in one paragraph.

## Files

- src/game-engine/modes/StandardMode.ts
- tests/unit/game-engine/modes/StandardMode.test.ts

## Acceptance Criteria

- [ ] A leg win resets every player's score to the start score
- [ ] The `modeData.legSet` progress records the leg winner
- [ ] The behaviour is covered by a test that fails without the change

## Verification

```bash
npx vitest run tests/unit/game-engine/modes/StandardMode.test.ts
npm run typecheck
npm run lint
```
````

## Result

(filled in after execution: the command output, the files changed, the
deviations from the plan)

````

## Step 4 — Quality bar for a plan

A plan is ready for approval when:

- every task has exactly one owning agent;
- no two tasks share a file, or they are explicitly sequenced with a
  dependency;
- every acceptance criterion is observable — "works correctly" is not a
  criterion, "a refused correction leaves the ledger and the state unchanged"
  is;
- every task names the command that proves it;
- the breaking-change impact (API, schema, exports, events) is stated;
- the out-of-scope list is explicit, so nobody smuggles extra work in;
- the discovery notes contain verified `file:line` facts.

## Step 5 — Present for approval

Before implementation, show the user:

1. the objective and the success criteria,
2. the task table with owners and files,
3. the decisions that need their input (one question, with a recommendation),
4. the total verification surface.

Then wait. Do not start implementing on a plan the user has not seen.

## Step 6 — Keep it alive

- Update the task table after **every** package — the status column must be
  honest, because it is the recovery mechanism after a context loss.
- Fill in the `## Result` section of each task file with the real command
  output.
- Append to the progress log with the date and what happened.
- When a task is blocked, record the reason and what is needed to unblock it.

## Verification before you report

```bash
# The paths in the plan must exist.
ls src/game-engine/modes/StandardMode.ts
# The owners must be real agents.
opencode debug agents
````

End with `PLAN_READY` or `PLAN_BLOCKED`.

---
description: Analyse a requirement, check it against the architecture, produce a plan with work packages and acceptance criteria, assign the owning agents, and present the plan for approval before any code is written.
agent: orchestrator
---

Plan the following DartHub work item. **Do not implement anything yet** — this
command produces a plan and stops for approval.

Requirement:

$ARGUMENTS

## 1. Analyse

- Read `AGENTS.md` and the relevant source. Verify every path you refer to —
  `docs/ARCHITECTURE.md` explicitly lists directories that do **not** exist
  (`src/services/`, `src/repositories/`, `src/dto/`, `src/domain/`,
  `src/infrastructure/`). Never plan against them.
- Identify the affected modules and the affected **files**.
- Check the existing tests and documentation in the area, so the plan does not
  re-invent or contradict what is already there.
- Load the `project-planning` skill and follow it.
- If the change crosses a layer boundary, changes a data model or changes a
  public contract, launch the `architect` subagent for the design before you
  write the plan.

## 2. Check the architecture

State explicitly for each affected area:

- which layer it belongs to and whether the dependency direction is respected;
- whether a public contract (export, route, socket event, Prisma model)
  changes shape — and if so, what the compatibility or migration step is;
- whether a new runtime dependency, a new directory or a paid service would be
  required (both need the user's approval, so they must be visible in the
  plan);
- whether the server-authoritative rule and the pure-domain-core rule still
  hold.

## 3. Produce the plan

Write it to `.opencode/plans/<feature-slug>/` with `_plan.md` plus one file
per work package, following the `project-planning` skill. Each package must
carry:

- the **owning agent** (`architect`, `game-engine`, `frontend`, `backend`,
  `qa-engineer`);
- the **exact files** it may touch;
- **acceptance criteria** that can be checked mechanically — "works
  correctly" is not a criterion;
- the **verification command** that proves it.

Mark dependencies explicitly. Two packages may only run in parallel when their
file sets are disjoint.

## 4. Assign the agents

| Change touches                                                                                                    | Agent         |
| ----------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/game-engine/`, `src/board/`, `src/ai/`, `src/camera/`                                                        | `game-engine` |
| `src/components/`, `app/` (except `app/api/`)                                                                     | `frontend`    |
| `src/auth/`, `src/rating/`, `src/career/`, `src/friends/`, `src/privacy/`, `src/realtime/`, `app/api/`, `prisma/` | `backend`     |
| `tests/` harness and meta tests, `e2e/`, Vitest/Playwright config                                                 | `qa-engineer` |
| `docs/`, decisions, plan structure                                                                                | `architect`   |

## 5. Present for approval

Show the user:

1. objective and success criteria;
2. the task table (owner, files, dependency, verification);
3. the decisions that need their input — as one question with your
   recommendation;
4. the total verification surface (which suites will run).

Then **stop**. Wait for the approval. Only after the user approves does
`/execute-plan` begin the implementation.

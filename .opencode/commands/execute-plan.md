---
description: Execute an approved plan step by step — delegate each work package to its owning agent, verify the result after every package, and keep the plan and the progress log up to date.
agent: orchestrator
---

Execute the approved DartHub plan.

Plan reference (a slug, a plan path or a feature name — if empty, use the most
recent plan in `.opencode/plans/`):

$ARGUMENTS

## Preconditions

- The plan must exist in `.opencode/plans/<slug>/_plan.md`.
- The plan must be approved. If it is not, or if the plan file is missing,
  say so and stop — do not improvise an implementation.
- Read `AGENTS.md` and the `_plan.md` before starting.

## 1. Resume correctly

Read the task table. Start at the first package that is not `done`. The status
column is the recovery mechanism — if it is out of date, trust the code, not
the table, and say so in the report.

## 2. Execute package by package

For each package:

1. **Read the package file** (`NNN-<task>.md`): scope, files, acceptance
   criteria, verification command.
2. **Delegate it** to its owning agent as a subagent, passing the full
   context: the goal, the files it may touch, the acceptance criteria, the
   project rules, and the instruction to report the actual command output.
   - `architect` → architecture, contracts, decisions, plan structure
   - `game-engine` → `src/game-engine/`, `src/board/`, `src/ai/`, `src/camera/`
   - `frontend` → `src/components/`, `app/` (except `app/api/`)
   - `backend` → `src/auth/`, `src/rating/`, `src/career/`, `src/friends/`,
     `src/privacy/`, `src/realtime/`, `app/api/`, `prisma/`
   - `qa-engineer` → test harness, meta tests, `e2e/`, tooling config
3. **Parallelise only independent packages.** Two agents that would touch the
   same file must be sequenced. If the plan does not say, treat the packages
   as dependent and sequence them.
4. **Verify the result yourself** after the package returns:
   - the acceptance criteria are met — check them, do not assume;
   - the verification command was actually run — read the output the agent
     reports, and re-run it yourself if the evidence is thin;
   - `npm run lint` and `npm run typecheck` stay clean;
   - the agent stayed inside its file ownership.
5. **Update the plan** immediately: the task table status and the `## Result`
   section of the package file, with the real command output, plus a dated
   entry in the progress log.

## 3. Handle failures honestly

- A failing test is a defect: hand it back to the owning agent, or fix it
  yourself if it is a one-line correction.
- A blocked package is recorded as `blocked` with the reason and what is
  needed to unblock it. **Never** mark it `done` and **never** delete the
  evidence.
- If a package turns out to need a file outside its ownership, stop, report
  the conflict and ask the orchestrator (you are the orchestrator) to reassign
  ownership explicitly — do not work around the permission.

## 4. Independent check

When all packages are done, launch the `code-reviewer` subagent over the whole
change and the `qa-engineer` subagent for an independent verification run.
Fix what they find, or record each finding that is consciously accepted as a
known issue in the plan, with the reason.

## 5. Report

Update the plan one final time, then report:

- the packages executed, with their real results;
- the files changed;
- the commands that were run and their outcome;
- the review findings and their disposition;
- what is still open.

End with `ORCHESTRATOR_COMPLETE` or `ORCHESTRATOR_BLOCKED`. Never report a
package as done without the verification output behind it.

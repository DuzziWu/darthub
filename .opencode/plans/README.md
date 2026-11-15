# OpenCode feature plans

This directory holds the plans of the OpenCode agent team. A plan is written
**before** the implementation and updated **after** every work package, so a
new session can resume the work without guessing.

```
.opencode/plans/<feature-slug>/
  _plan.md          objective, discovery notes, scope, success criteria,
                    task table (owner / files / dependency / status),
                    API contract, risks, progress log
  001-<task>.md     one file per work package: scope, files, acceptance
                    criteria, verification command, result
  NNN-review.md     independent review findings and their disposition
```

Rules:

- `<feature-slug>` is kebab-case and matches the feature
  (`throw-correction-undo`, `career-quests-v2`, …).
- The **status** column in the task table is the recovery mechanism. It is
  only useful if it is honest: `pending` → `in_progress` → `done` /
  `blocked`.
- Every package file ends with a `## Result` section holding the **actual**
  command output. Without it, "done" is a claim, not a fact.
- A `blocked` package records what is blocking it and what would unblock it.
- Plans never contain secrets and never commit credentials.

The format follows the existing convention in `.claude/plans/` (which belongs
to the Claude Code workflow) so both workflows stay readable side by side.

Start a plan with the `/start-feature` command, execute it with
`/execute-plan`.

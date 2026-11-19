---
description: Independent review of the current changes — a read-only code reviewer and an independent QA verification, with findings ordered by criticality.
agent: orchestrator
---

Review the current DartHub changes independently.

Scope (a feature name, a plan slug, a path, or empty for "everything that is
currently changed"):

$ARGUMENTS

## 1. Establish the scope

```bash
git status --short
git diff --stat
git diff
```

If a plan exists for this work (`.opencode/plans/<slug>/`), read it and use its
acceptance criteria as the yardstick. Uncommitted work in the repository that
belongs to the user must **not** be modified, reverted or deleted by this
command — it is reviewed, never touched.

## 2. Code review (read-only)

Launch the `code-reviewer` subagent with the diff, the changed files and the
acceptance criteria. It is read-only by configuration and will not change
anything.

It reports findings ordered by severity:

- **CRITICAL** — security hole, data loss, corrupted game state, broken
  invariant
- **HIGH** — wrong behaviour on a realistic path, missing authorisation,
  missing migration, broken build or type error
- **MEDIUM** — missing edge case, missing test on a risky path,
  maintainability trap
- **LOW** — style, naming, duplication

It ends with `APPROVE`, `APPROVE_WITH_COMMENTS` or `REQUEST_CHANGES`.

## 3. Independent QA verification

Launch the `qa-engineer` subagent in parallel — it does not modify the
implementation. It:

- runs the relevant suites and reports the **real** output;
- checks that every new behaviour has a test, including the negative case and
  the boundary values;
- reproduces each defect it suspects, with a failing test name;
- checks that the test suite is deterministic (no clock, no randomness, no
  network, no sleeps).

```bash
npm run test
npm run lint
npm run typecheck
```

## 4. Reconcile and report

Merge the two reports into one list, ordered by severity, without duplicates:

| Severity | Source        | Status | Fix owner             |
| -------- | ------------- | ------ | --------------------- |
| CRITICAL | code-reviewer | open   | backend / game-engine |
| …        |               |        |                       |

For every finding: the file and line, the defect, the concrete failure, the
smallest correct fix, and the owning agent. Distinguish a **verified
reproduction** from an **unverified suspicion** — do not mix them.

End with the overall verdict: `REVIEW_COMPLETE` (with the number of open
findings per severity) or `REVIEW_BLOCKED` (with what could not be reviewed
and why).

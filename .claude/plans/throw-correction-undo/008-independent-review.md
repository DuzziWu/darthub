# Task 008: Independent review of the whole change

**Status**: pending
**Depends on**: [005, 006, 007]
**Retry count**: 0

## Description
Have the change reviewed independently, against the repository rather than against the plan. The reviewer checks the recalculation is genuinely correct in every mode, that no dart can be double-recorded, that the attribution rule holds, and that the UI matches the design system. The reviewer also confirms the existing tests were not weakened to fit the new behaviour.

## Context
- Related files: the whole diff — `src/game-engine/**`, `src/components/game/**`, `src/components/x01/**`, `app/game/**`, `tests/**`, `src/game-engine/README.md`
- Patterns to follow: the DevFlow `devflow:code-reviewer` role — an independent, read-only review that reports correctness, regressions, maintainability and acceptance criteria separately.
- The riskiest property of this change is that replay replaces the direct recording path for *all* state. A reviewer should read `GameEngine` as a whole and ask whether any path can now produce a state the direct path could not.
- The second riskiest is double-recording: the old code kept the darts in the view *and* counted them in the engine. The reviewer should confirm there is now exactly one record.
- The plan's success criteria are the acceptance checklist.

## Requirements (Test Descriptions)
Write requirements as exact test names. These become the test method names.

- [ ] `it confirms the recalculation is correct in every game mode`
- [ ] `it confirms no dart can be recorded twice`
- [ ] `it confirms a correction never moves a dart between players`
- [ ] `it confirms a refused correction leaves the state untouched`
- [ ] `it confirms the existing tests were not weakened`
- [ ] `it confirms the undo and correct controls meet the design system`
- [ ] `it confirms the change adds no runtime dependency`

## Acceptance Criteria
- The review is independent and read-only: the reviewer does not edit the code.
- Every acceptance criterion of this plan is checked and reported on.
- Findings are reported with a file, a line and a concrete failure scenario, not a general impression.
- Any finding of severity high or critical is fixed and re-reviewed before the task closes.

## Implementation Notes

- Review the repository as it stands, not against this plan. The plan can be wrong; the code is the truth.
- The `matches` skill and the `code-review` command are available for the diff review; the DevFlow code-reviewer role adds the acceptance-criteria pass on top.
- Report the review to the orchestrator as a handoff, not as a chat summary.

Leave blank for the implementer.

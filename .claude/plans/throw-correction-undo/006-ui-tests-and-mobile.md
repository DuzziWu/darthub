# Task 006: UI tests and mobile verification

**Status**: pending
**Depends on**: [004]
**Retry count**: 0

## Description
Prove the undo and correct flow works in the views and on a phone. The view-level tests cover the interaction — arming a dart, choosing a replacement, undoing, the confirmation for a finished turn — and the visual-QC pass checks the three widths the design system defines.

## Context
- Related files: `tests/unit/ui/*.test.tsx`, `e2e/*.spec.ts`, `e2e/visual-qc-helpers.ts`
- Patterns to follow: the existing UI test style in `tests/unit/ui/` (`career.test.tsx`, `dashboard.test.tsx`, `lobby.test.tsx`, `secondaryPages.test.tsx`) and the Playwright specs in `e2e/` (`game-center.spec.ts`, `hub-pages.spec.ts`, `visual-qc.spec.ts`).
- `playwright.config.ts` — a single `chromium` project at `http://localhost:3000`, with `webServer` started only under CI. The local run must reuse an already-running dev server.
- `src/components/game/useIsCompact.ts` — the md breakpoint (767px) is where the board becomes a read-only preview and the pad is the only input. The correction flow must be complete without the board at that width.
- `design-system/darthub/MASTER.md` — the visual-QC widths are 1440, 1024 and 390.
- `DESIGN.md:258` — the match-view mockup the result is compared against.

## Requirements (Test Descriptions)
Write requirements as exact test names. These become the test method names.

- [ ] `it removes the last dart when the undo button is pressed`
- [ ] `it disables the undo button before the first dart`
- [ ] `it arms a dart when it is tapped`
- [ ] `it replaces the armed dart with the value chosen on the pad`
- [ ] `it cancels a correction without changing the darts`
- [ ] `it asks for confirmation before correcting a dart from a finished turn`
- [ ] `it corrects a dart from the turn in progress without a confirmation`
- [ ] `it updates the remaining score after a correction`
- [ ] `it updates the marks after a correction in cricket`
- [ ] `it keeps the dart pad and the board in step while correcting`
- [ ] `it can undo and correct with the keyboard only`
- [ ] `it completes a correction on a 390px viewport using the dart pad`

## Acceptance Criteria
- All requirements have passing tests.
- The correction flow is verified at 390px width, where the board is a preview and the pad is the only input.
- The visual-QC pass covers 1440, 1024 and 390 and finds no regression against `DESIGN.md`.
- The `md` breakpoint behaviour is unchanged for a match that does not use undo or correct.

## Implementation Notes

Design decisions already settled (do not re-open):

- Test the *behaviour* — the darts, the score, the target — rather than the class names of the chips. The design system's chips are restyled over time; the behaviour is the contract.
- The confirmation for a finished turn is an explicit visible step. Test that it appears and that it can be dismissed without changing anything.
- The existing Playwright specs must still pass. Do not weaken them.

Leave blank for the implementer.

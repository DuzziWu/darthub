# Task 003: Shared throw-history UI — undo button, tappable darts, correction flow

**Status**: pending
**Depends on**: [002]
**Retry count**: 0

## Description
Build the shared UI for undoing and correcting darts, once, so the four match views can each adopt it without re-implementing it. The pieces: an undo button that removes the last entered dart; darts that can be tapped to become the correction target; and a replacement-value step that uses the dart pad that already exists. The correction target is armed the same way the segment band is armed — one control, one state, two read-outs — rather than with a modal, because the repo has no dialog component and no Radix dependency.

## Context
- Related files: `src/components/game/types.ts`, `src/components/game/classes.ts`, `src/components/game/VisitChips.tsx`, `src/components/game/ScoreDisplay.tsx`, `src/components/game/ThrowInputPad.tsx`, `src/components/game/MatchLayout.tsx`, `src/components/game/MatchStatus.tsx`
- Patterns to follow: the **armed-band** pattern in `ThrowInputPad.tsx` — a band is armed, then a sector is picked, and the armed state is shared with the board. The correction flow follows the same two-stage shape: a dart is armed as the correction target, then the pad supplies the replacement value.
- `src/components/game/VisitChips.tsx:37` — the visit chips already render each dart with its badge; they become the tap targets.
- `src/components/game/ScoreDisplay.tsx:55` — the score sheet renders each player's last three darts; those are the same darts.
- `src/components/game/classes.ts` — the shared class strings. The new controls must use these tokens, not new colours.
- `src/components/game/types.ts` — the shared prop types. The new components' props belong here, next to the existing ones.
- `DESIGN.md:258` — the match-view mockup already draws `[UNDO] [MENU]` in the throw strip. Follow it.
- `src/components/game/useIsCompact.ts` — below the md breakpoint the board is a read-only preview and the pad is the input. The correction flow must work with the pad alone at that width.
- `design-system/darthub/MASTER.md:792` — the z-index scale. Do not invent a stacking context.

## Requirements (Test Descriptions)
Write requirements as exact test names. These become the test method names.

- [ ] `it renders an undo button in the throw strip`
- [ ] `it disables the undo button when no dart has been entered`
- [ ] `it disables the undo button when the match is completed`
- [ ] `it makes each entered dart tappable for correction`
- [ ] `it marks the tapped dart as the correction target`
- [ ] `it replaces the correction target with the value chosen on the pad`
- [ ] `it clears the correction target when the correction is cancelled`
- [ ] `it asks for confirmation before correcting a dart from a finished turn`
- [ ] `it does not ask for confirmation when correcting a dart from the turn in progress`
- [ ] `it shows the correction target in the visit strip`
- [ ] `it announces the corrected dart to assistive technology`
- [ ] `it reaches the undo and correct controls by keyboard`

## Acceptance Criteria
- All requirements have passing tests.
- One shared implementation; the four views consume it rather than copying it.
- The controls reuse `classes.ts` tokens and the existing chip vocabulary — no new colours, no new spacing scale.
- Fully operable with the keyboard, and at 390px width with the board as a read-only preview.
- The armed correction target is announced, not signalled by colour alone.
- Code follows project standards; no new runtime dependency.

## Implementation Notes

Design decisions already settled (do not re-open):

- **Each view owns its own `GameEngine` and its own `ThrowInputPad`** (`src/components/game/ThrowInputPad.tsx:39`). So the shared code is a *presentational* component plus a *view-level* hook — not a component that owns the engine. The shared component takes plain props (`throws`, `correctionTarget`, `awaitingConfirmation`, `canUndo`, `onSelectThrow`, `onUndo`, `onConfirm`, `onCancel`); the **view** owns the armed correction target and routes the pad's `onThrow` to it — when a target is armed the pad's value corrects that dart, otherwise it is a new throw.
- The correction flow is two-stage and follows the armed-band pattern: tapping a dart *arms* it as the correction target; the next value chosen on the dart pad replaces it. There is no modal — the repo has no dialog component and no Radix dependency, and the pad is already the pointer, touch and keyboard path on mobile.
- The undo button lives in the throw strip beside the existing actions, matching `DESIGN.md:258`.
- The button variants are fixed by the design system (`design-system/darthub/MASTER.md:661`): `secondary` for the undo button (it is "everything else"), `ghost` for cancel, and `danger` (`bg-double`) **only** for the destructive confirmation of a finished-turn correction — that is the one documented use of the danger token. Height 44px minimum, radius `--radius-sm`, label font `font-label`. Exactly one `primary` button per surface, so the undo button must not be primary.
- Only darts in the turn in progress are corrected directly. A dart from a finished turn requires an explicit confirmation step before it is armed. This is the confirmation the request asks for; it is a visible, deliberate step, not a dialog.
- **Undo must remain reachable on a completed match.** The match-winning dart is the one a player is most likely to have mis-tapped, so the undo control has to be available in the result phase too. Today the result phase replaces the whole tree (`src/components/x01/X01MatchView.tsx:224-236`), so there is no strip at completion — the result phase needs an undo affordance, and undoing the winning dart must return the match to the playing phase.
- The dart chips are the tap targets, and they must remain readable as chips — a dart that can be corrected is still a dart chip, not a button that looks like a dart.
- The correction target is announced to assistive technology; the existing visit strip is an `aria-label="Current visit"` list.

Leave blank for the implementer.

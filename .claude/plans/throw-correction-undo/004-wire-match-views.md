# Task 004: Wire the four match views to the shared undo/correct

**Status**: pending
**Depends on**: [003]
**Retry count**: 0

## Description
Adopt the shared undo/correct UI in the four local match views — x01 (501/301), cricket, around-the-clock and shanghai — and remove the visit bookkeeping each view keeps on its own. Today each view holds its own `VisitEntry[]` beside the engine's `throwCount`, and each re-implements record → visit → announce. The engine's ledger now holds that record, so the views read it instead of maintaining a second copy.

## Context
- Related files: `src/components/x01/X01MatchView.tsx`, `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx`, `src/components/game/types.ts`, `src/components/game/VisitChips.tsx`
- Patterns to follow: each view already owns its phase (`"setup" | "playing" | "result"`), its engine instance, its match state and its announcement string. Keep that shape; replace only the duplicated visit bookkeeping.
- `src/components/x01/X01MatchView.tsx:138-192` — the x01 record path: it computes `remainingBefore`, decides the bust locally via `isBustThrow`, and on a bust stores a `VisitEntry` with `bust: true` in its own `visits` map. The engine now records the bust, so the view must stop deciding it a second time.
- `src/components/x01/X01MatchView.tsx:67` — `isBustThrow` is exported from the view; check whether it still has a caller after the refactor and remove it if not.
- `app/game/cricket/page.tsx:60`, `app/game/around-the-clock/page.tsx:60`, `app/game/shanghai/page.tsx:79` — the same pattern in the other three views, single-player and simpler.
- `src/components/game/ScoreDisplay.tsx:55` — the score sheet's per-player dart chips come from `throwHistory`; the views feed it their own visit array today.
- `src/components/game/types.ts:31` — `VisitEntry` is the current shape of a dart in the UI. The ledger replaces it as the source of truth.

## Requirements (Test Descriptions)
Write requirements as exact test names. These become the test method names.

- [ ] `it shows the entered darts in the visit strip`
- [ ] `it shows a busting dart as a bust in the visit strip`
- [ ] `it shows each player's darts on the score sheet`
- [ ] `it removes the last dart when the undo button is pressed`
- [ ] `it replaces the tapped dart when a correction value is chosen`
- [ ] `it updates the remaining score after an undo`
- [ ] `it updates the remaining score after a correction`
- [ ] `it updates the marks after a correction in cricket`
- [ ] `it updates the target after a correction in around the clock`
- [ ] `it updates the round after a correction in shanghai`
- [ ] `it disables the dart pad when the match is completed`
- [ ] `it keeps the board and the pad in step while correcting`
- [ ] `it allows the match-winning dart to be undone from the result phase`
- [ ] `it returns to the playing phase after the match-winning dart is undone`

## Acceptance Criteria
- All requirements have passing tests.
- No view keeps its own copy of the darts. The ledger is the only record.
- The four views differ only in mode, player count and their score surface — the undo/correct wiring is the shared code from task 003.
- The x01 bust handling has exactly one owner. If `isBustThrow` in the view becomes unused, it is removed.
- The result phase still shows the result banner and still refuses further darts, but it does offer undo, and undoing the winning dart returns the match to play.
- Code follows project standards; no new runtime dependency.

## Implementation Notes

Design decisions already settled (do not re-open):

- The views read the darts from the engine's ledger. The local `visits`/`visit` state and the local bust bookkeeping are removed, not kept in sync.
- The x01 view's per-player visit grouping is a *view* concern (it shows the current turn's darts per player) and stays in the view; the darts themselves come from the ledger.
- The other three views are single-player and show one turn's darts.
- **Undo must be reachable on a completed match.** The result phase replaces the whole tree today (`src/components/x01/X01MatchView.tsx:224-236`), so the result phase needs an undo affordance, and undoing the match-winning dart must return the match to the playing phase. The engine permits this (task 002).
- The existing announcement strings stay — the correction and undo paths announce what they did, in the same voice.
- Do not add a per-view undo or correct implementation. If a view needs something the shared component does not offer, extend the shared component.

Leave blank for the implementer.

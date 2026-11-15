# 006 — M6: The result screen can be undone from in every mode

**Owning agent:** `frontend`
**Plan:** `docs/superpowers/plans/2026-11-12-game-modes.md` → Task M6
**Binding rulings:** B3/C1, B6/C2, C1, C2, C3, C4
**Pre-flight:** `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`

## Scope

Every mode's result screen offers "Undo last dart", and the undo returns the match to play.

> **This package is not test-only in this tree.** The 2026-11-12 draft claimed all four views
> already passed `onUndo`. Re-verified on 2026-11-15 against `d73c37f`: only the **cricket**
> view does (`app/game/cricket/page.tsx:239`). The around-the-clock, shanghai and x01 views
> render `<GameResultBanner>` **without** an `onUndo` prop. This package therefore **wires the
> three missing views** and then pins all four with tests.

**In scope**

- `onUndo={handleUndo}` in the around-the-clock, shanghai and x01 result banners.
- A banner test that the undo action renders when it is given one.
- A view test per mode: play to a win, press "Undo last dart", assert the match is back in play.

**Out of scope**

- The banner **component** — its `onUndo` prop (`src/components/game/types.ts:151-155`) and its
  button (`src/components/game/GameResultBanner.tsx:102-110`) already exist and are **not**
  changed.
- The engine's undo — `GameEngine.undoLastThrow` works.
- `src/realtime/`, `app/api/`.

## Files

**Owned by `frontend` (this package edits these):**

| File                                        | What changes                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `app/game/around-the-clock/page.tsx`        | `onUndo={handleUndo}` on the result banner.                                                                |
| `app/game/shanghai/page.tsx`                | `onUndo={handleUndo}` on the result banner. **After M5** — a different region from M5's result wiring.     |
| `src/components/x01/X01MatchView.tsx`       | `onUndo={handleUndo}` on the result banner. **After M4** — a different region from M4's match-format work. |
| `tests/unit/game/modeViews.test.tsx`        | One `it(...)` block per mode. **Last** (M1 → M2 → M3 → M6).                                                |
| `tests/unit/game/gameResultBanner.test.tsx` | The "renders the undo action when given one" test. **After M5** — a different `it(...)` block.             |

**No other file may be touched by this package.** In particular this package does **not** edit
`src/components/game/GameResultBanner.tsx` or `src/components/game/types.ts` — the prop and the
button already exist.

## File-conflict resolution

- `app/game/shanghai/page.tsx` — **after M3 and M5** (M3 → M5 → M6). M3 owns the two-player
  rewrite; M5 owns the result wiring; M6 owns the `onUndo` wiring.
- `src/components/x01/X01MatchView.tsx` — **after M4** (M4 → M6). M4 owns `MATCH_FORMATS`, the
  `legs` / `sets` state and `playAgain`; M6 owns the `onUndo` prop.
- `tests/unit/game/modeViews.test.tsx` — **last** (M1 → M2 → M3 → M6); each package appends its
  own `it(...)` block.
- `tests/unit/game/gameResultBanner.test.tsx` — **after M5** (M5 → M6); each package appends its
  own `it(...)` block.
- `src/components/game/GameResultBanner.tsx` — **no conflict**: this package does not touch it.

## Binding rulings — what they forbid

- **B3 / C1 — no `@testing-library/jest-dom`.** `expect(...).toBeTruthy()`. The repository has
  only `@testing-library/dom` and `@testing-library/react` (`package.json:47-48`).
- **B6 / C2 — existing tests are updated, never deleted or weakened.** The existing undo suite
  `tests/unit/game/undoAcrossModes.test.tsx:63-80` is the pattern to follow; it must stay green.
- **C3 — one record of the darts.** The undo goes through `history.undo()`; the view keeps no
  private copy of a dart.
- **C4 — no commit.**

## Acceptance Criteria

1. `app/game/around-the-clock/page.tsx` — the result banner receives `onUndo={handleUndo}`.
2. `app/game/shanghai/page.tsx` — the result banner receives `onUndo={handleUndo}`.
3. `src/components/x01/X01MatchView.tsx` — the result banner receives `onUndo={handleUndo}`.
4. `app/game/cricket/page.tsx` is **unchanged** — it already passes `onUndo` (`:239`).
5. `src/components/game/GameResultBanner.tsx` is **unchanged** — the button already renders when
   `onUndo` is present (`:102-110`).
6. A banner test asserts the "Undo last dart" button renders when the prop is given, and does
   **not** render when it is not.
7. One view test per mode (cricket, around the clock, shanghai, x01): play to a win, press
   "Undo last dart", assert the match is back in play and the score is the pre-winning value:
   - Cricket — close all seven targets with three singles each → the sheet is back, the marks
     are one fewer.
   - ATC — hit all 21 targets → the target is back to the last one.
   - Shanghai — reach round 7 → the round is back to round 6.
8. Each mode's `handleUndo` sets `setPhase("playing")` and `setWinnerId(null)` — the shape
   `app/game/cricket/page.tsx:126-135` already uses. If a mode's undo does not return the match
   to play, **that mode is fixed**, not the test.
9. The obsolete 2026-11-12 reference `tests/unit/game/x01MatchView.test.tsx:246-270` is **not**
   re-created — that file is 188 lines and holds no undo assertion. The pattern is
   `tests/unit/game/undoAcrossModes.test.tsx:63-80`.
10. `npm run typecheck`, `npm run lint`, `npm run format:check` are clean.

## Verification command

```bash
npx vitest run tests/unit/game/modeViews.test.tsx tests/unit/game/gameResultBanner.test.tsx tests/unit/game/undoAcrossModes.test.tsx && npm run typecheck && npm run lint && npm run format:check
```

## Result

<!-- Filled in when the package is executed. -->

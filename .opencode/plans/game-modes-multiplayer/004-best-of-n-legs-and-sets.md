# 004 — M4: Best-of-N legs and sets, reachable from the setup

**Owning agent:** `frontend`
**Plan:** `docs/superpowers/plans/2026-11-12-game-modes.md` → Task M4
**Binding rulings:** B3/C1, B6/C2, B9, C1, C2, C6, C4
**Pre-flight:** `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`

## Scope

Let a player choose a match format — single leg, best of 3 legs, best of 5 legs — and make the
engine honour it and the score sheet show it.

**In scope**

- `PlayerSetup` offers a match-format radio group and reports the choice back.
- `PlayerSetupOptions` gains `legs?: number` and `sets?: number`; `PlayerSetupProps` gains
  `matchFormat?: readonly MatchFormatChoice[]`.
- `X01MatchView` passes the chosen sizes into the engine's match configuration and keeps them
  across "Play again".
- The score sheet's header shows `Leg 2/3` / `Set 1/2`.
- The engine **seeds** the leg/set slice so the readout has something to read.

**Out of scope**

- The realtime path (`src/realtime/`) — untouched.
- The three non-x01 modes: they offer no format choice, so the setup is unchanged for them
  (the `matchFormat` prop is optional and absent there).
- The tie / result mechanism (M5), the undo wiring (M6).

## Files

**Owned by `frontend` (this package edits these):**

| File                                                                                                      | What changes                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/game/PlayerSetup.tsx`                                                                     | The format radio group; `handleStart` passes `legs` / `sets`.                                                                                                                                 |
| `src/components/game/types.ts` **§ `PlayerSetupOptions` / `PlayerSetupProps` / `MatchFormatChoice` only** | The new options and the new optional prop.                                                                                                                                                    |
| `src/components/x01/X01MatchView.tsx`                                                                     | `MATCH_FORMATS`, `matchFormat={MATCH_FORMATS}`, `legs` / `sets` passed to `startMatch`, the `leg` / `set` descriptors, and `playAgain` carries the sizes.                                     |
| `src/components/game/ScoreDisplay.tsx`                                                                    | **No change expected** — it already accepts and renders `leg` and `set` (`src/components/game/ScoreDisplay.tsx:29-38`). Listed so the implementer verifies it rather than widening the props. |
| `tests/unit/game/playerSetup.test.tsx`                                                                    | The new setup test.                                                                                                                                                                           |
| `tests/unit/game/x01MatchView.test.tsx`                                                                   | The new view test.                                                                                                                                                                            |

**Coordinated — `game-engine` agent's area, executed by that agent, sequenced BEFORE the
frontend half (the view reads what the engine seeds):**

| File                                                | What changes                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game-engine/modes/StandardMode.ts`             | `initializeMatch` seeds `LEG_SET_MODE_DATA_KEY` with `LegSetManager.initialProgress()` whenever a leg/set manager is active. **Only** `initializeMatch` (`:89-93`) changes.                                                                             |
| `tests/unit/game-engine/modes/StandardMode.test.ts` | The two pin tests: the leg structure survives an undo; a leg win is recorded in the mode's own state. **This file lives under `tests/unit/game-engine/` and therefore belongs to the `game-engine` agent** — the `frontend` agent does **not** edit it. |

**No other file may be touched by this package.**

## File-conflict resolution

- `src/components/game/types.ts` — **appended to after M1, M2 and M3** (M1 → M2 → M3 → M4).
  Only the `PlayerSetup*` types and `MatchFormatChoice` change here.
- `src/components/x01/X01MatchView.tsx` is also wanted by **M6** (the `onUndo` wiring).
  **M4 → M6**, and the two touch different regions: M4 owns `MATCH_FORMATS`, the `legs` / `sets`
  state and the `playAgain` call; M6 owns the `onUndo` prop on the result banner.
- `src/components/game/ScoreDisplay.tsx` is wanted by **no other package** in this plan.
- `tests/unit/game-engine/modes/StandardMode.test.ts` is wanted by **no other package** in this
  plan, and it is owned by the `game-engine` agent — see the coordinated block above.

## Binding rulings — what they forbid

- **B9 (load-bearing) — the leg/set slice must be seeded, and the sizes must reach the view.**
  `Leg 1/3` **cannot render today**. `StandardMode.initializeMatch`
  (`src/game-engine/modes/StandardMode.ts:89-93`) sets only `player.totalPoints`; the
  `LEG_SET_MODE_DATA_KEY` slice (`src/game-engine/rules/LegSetManager.ts:118`, value `"legSet"`)
  is written **only** in `handleLegCompleted` (`:149`), i.e. after the first leg ends. Two
  things are therefore required:
  1. `initializeMatch` seeds the key with `LegSetManager.initialProgress()`
     (`src/game-engine/rules/LegSetManager.ts:77-78`) when a leg/set manager is active.
  2. The **sizes** must also reach the view. The view's own reader
     (`src/components/x01/X01MatchView.tsx:69-80`) reads the key and then returns `{}` on
     purpose — "the sizes the match was configured with are not in the state: without them there
     is no honest '2/5' to show". So the seeded slice alone is **not** enough: either the
     configured sizes are added to the seeded progress, or the view keeps the chosen sizes in
     its own state (it already holds `outRule` and `boardSource` there at `:111-112`) and
     combines them with the engine's won-counts.
- **B3 / C1 — no `@testing-library/jest-dom`.** `expect(...).toBeTruthy()`. The repository has
  no `@testing-library/user-event` either — use `fireEvent`, as
  `tests/unit/game/playerSetup.test.tsx` already does.
- **B6 / C2 — existing tests are updated, never deleted or weakened.**
- **C6 — one `primary` per surface.** The new radio group reuses the existing vocabulary from
  `src/components/game/classes.ts` (`RADIO_CELL` `:107`, `RADIO_INPUT` `:110`, `RADIO_MARK`
  `:114`). The format group's `name="match-format"` must not collide with the checkout or
  board-source radio names.
- **C4 — no commit.**

## Acceptance Criteria

1. `PlayerSetupOptions` gains `legs?: number` and `sets?: number`; `PlayerSetupProps` gains
   `readonly matchFormat?: readonly MatchFormatChoice[]`.
2. `MatchFormatChoice` is `{ readonly id: string; readonly label: string; readonly legs?: number;
readonly sets?: number }` and is exported.
3. When `matchFormat` is absent (the three non-x01 modes), the setup renders **no** format
   group and the three modes are unchanged.
4. The format group is a `role="radiogroup"`, its accessible name is the format's label, and
   the first choice is selected by default.
5. `handleStart` reports the chosen `legs` / `sets` to `onStart`.
6. `X01MatchView` passes `legs` / `sets` into `engine.startMatch({ ... })`.
7. `playAgain` carries `legs` / `sets` — "Play again" must not silently drop the format.
8. The score sheet's header shows `Leg 1/3` when three legs are configured.
9. `StandardMode.initializeMatch` seeds the `legSet` slice; the mode's own
   `readLegSetProgress` finds it after `startMatch`, before any leg has ended.
10. The two engine pin tests pass: the leg structure survives an undo; a leg win is recorded
    (`legsWon` is `{ alice: 1 }`, `matchWinnerId` is `null`).
11. `npm run typecheck`, `npm run lint`, `npm run format:check` are clean.
12. `tests/unit/game-engine/frameworkAgnostic.test.ts` stays green.

## Verification command

```bash
npx vitest run tests/unit/game/playerSetup.test.tsx tests/unit/game/x01MatchView.test.tsx tests/unit/game-engine/modes/StandardMode.test.ts && npm run typecheck && npm run lint && npm run format:check
```

## Result

<!-- Filled in when the package is executed. -->

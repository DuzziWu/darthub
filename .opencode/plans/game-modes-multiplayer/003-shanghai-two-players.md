# 003 — M3: Shanghai — the round advances on turns, and two players score separately

**Owning agent:** `game-engine`
**Plan:** `docs/superpowers/plans/2026-11-12-game-modes.md` → Task M3
**Binding rulings:** A5, B1, B3/C1, B6/C2, B7, C1, C2, C3, C4
**Pre-flight:** `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`

## Scope

Record what every player scored in every Shanghai round, and let the sheet show it.

**In scope**

- `ShanghaiModeData` gains a per-player dart count (`dartsThisRound`) and a per-player round
  history (`finishedRounds`); `totalDartsThisRound` is dropped.
- The round advances when **every** player has thrown three darts.
- The sheet becomes a table: one row per player, one column per round.
- The view reads the round table from the **mode's state**, not from the raw ledger.

**Out of scope**

- The tie / result mechanism — that is M5.
- The undo wiring — that is M6.
- `src/realtime/`, `app/api/`.

## Files

**Owned by `game-engine` (this package edits these):**

| File                                                | What changes                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game-engine/modes/ShanghaiMode.ts`             | `ShanghaiModeData` reshaped; `applyThrow` records the marks and advances the round per player; the **Shanghai early return is kept**. |
| `tests/unit/game-engine/modes/ShanghaiMode.test.ts` | New tests for the per-player round history; the existing Shanghai test at `:86-97` still passes unchanged.                            |

**Coordinated — `frontend` agent's area, executed by that agent, sequenced AFTER the engine half:**

| File                                                                | What changes                                                                                                                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/game/ShanghaiScoreSheet.tsx`                        | A table: one row per player, one column per round, plus a total column. The S/D/T strip (`SEGMENTS`, the `hit` prop) stays.                                                                        |
| `src/components/game/types.ts` **§ `ShanghaiScoreSheetProps` only** | `marksByRound: Record<string, number>` is **removed**; `players: ReadonlyArray<{ id; name; marksByRound: number[] }>` and `currentPlayerId?: string \| null` are added, following M1's convention. |
| `app/game/shanghai/page.tsx`                                        | `playerIdsFor(names)`, `maxPlayers={2}`, the round table from the mode's state, the `hit` strip from the **current** player's record.                                                              |
| `tests/unit/game/modeViews.test.tsx`                                | One new `it(...)` block, **appended**.                                                                                                                                                             |

**No other file may be touched by this package.**

## File-conflict resolution

- `src/components/game/types.ts` — **appended to after M1 and M2** (M1 → M2 → M3). Only
  `ShanghaiScoreSheetProps` changes here.
- `tests/unit/game/modeViews.test.tsx` — **appended to after M1 and M2** (M1 → M2 → M3).
- `src/game-engine/modes/ShanghaiMode.ts` and
  `tests/unit/game-engine/modes/ShanghaiMode.test.ts` are also wanted by **M5** (the result
  accessor and the dedicated Shanghai flag). **M3 → M5**, and M5 changes a _different_ region:
  M3 owns the data shape and `applyThrow`; M5 owns the `result(state)` accessor and the
  `shanghaiWinnerId` flag.
- `app/game/shanghai/page.tsx` is also wanted by **M5** (result wiring) and **M6** (`onUndo`
  wiring). **M3 → M5 → M6**, each touching a different region.

## Binding rulings — what they forbid

- **B7 (load-bearing) — the Shanghai early return MUST be kept.** The early return is at
  `src/game-engine/modes/ShanghaiMode.ts:86-89` and is pinned by
  `tests/unit/game-engine/modes/ShanghaiMode.test.ts:86-97` ("detects Shanghai and completes the
  match immediately": `status === "completed"`, `currentPlayerId === null`, 6 marks). The
  round-advance block runs **after** it, and the early-return path must **skip** the round
  advance — a Shanghai ends the **match**, not the round.

  ```ts
  // Check for Shanghai (all three segments hit in one round).
  if (record.hitSingle && record.hitDouble && record.hitTriple) {
    draft.modeData = structuredClone(data);
    return; // ← the match ends here; the round does NOT advance
  }
  ```

  Cost if wrong: the "Shanghai!" win silently stops working and an existing test goes red.

- **A5 — the Shanghai win check must never read `roundRecords`.** `roundRecords` is cleared at
  the round advance (`src/game-engine/modes/ShanghaiMode.ts:96`), so a completed round's flags
  no longer exist there. M5 therefore adds a **dedicated mode flag** (`shanghaiWinnerId`) — M3
  must not create a second place where the flags live.
- **B6 / C2 — existing tests are updated, never deleted or weakened.**
  `tests/unit/game-engine/UndoCorrectModes.test.ts:215` asserts `totalDartsThisRound` is 2; it
  must be **updated** to the new shape.
- **B3 / C1 — no `@testing-library/jest-dom`.** `expect(...).toBeTruthy()`.
- **B1 — the player's name is its own element**, so `getByText("Alice")` matches; the "ON TURN"
  marker must not be concatenated into the same cell text.
- **C3 — one record of the darts.** The view reads the engine's state; the old
  `marksByRoundFromLedger` helper (`app/game/shanghai/page.tsx:59-68`) is replaced by a
  mode-derived one.
- **C4 — no commit.**

## Acceptance Criteria

1. `ShanghaiModeData` is
   `{ currentRound: number; dartsThisRound: Record<string, number>; roundRecords: Record<string, ShanghaiRoundRecord>; finishedRounds: Record<string, number[]> }`.
   `totalDartsThisRound` is gone.
2. `ShanghaiRoundRecord` is created, exported and used by `roundRecords`.
3. `applyThrow` increments the **thrower's** counter, adds the marks to that player's round
   record, and advances the round only when **every** player has thrown three darts.
4. Each finished round's marks are appended to that player's `finishedRounds`.
5. **The Shanghai early return is intact** and the Shanghai test at
   `tests/unit/game-engine/modes/ShanghaiMode.test.ts:86-97` still passes. _(B7)_
6. `requireModeData` seeds all four fields.
7. `src/components/game/ShanghaiScoreSheet.tsx` renders a table: one row per player, one
   column per round, plus a total column. The S/D/T strip stays and reports the round in play
   for everyone.
8. Each player's `marksByRound` array is **padded to `totalRounds`** with zeros — the sheet
   renders a fixed seven-column grid (`src/components/game/ShanghaiScoreSheet.tsx:44`), and a
   mode-derived array is `[...finished, current]`, i.e. one entry too short.
9. `app/game/shanghai/page.tsx` — `maxPlayers={2}`, ids from the setup names, the round table
   from the **mode's state**, and the `hit` strip from the **current player's** record (today it
   hard-codes `PLAYER_ID` at `app/game/shanghai/page.tsx:186`).
10. `tests/unit/game-engine/UndoCorrectModes.test.ts:215` is **updated**, not deleted.
11. `npm run typecheck`, `npm run lint`, `npm run format:check` are clean.
12. `tests/unit/game-engine/frameworkAgnostic.test.ts` stays green.

## Verification command

```bash
npx vitest run tests/unit/game-engine/modes/ShanghaiMode.test.ts tests/unit/game-engine/UndoCorrectModes.test.ts tests/unit/game/modeViews.test.tsx && npm run typecheck && npm run lint && npm run format:check
```

## Result

<!-- Filled in when the package is executed. -->

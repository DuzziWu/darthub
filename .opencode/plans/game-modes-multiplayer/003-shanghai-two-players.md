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

**Executed:** 2026-11-16, commit `4d06db2` (branch `cez/0091ff2f`, base `4cba24f`) — **rebased** onto
the integration head as `76c5951` (see "Rebase" below).

AC 1–12 are met and the binding rulings (A5, B1, B3/C1, B6/C2, B7, C1, C2, C3, C4) are honoured —
confirmed by the independent review `f1598dce` (verdict "changes", one blocking MEDIUM finding,
M-1, disposed below).

### Rebase onto the integration head (2026-11-16)

The branch was rebased onto a head that carries the **ledger rule** (`2a045dd`), the **doc
catch-up** (`a1ac06a`) and **M2 — Around The Clock** (`c51e7a0`), which the package file
`002-around-the-clock-per-player.md` owns. The M3 commit itself is unchanged by the rebase: its
diff is byte-identical to `4d06db2`'s (only the blob hashes and the hunk offsets move).

One conflict, in `tests/unit/game/modeViews.test.tsx` — both packages **append** an `it(...)`
block at the end of the same `describe`, so git interleaved them. The resolution keeps **both**:
M2's _"shows an around the clock score sheet per player and announces a miss"_ and M3's _"shows a
shanghai row per player and the marks of every round"_. Nothing of M2 was reverted and nothing of
M2 was overwritten.

`src/components/game/types.ts` merged automatically: M2 changed
`AroundTheClockScoreSheetProps` and M3 changed `ShanghaiScoreSheetProps` — two adjacent but
disjoint interfaces. Both now carry the same convention M1 established (`players`, then
`currentPlayerId`), so the sheet of each mode is a sheet **per player**.

### Review disposition — M-1 (MEDIUM, blocking) from the review `f1598dce`

**The finding.** The S/D/T strip lost the Shanghai win state. `app/game/shanghai/page.tsx:207-214`
read the round record over `currentPlayerId`, and the engine nulls `currentPlayerId` the moment
the match ends (`src/game-engine/GameEngine.ts:265-269`) — while the Shanghai early return
(`src/game-engine/modes/ShanghaiMode.ts:102-106`) deliberately keeps `roundRecords` alive. After
the winning dart the strip therefore showed "S·D·T·Shanghai possible" ("missed" on every
segment), while the banner said "Shanghai" and the scoreboard row said "S D T · 6 marks".

**The fix** (2026-11-16, this branch). The record source of the strip is now `currentPlayerId ??
winnerId` — the source the badge already used (`app/game/shanghai/page.tsx:229`). Two files, one
record source:

- `app/game/shanghai/page.tsx:208-213` — `recordPlayerId = currentPlayerId ?? winnerId`, so the
  strip shows the winning player's segments after the match is over.
- `tests/unit/game/modeViews.test.tsx:354` — one appended `it(...)` block, _"shows the shanghai
  segments after the match is won"_: single 1 → double 1 → treble 1, then the strip must report
  `Single, hit` / `Double, hit` / `Triple, hit`, no `missed` segment, and the word "Shanghai".

The new test **fails on the pre-fix tree** (the strip rendered "Single, missed" … "Shanghai
possible") and passes after the fix — it pins the behaviour, not the implementation.

**Not fixed here, on purpose.** `shanghaiWinnerId`, the tie / tie-break and ruling A5 belong to
**M5**: M5 sets the flag in the early return and moves `isMatchComplete` onto it. The ledger rule
from `2a045dd` ("`correctThrow` darf die Turn-Rotation des Ledgers nicht ändern") is **not**
touched here — the fix changes one view and one test file, and neither of them is one of the four
files the ledger rule owns.

**Verification** (2026-11-16, on the **rebased** tree, with the fix applied):

```text
npx vitest run tests/unit/game-engine/modes tests/unit/game/modeViews.test.tsx
  → Test Files 7 passed (7) · Tests 67 passed (67) · exit 0

npx vitest run tests/unit/game-engine/UndoCorrectModes.test.ts \
                  tests/unit/game-engine/UndoCorrect.test.ts \
                  tests/unit/game/undoAcrossModes.test.tsx \
                  tests/unit/game-engine/frameworkAgnostic.test.ts \
                  tests/unit/docs/docs.test.ts
  → Test Files 5 passed (5) · Tests 52 passed (52) · exit 0

npm run typecheck    → exit 0
npm run lint         → exit 0
npm run format:check → "All matched files use Prettier code style!" · exit 0
```

The new test **fails on the pre-fix tree** — also after the rebase: the strip rendered "Single,
missed" … "Shanghai possible" — and passes with the fix.

**Conflict freedom.** `git merge-tree --write-tree b07665a HEAD` → exit 0 (main is an ancestor, so
the merge is a fast-forward) and `git merge-tree --write-tree 2a045dd HEAD` → exit 0 (the ledger
head is an ancestor of the rebased branch). The file set of this change (`app/game/shanghai/page.tsx`,
`tests/unit/game/modeViews.test.tsx`, this package file) and the file set of the ledger rule
(`src/game-engine/GameEngine.ts`, `src/game-engine/throwLedger.ts`,
`tests/unit/game-engine/UndoCorrect.test.ts`, `tests/unit/game/undoAcrossModes.test.tsx`) do not
overlap.

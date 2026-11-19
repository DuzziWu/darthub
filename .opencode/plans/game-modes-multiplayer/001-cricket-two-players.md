# 001 — M1: Cricket — two players, one score sheet per player

**Owning agent:** `frontend`
**Plan:** `docs/superpowers/plans/2026-11-12-game-modes.md` → Task M1
**Binding rulings:** B1, B2, B3/C1, B6/C2, C1, C2, C3, C4
**Pre-flight:** `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`

## Scope

Seat two players in the cricket match, and give each player their own score sheet.

**In scope**

- `CricketScoreSheet` renders **one sheet per player** from a `players` prop, instead of one
  sheet for a single hard-coded player.
- The cricket view derives the engine's player ids from the names the setup collected
  (`playerIdsFor(names)`) instead of hard-coding `PLAYER_ID = "player1"`.
- The view reads the marks of **the player who threw**, not of `PLAYER_ID`.
- The winner comes from the mode (`getCricketWinnerId(state)`), not from `state.players[0]`.
- `maxPlayers` becomes `2` on the cricket setup.

**Out of scope**

- The engine's cricket rules. `CricketMode.applyThrow` already writes
  `data.marks[throwRecord.playerId]` (`src/game-engine/modes/CricketMode.ts:85-92`) and
  `awardPointsIfScoring` already credits the thrower (`:105-119`). **No engine change.**
- The correction/undo flow.
- `src/realtime/`, `app/api/`.

## Files

**Owned by `frontend` (this package edits these):**

| File                                                               | What changes                                                                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/game/CricketScoreSheet.tsx`                        | Maps over `players`; one `<section aria-label={`${player.name} cricket targets`}>` per player. The existing target-grid markup is extracted into a local `PlayerTargets` component, not duplicated. |
| `src/components/game/types.ts` **§ `CricketScoreSheetProps` only** | `marks` and `playerName` are **removed** (not aliased); `players: ReadonlyArray<{ id: string; name: string; marks: Record<string, number> }>` and `currentPlayerId?: string \| null` are added.     |
| `app/game/cricket/page.tsx`                                        | `playerIdsFor(names)`, `maxPlayers={2}`, per-player marks, winner from the mode.                                                                                                                    |
| `tests/unit/game/modeViews.test.tsx`                               | One new `it(...)` block: "shows a cricket score sheet per player". **Appended** — the file's existing blocks are not touched.                                                                       |
| `tests/unit/game/cricketCorrection.test.tsx`                       | One new `it(...)` block: "shows two cricket sheets, one per player".                                                                                                                                |

**Coordinated — `game-engine` agent's area, executed by that agent, in parallel (no file conflict):**

| File                                                                   | What changes                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/game-engine/modes/CricketMultiplayer.test.ts` **(create)** | Two **pin** tests that pass against today's engine: each player has their own marks; a dart scores on a number the thrower closed and an opponent has open. The file lives under `tests/unit/game-engine/`, so the `game-engine` agent creates it and owns it. |

**No other file may be touched by this package.** In particular this package does **not** edit
`src/game-engine/**` — the engine is already correct here.

## File-conflict resolution

`src/components/game/types.ts` is wanted by M1, M2, M3, M4 and M5; `tests/unit/game/modeViews.test.tsx`
by M1, M2, M3 and M6. Both belong to `frontend`.

- **M1 edits `src/components/game/types.ts` FIRST** and establishes the convention every later
  package follows: `players: ReadonlyArray<{ id: string; name: string; … }>` plus a
  `currentPlayerId?: string | null` prop.
- M2, M3, M4 and M5 each append **their own named interface** to the same file, in the order
  **M1 → M2 → M3 → M4 → M5**. The interfaces are disjoint:
  `CricketScoreSheetProps` (M1) · `AroundTheClockScoreSheetProps` (M2) ·
  `ShanghaiScoreSheetProps` (M3) · `PlayerSetupOptions` / `PlayerSetupProps` /
  `MatchFormatChoice` (M4) · `GameResultBannerProps` (M5).
- `tests/unit/game/modeViews.test.tsx` is appended to in the order **M1 → M2 → M3 → M6**. Each
  package adds its own `it(...)` block and changes nothing else in the file.

**M1 has no dependency.** It is the first package and unblocks M2, M3 and M6.

## Acceptance Criteria

1. `src/components/game/types.ts` — `CricketScoreSheetProps` has **no** `marks` and **no**
   `playerName`; it has `targets`, `marksToClose`, `players`, `currentPlayerId`.
2. `src/components/game/CricketScoreSheet.tsx` renders one `<section>` per player, each with
   `aria-label={`${player.name} cricket targets`}`.
3. The player's name is rendered in **its own element** — the " · ON TURN" marker is a
   **sibling**, never concatenated into the same text node. _(ruling B1)_
4. Every target cell keeps the aria-label format
   `` `${label}, ${count} of ${marksToClose} marks${closed ? ", closed" : ""}` ``
   (`src/components/game/CricketScoreSheet.tsx:48`).
5. `app/game/cricket/page.tsx` — `PLAYER_ID` is gone; player ids come from the setup names; the
   marks are read for the player who threw; the winner comes from `getCricketWinnerId`.
6. `app/game/cricket/page.tsx` — `maxPlayers={2}`.
7. **The existing test at `tests/unit/game/modeViews.test.tsx:107` still passes.** With two
   players the label `20, 0 of 3 marks` matches **two** elements, so that assertion must become
   `getAllByLabelText` or be scoped to a player's `<section>` — **updated, never deleted and
   never weakened**. _(ruling B2, C2)_
8. No test uses `toBeInTheDocument()` — the repository has no `@testing-library/jest-dom`
   (`package.json:47-48`). Every assertion is `expect(...).toBeTruthy()`. _(rulings B3, C1)_
9. `npm run typecheck`, `npm run lint`, `npm run format:check` are clean.
10. `tests/unit/game-engine/frameworkAgnostic.test.ts` stays green — the engine is untouched.

## Verification command

```bash
npx vitest run tests/unit/game/modeViews.test.tsx tests/unit/game/cricketCorrection.test.tsx tests/unit/game-engine/modes/CricketMultiplayer.test.ts && npm run typecheck && npm run lint && npm run format:check
```

## Result

**M1 is merged.** The merge commit is `0f11ae4` — "merge: M1 – Cricket mit zwei Spielern und
eigenem Score-Sheet" (2026-11-16), on branch `integration/opencode-team`.

The merge touches exactly the files the task table names:

```text
 app/game/cricket/page.tsx                          | 106 +++++++++++----
 src/components/game/CricketScoreSheet.tsx          | 149 +++++++++++++--------
 src/components/game/types.ts                       |  20 ++-
 .../game-engine/modes/CricketMultiplayer.test.ts   |  70 ++++++++++
 tests/unit/game/cricketCorrection.test.tsx         |  21 +++
 tests/unit/game/modeViews.test.tsx                 |  30 +++++
 6 files changed, 307 insertions(+), 89 deletions(-)
```

The package's own gate, re-run on 2026-11-16 against the merged tree
(`4cba24f`, which carries the merge):

```text
$ npx vitest run tests/unit/game-engine/modes/CricketMultiplayer.test.ts \
    tests/unit/game/modeViews.test.tsx \
    tests/unit/game/cricketCorrection.test.tsx --reporter=dot

 Test Files  3 passed (3)
      Tests  20 passed (20)
   Duration  199.39s
```

The full suite on the same tree measured **108 test files / 553 tests, all green**
(1472.51 s). Earlier runs of the same tree failed on `tests/unit/dockerignore.test.ts`
alone — its live `docker build` hit the 900 s cap, or failed with `failed to export
image: No such image`, while another build shared the Docker daemon (contention, not a
regression; see the plan's risk #13). Run alone on an idle daemon the same file passes:
**3 tests passed, 546.42 s**, exit 0.

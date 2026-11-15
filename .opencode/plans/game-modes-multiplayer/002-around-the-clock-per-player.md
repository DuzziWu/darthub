# 002 — M2: Around The Clock — a target per player, and a visible miss

**Owning agent:** `game-engine`
**Plan:** `docs/superpowers/plans/2026-11-12-game-modes.md` → Task M2
**Binding rulings:** B1, B3/C1, B4, B5, B6/C2, B8, C1, C2, C3, C4
**Pre-flight:** `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`

## Scope

Give every player their own Around The Clock target, and make a miss visible.

**In scope**

- `AroundTheClockModeData.currentTargetIndex` becomes a **per-player map**.
- The mode's completion rule stays **"the first player to clear all 21 targets wins"**.
- The sheet renders one section per player, with the player's own progress readout.
- The view seats two players and announces a miss instead of silently swallowing the dart.

**Out of scope**

- The realtime path (`src/realtime/`) — untouched; the socket path runs `NeutralScoreMode`.
- The correction flow.
- Shanghai, cricket, x01.

## Files

**Owned by `game-engine` (this package edits these):**

| File                                                      | What changes                                                                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game-engine/modes/AroundTheClockMode.ts`             | `currentTargetIndex: number` → `currentTargetIndex: Record<string, number>`; `requireModeData` seeds a map; `isMatchComplete` completes on **one** player finishing. |
| `tests/unit/game-engine/modes/AroundTheClockMode.test.ts` | New per-player tests; the existing helper at `:18-19` is **updated** to read the map.                                                                                |
| `tests/unit/game-engine/modes/CorrectionReplay.test.ts`   | The assertions at `:113,119,124` are **updated** to the map shape.                                                                                                   |
| `tests/unit/game-engine/UndoCorrectModes.test.ts`         | The assertions at `:180,183,194,197` are **updated** to the map shape.                                                                                               |

**Coordinated — `frontend` agent's area, executed by that agent, sequenced AFTER the engine half:**

| File                                                                      | What changes                                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/components/game/AroundTheClockScoreSheet.tsx`                        | Maps over `players`; one `<section aria-label={`${player.name} around the clock`}>` per player.                             |
| `src/components/game/types.ts` **§ `AroundTheClockScoreSheetProps` only** | `players: ReadonlyArray<{ id; name; currentIndex; hits }>` + `currentPlayerId?: string \| null`, following M1's convention. |
| `app/game/around-the-clock/page.tsx`                                      | `playerIdsFor(names)`, `maxPlayers={2}`, per-player target, a visible miss message.                                         |
| `tests/unit/game/modeViews.test.tsx`                                      | One new `it(...)` block, **appended**.                                                                                      |

**No other file may be touched by this package.**

## File-conflict resolution

- `src/components/game/types.ts` — **appended to after M1** (M1 → M2). Only
  `AroundTheClockScoreSheetProps` changes here.
- `tests/unit/game/modeViews.test.tsx` — **appended to after M1** (M1 → M2). Only a new
  `it(...)` block is added.
- `tests/unit/game-engine/modes/AroundTheClockMode.test.ts`,
  `tests/unit/game-engine/modes/CorrectionReplay.test.ts` and
  `tests/unit/game-engine/UndoCorrectModes.test.ts` are touched by **no other package** in this
  plan. `UndoCorrectModes.test.ts` is currently an **untracked** file in this worktree
  (a parallel task's file) — read it before editing, and do not delete it.

## Binding rulings — what they forbid

- **B4 (load-bearing) — the completion rule.** The match ends when **ONE** player has cleared
  every target. The 2026-11-12 draft's "every player must finish" rule is **rejected**: it
  contradicts the mode's own class doc
  (`src/game-engine/modes/AroundTheClockMode.ts:20-22` — "The player who hits all 21 targets
  first wins the match") and the registry's published win condition
  (`src/game-engine/modes/registry.ts:168` — "Hit every target in order"), and it makes a
  two-player match **un-endable**. The implementation is:

  ```ts
  return state.players.some(
    (player) => (data.currentTargetIndex[player.id] ?? 0) >= AROUND_THE_CLOCK_TARGETS.length,
  );
  ```

- **B5 — scoped progress readout.** The "Progress N / 21" line
  (`src/components/game/AroundTheClockScoreSheet.tsx:26-28`) must live **inside** the player's
  own `<section>`, and the assertion must use `within(section)`. With two players an unscoped
  `getByText("Progress 0 / 21")` throws "found multiple".
- **B6 / C2 — existing tests are updated, never deleted or weakened.** The four files listed
  above are updated to the new shape; their assertions are made equivalent or stronger.
- **B3 / C1 — no `@testing-library/jest-dom`.** `expect(...).toBeTruthy()`, never
  `toBeInTheDocument()`. The repository has only `@testing-library/dom` and
  `@testing-library/react` (`package.json:47-48`).
- **B1 — the player's name is its own element**, so `getByText("Bob")` matches.
- **B8 — the sheet keeps the visible string "Target 1".** The 2026-11-12 reference
  `tests/unit/game/modeViews.test.tsx:290` **does not exist** in this tree (the file is 233
  lines). The literal is asserted by `e2e/game-center.spec.ts:162`; the unit assertions are
  `tests/unit/game/modeViews.test.tsx:131-132`. The rewrite must not break them.
- **C3 — one record of the darts.** The view reads the engine's state; it keeps no private
  copy of a dart.
- **C4 — no commit.** The package ends with a verification command, not a commit.

## Acceptance Criteria

1. `AroundTheClockModeData` is
   `{ playerProgress: Record<string, number>; currentTargetIndex: Record<string, number> }`.
   The old single-number field is **removed**, not kept as a fallback.
2. `initializeMatch` seeds `currentTargetIndex` with `0` for **every** player.
3. `isMatchComplete` uses `players.some(...)` — **not** `players.every(...)`. _(B4)_
4. A dart on the wrong target consumes the dart but does **not** advance the player's target.
5. `requireModeData` accepts an existing **map** and seeds an empty map otherwise; a snapshot
   persisted by the old code carries a number, and `typeof null === "object"`, so the guard must
   check the map for truthiness before the type test.
6. `src/components/game/AroundTheClockScoreSheet.tsx` renders one `<section>` per player, each
   with `aria-label={`${player.name} around the clock`}`.
7. The progress readout is inside the player's `<section>` and the test scopes it with
   `within(section)`. _(B5)_
8. The player's name is in its own element. _(B1)_
9. The visible string **"Target 1"** still renders. _(B8)_
10. The view announces a miss: it compares the player's target index before and after the
    throw and says so when the index did not move.
11. `app/game/around-the-clock/page.tsx` — `maxPlayers={2}`, ids from the setup names.
12. The four existing test files are **updated**, not deleted, and their assertions are
    equivalent or stronger. _(B6/C2)_
13. `npm run typecheck`, `npm run lint`, `npm run format:check` are clean.
14. `tests/unit/game-engine/frameworkAgnostic.test.ts` stays green.

## Verification command

```bash
npx vitest run tests/unit/game-engine/modes/AroundTheClockMode.test.ts tests/unit/game-engine/modes/CorrectionReplay.test.ts tests/unit/game-engine/UndoCorrectModes.test.ts tests/unit/game/modeViews.test.tsx && npm run typecheck && npm run lint && npm run format:check
```

## Result

<!-- Filled in when the package is executed. -->

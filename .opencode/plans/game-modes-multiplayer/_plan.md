# Plan — Game Modes: Multiplayer, Match Format, and Live Play

**Feature slug:** `game-modes-multiplayer`
**Source plan:** `docs/superpowers/plans/2026-11-12-game-modes.md` (re-anchored onto this tree)
**Binding pre-flight:** `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`
**Created:** 2026-11-15
**Branch:** `cez/e988a487` · base `origin/main` `b07665a` · head `d73c37f`

---

## Objective

Turn the five shipped game modes from single-player showcases into real multiplayer matches:
two-player Cricket, Around The Clock and Shanghai; best-of-N legs and sets in x01; a tie that is
reported as a tie; and a result screen that can be undone from in every mode.

The work is the re-anchored port of the `feature/game-modes` plan. The behaviour to build is
described in `docs/superpowers/plans/2026-11-12-game-modes.md`; this plan organises it into seven
work packages with one owning agent each, disjoint file lists and sequenced dependencies.

---

## Discovery notes

What was found while re-anchoring the 2026-11-12 plan onto this tree. Every claim carries a
`file:line` proof in this tree; the full list is in the plan's "Re-anchoring log" section and
in the pre-flight file.

### The verified state of this tree (2026-11-15, commit `d73c37f`)

| Gate                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                            | clean, exit 0                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run lint`                                 | clean, exit 0                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run format:check`                         | clean, exit 0                                                                                                                                                                                                                                                                                                                                                                                             |
| `npx vitest run`                               | **106 test files / 540 tests, all passed**, exit 0 (785 s wall clock). The count includes the currently **untracked** `tests/unit/game-engine/UndoCorrectModes.test.ts` (a parallel task's file).                                                                                                                                                                                                         |
| **The Docker test is environment-conditional** | `tests/unit/dockerignore.test.ts:187-189` builds the real image (`docker build`, `:231`) under a hard **600 s** timeout. On this 2-CPU host it passes with only seconds of headroom (**590 s** measured) and **times out** if another `docker build` runs against the same daemon in parallel — so a red `dockerignore` is **contention, not a regression**: re-run that file alone before investigating. |
| `npx vitest run tests/unit/game-engine/modes`  | **5 test files / 32 tests, all passed**, exit 0 — the engine-side gate.                                                                                                                                                                                                                                                                                                                                   |
| `npm run build`                                | **nicht lokal verifiziert** — not run; no build claim is made anywhere in this plan.                                                                                                                                                                                                                                                                                                                      |

### Stale references that had to be corrected

| Kind                   | Example                                                                                                            | Resolution                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Line moved**         | `src/components/game/types.ts:146-155` claimed `CricketScoreSheetProps`; that range holds `GameResultBannerProps`. | `CricketScoreSheetProps` is at `:263-272`; `AroundTheClockScoreSheetProps` at `:274-279`; `ShanghaiScoreSheetProps` at `:281-292`; `ScoreDisplayProps` at `:128-143`; `GameResultBannerProps` at `:145-160`. 22 references moved. |
| **Reference obsolete** | `tests/unit/game/modeViews.test.tsx:290` (the "Target 1" assertion).                                               | The file is **233 lines**; line 290 does not exist and "Target 1" is asserted **nowhere** in `tests/`. The literal lives in `e2e/game-center.spec.ts:162`; the unit assertions are `tests/unit/game/modeViews.test.tsx:131-132`.  |
| **Reference obsolete** | `tests/unit/game/x01MatchView.test.tsx:246-270` (the undo pattern).                                                | The file is **188 lines** and contains no "Undo last dart" assertion. The pattern is `tests/unit/game/undoAcrossModes.test.tsx:63-80`.                                                                                            |
| **Reference obsolete** | `docs/ROADMAP.md` line 115.                                                                                        | The file is **64 lines**. The milestone list is at `:45-48`, the delivery table at `:32-41`.                                                                                                                                      |
| **Reference obsolete** | `src/game-engine/README.md:190-203` (the `MatchState` block).                                                      | The block is at `:195-207`.                                                                                                                                                                                                       |

### The B10 deviation — the result seam is narrower than the first ruling claimed

The 2026-11-12 ruling said the plan's proposed `MatchState.result` field "would be a duplicate
of an existing mechanism". That is **too strong**, and the plan now says so precisely:

- `src/game-engine/types.ts:213` — `resultSignature?(state: MatchState): string;`, an
  **optional**, **string-valued** hook on `DartGameMode`.
- The **only** implementation is `src/game-engine/modes/StandardMode.ts:129`.
- The engine's consumer is `src/game-engine/GameEngine.ts:358-364` (`private resultKey`), which
  falls back to `"complete" | "open"`.
- `resultKey` has exactly **one** caller: `shouldAudit` at
  `src/game-engine/GameEngine.ts:344-351` (line `350`) — it decides whether a correction of a
  dart in the live turn enters the audit trail. It is **private** and is not part of the public
  engine surface. `src/game-engine/index.ts:11-34` exports **no** `MatchResult` or equivalent.

So the seam answers _"did the result change?"_ — a string comparison for the audit trail. It
does **not** answer _"who won, is it a tie, by what margin?"_, which is what M5's result screen
needs. **M5 therefore extends the seam** (a structured, JSON-safe `MatchResult` on the mode,
converted by the engine alongside `resultSignature`) instead of adding an unrelated state field.
`MatchResult` must be JSON-safe (C5) and must be exported from `src/game-engine/index.ts` if it
becomes public. The `MatchState` code block in `src/game-engine/README.md:195-207` is **M5's**
to update — the 2026-11-12 scope gap where M7 was expected to cover it.

### Ruling status on this tree

All **28** rulings (A1–A11, B1–B10, C1–C7) were re-verified on 2026-11-15. **26 are unchanged
in substance**; three changed their _status_, and one changed its _proof_:

- **A8 / M6 is no longer test-only.** The 2026-11-12 tree had all four views passing `onUndo`.
  This tree has **one**: the cricket view (`app/game/cricket/page.tsx:239`). The around-the-clock,
  shanghai and x01 views render the banner without it. M6 now **wires** the three missing views
  and then pins them.
- **B8 — the protected assertion moved.** `modeViews.test.tsx:290` does not exist; the literal
  "Target 1" is asserted in `e2e/game-center.spec.ts:162`.
- **B4 — the completion rule is confirmed rejected.** `src/game-engine/modes/AroundTheClockMode.ts:62-65`
  still compares a **shared** `currentTargetIndex` against the target list, and the mode's own
  class doc (`:20-22`) and the registry (`:168`) both say _first to clear all 21 targets wins_.
  The plan's "every player must finish" rule stays rejected.
- **B9 — confirmed.** `StandardMode.initializeMatch` (`src/game-engine/modes/StandardMode.ts:89-93`)
  sets only `totalPoints`; `LEG_SET_MODE_DATA_KEY` is written only at `:149`, after the first leg
  ends. The seeded slice alone is **not** enough — the view also needs the sizes
  (`src/components/x01/X01MatchView.tsx:69-80` returns `{}` on purpose today).
- **B7 — confirmed.** The Shanghai early return is at
  `src/game-engine/modes/ShanghaiMode.ts:86-89` and is pinned by
  `tests/unit/game-engine/modes/ShanghaiMode.test.ts:86-97`.
- **B3 — confirmed.** `package.json:47-48` lists only `@testing-library/dom` and
  `@testing-library/react`; `grep -rn "toBeInTheDocument" tests/` returns **no hits**.

### Other findings that changed the work

- `docs/ROADMAP.md` is **owned by a parallel task** (opencode-team-integration) and is being
  edited right now in another worktree. M7's roadmap step is **blocked**; M7's doc scope is
  limited to `design-system/darthub/pages/match.md` and `.devflow/memory/CURRENT_STATE.md`.
- `docs/DECISIONS.md` is **not** touched by any package — checked explicitly.
- `tests/unit/game-engine/UndoCorrectModes.test.ts` is currently an **untracked** file in this
  worktree (a parallel task's). M2 and M3 must update it (rulings B6/C2) — read it before
  editing, never delete it.
- The App Router surface is **10** `page.tsx` + **14** `route.ts` + **1** `app/layout.tsx` — 25
  route files. The 2026-11-12 claim of "23 routes" is not reproducible from the file system.

---

## Scope

### In

- Two-player Cricket, Around The Clock and Shanghai (the engine's per-player data shapes, the
  per-player sheets, the two-player views).
- Best-of-N legs and sets in x01: the setup choice, the engine's seeding, the score sheet's
  readout.
- A tie reported as a tie, with the tie-break rule on screen.
- "Undo last dart" on every mode's result screen.
- The documentation that describes all of the above.

### Out

- **`src/realtime/`** — the socket path runs `NeutralScoreMode`; this plan does not reach it.
- **`app/api/`** — no REST change. The routes keep their current contracts.
- **`src/auth/`, `src/rating/`, `src/career/`, `src/friends/`, `src/privacy/`, `prisma/`** — no
  data model, no guest session, no rating change.
- **The correction flow** — the independent review of the throw-correction feature left three
  MEDIUM findings open
  (`.claude/plans/throw-correction-undo/008-independent-review.md`); this plan neither fixes nor
  depends on them and must not widen them.
- **New runtime dependencies** — none. No `@testing-library/jest-dom`, no `@testing-library/user-event`,
  no modal library, no CSS framework.
- **The test harness** — `vitest.config.ts`, `playwright.config.ts`, the `tests/` meta files and
  `e2e/` belong to the `qa-engineer`. **No package in this plan claims them.**

---

## Success criteria

1. The cricket, around-the-clock and shanghai setups seat **two** players, and each player has
   their **own** score sheet, read from the engine's own per-player state.
2. Around The Clock ends when **one** player clears all 21 targets, and the visible string
   "Target 1" still renders.
3. Shanghai records every player's marks per round; the sheet is a table of one row per player
   and one column per round; the "Shanghai!" win still ends the match immediately.
4. The setup offers a match format, the engine honours it, and the sheet shows `Leg 2/3`.
5. A level Shanghai match is reported as a **tie**, with the tie-break rule on screen — through
   the **existing** result seam, extended, not duplicated.
6. Every mode's result screen offers "Undo last dart", and the undo returns the match to play.
7. The documentation matches the code: `design-system/darthub/pages/match.md` and
   `.devflow/memory/CURRENT_STATE.md` are updated; `docs/ROADMAP.md` is updated **only** after
   the parallel task settles.
8. `npm run typecheck`, `npm run lint`, `npm run format:check` and `npx vitest run` are green
   after every package.
9. **No commit** is made without the user's explicit approval (ruling C4,
   `.claude/plans/darthub-design-implementation/_plan.md:139-140`).
10. **No existing test is deleted or weakened** — every test broken by a data-shape change is
    updated so that it still asserts the same behaviour (rulings B6, C2).

---

## Ownership rules for this plan

1. **One owning agent per package.** The owner is accountable for the package's outcome.
2. **Area discipline.** `game-engine` owns `src/game-engine/`, `src/board/`, `src/ai/`,
   `src/camera/` **and the tests under `tests/unit/game-engine/`**. `frontend` owns
   `src/components/` and `app/` **except `app/api/`**, plus the UI tests under `tests/unit/game/`.
   `backend` owns `app/api/`, `prisma/` and the server-side services. `architect` owns `docs/`
   and `.opencode/plans/`. The `qa-engineer` owns the **harness** files — `tests/` meta tests,
   `e2e/`, `vitest.config.ts`, `playwright.config.ts`, `docs/TESTING.md`. **No package in this
   plan claims a harness file.**
3. **A package that spans two areas is executed in two sequenced steps.** The owning agent
   performs its own block; the other agent performs the _coordinated_ block, named in the
   package's `Files` table. The package's `Abhängigkeit` column says which half comes first.
4. **`app/api/` belongs to the `backend` agent.** None of M1–M7 touches it.
5. **`tests/unit/game-engine/` belongs to the `game-engine` agent.** M4's engine test file
   (`tests/unit/game-engine/modes/StandardMode.test.ts`) is therefore executed by the
   `game-engine` agent as M4's coordinated block, and the `frontend` agent does not edit it.
6. **`design-system/` and `.devflow/` are assigned to the `architect`** for M7. The team
   ownership table does not cover them; they are documentation trees and the work is prose-only.
7. **Same-file conflicts are resolved by sequence, never by parallelism.** The single order
   **M1 → M2 → M3 → M4 → M5 → M6 → M7** resolves every overlap below.

### Same-file conflicts and their resolution

| File                                                                 | Wanted by          | Owner of the file | Resolution                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/game/types.ts`                                       | M1, M2, M3, M4, M5 | `frontend`        | **M1 edits first** and establishes the `players: ReadonlyArray<{ id, name, … }>` convention. M2 → M3 → M4 → M5 then each append **their own named interface**: `CricketScoreSheetProps` · `AroundTheClockScoreSheetProps` · `ShanghaiScoreSheetProps` · `PlayerSetupOptions`/`PlayerSetupProps`/`MatchFormatChoice` · `GameResultBannerProps`. The interfaces are disjoint. |
| `tests/unit/game/modeViews.test.tsx`                                 | M1, M2, M3, M6     | `frontend`        | **M1 → M2 → M3 → M6**; each appends its own `it(...)` block and changes nothing else.                                                                                                                                                                                                                                                                                       |
| `src/game-engine/modes/ShanghaiMode.ts`                              | M3, M5             | `game-engine`     | **M3 → M5**. M3 owns the data shape and `applyThrow`; M5 owns the `result(state)` accessor and the dedicated `shanghaiWinnerId` flag.                                                                                                                                                                                                                                       |
| `tests/unit/game-engine/modes/ShanghaiMode.test.ts`                  | M3, M5             | `game-engine`     | **M3 → M5**, different `it(...)` blocks.                                                                                                                                                                                                                                                                                                                                    |
| `app/game/shanghai/page.tsx`                                         | M3, M5, M6         | `frontend`        | **M3 → M5 → M6**. M3: the two-player rewrite. M5: the result wiring. M6: the `onUndo` wiring.                                                                                                                                                                                                                                                                               |
| `src/components/game/GameResultBanner.tsx`                           | M5, M6             | `frontend`        | **No conflict.** M5 owns the tie headline; M6 does **not** touch the component — the `onUndo` prop and its button already exist.                                                                                                                                                                                                                                            |
| `tests/unit/game/gameResultBanner.test.tsx`                          | M5, M6             | `frontend`        | **M5 → M6**; each appends its own `it(...)` block.                                                                                                                                                                                                                                                                                                                          |
| `src/components/x01/X01MatchView.tsx`                                | M4, M6             | `frontend`        | **M4 → M6**. M4: `MATCH_FORMATS`, the `legs`/`sets` state, `playAgain`. M6: the `onUndo` prop.                                                                                                                                                                                                                                                                              |
| `tests/unit/game-engine/modes/StandardMode.test.ts`                  | M4                 | **`game-engine`** | Executed by the `game-engine` agent as M4's coordinated engine block.                                                                                                                                                                                                                                                                                                       |
| `src/game-engine/modes/StandardMode.ts`                              | M4                 | **`game-engine`** | Same — only `initializeMatch` changes.                                                                                                                                                                                                                                                                                                                                      |
| `src/game-engine/modes/AroundTheClockMode.ts` + its three test files | M2                 | `game-engine`     | M2 only.                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/unit/game-engine/modes/CricketMultiplayer.test.ts`            | M1                 | `game-engine`     | Created by the `game-engine` agent (its test directory); M1 owns the assertions' intent.                                                                                                                                                                                                                                                                                    |
| `docs/ROADMAP.md`                                                    | M7                 | **parallel task** | **M7 is blocked** on it.                                                                                                                                                                                                                                                                                                                                                    |
| `docs/DECISIONS.md`                                                  | —                  | —                 | **Not touched by any package.**                                                                                                                                                                                                                                                                                                                                             |

---

## Task table

| Task   | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                         | Verantwortlich | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Abhängigkeit                                                                                                                                                                                                                                    | Status  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **M1** | **Cricket — two players, one score sheet per player.** `CricketScoreSheet` maps over a `players` prop (one `<section>` per player, the name in its own element); the view derives the ids from the setup names, reads the marks of the player who threw and takes the winner from `getCricketWinnerId`; `maxPlayers={2}`.                                                                                                            | `frontend`     | **owned:** `src/components/game/CricketScoreSheet.tsx`; `src/components/game/types.ts` **§`CricketScoreSheetProps`**; `app/game/cricket/page.tsx`; `tests/unit/game/modeViews.test.tsx`; `tests/unit/game/cricketCorrection.test.tsx` — **coordinated (`game-engine`, parallel):** `tests/unit/game-engine/modes/CricketMultiplayer.test.ts` **(create)**                                                                                                                                                          | none — first package; unblocks M2, M3, M6. `types.ts` + `modeViews.test.tsx` are edited **here first**.                                                                                                                                         | pending |
| **M2** | **Around The Clock — a target per player, and a visible miss.** `currentTargetIndex` becomes a per-player map; the match completes when **one** player clears all 21 targets (**B4**); the sheet renders a per-player section with a **scoped** progress readout (**B5**) and keeps the visible string "Target 1" (**B8**); the view seats two players and announces a miss.                                                         | `game-engine`  | **owned:** `src/game-engine/modes/AroundTheClockMode.ts`; `tests/unit/game-engine/modes/AroundTheClockMode.test.ts`; `tests/unit/game-engine/modes/CorrectionReplay.test.ts`; `tests/unit/game-engine/UndoCorrectModes.test.ts` — **coordinated (`frontend`, after the engine half):** `src/components/game/AroundTheClockScoreSheet.tsx`; `src/components/game/types.ts` **§`AroundTheClockScoreSheetProps`**; `app/game/around-the-clock/page.tsx`; `tests/unit/game/modeViews.test.tsx`                         | **after M1** (`types.ts` convention, `modeViews.test.tsx` order). Engine half → frontend half. Existing engine tests are **updated**, never deleted (**B6/C2**).                                                                                | pending |
| **M3** | **Shanghai — the round advances on turns, and two players score separately.** `ShanghaiModeData` gains `dartsThisRound` + `finishedRounds` and drops `totalDartsThisRound`; the **Shanghai early return is kept** (**B7**); the sheet becomes a table of one row per player and one column per round, padded to seven; the view reads the table from the mode's state.                                                               | `game-engine`  | **owned:** `src/game-engine/modes/ShanghaiMode.ts`; `tests/unit/game-engine/modes/ShanghaiMode.test.ts` — **coordinated (`frontend`, after the engine half):** `src/components/game/ShanghaiScoreSheet.tsx`; `src/components/game/types.ts` **§`ShanghaiScoreSheetProps`**; `app/game/shanghai/page.tsx`; `tests/unit/game/modeViews.test.tsx`                                                                                                                                                                     | **after M1 and M2** (`types.ts`, `modeViews.test.tsx`). Engine half → frontend half. **M5 must run after M3** (`ShanghaiMode.ts`, `shanghai/page.tsx`).                                                                                         | pending |
| **M4** | **Best-of-N legs and sets, reachable from the setup.** `PlayerSetup` offers a format radio group and reports it; `PlayerSetupOptions` gains `legs`/`sets`; `X01MatchView` passes the sizes to the engine and keeps them across "Play again"; the sheet header shows `Leg 2/3`. **B9:** the engine **seeds** the `legSet` slice and the sizes reach the view.                                                                         | `frontend`     | **owned:** `src/components/game/PlayerSetup.tsx`; `src/components/game/types.ts` **§`PlayerSetupOptions`/`PlayerSetupProps`/`MatchFormatChoice`**; `src/components/x01/X01MatchView.tsx`; `src/components/game/ScoreDisplay.tsx` (verify only); `tests/unit/game/playerSetup.test.tsx`; `tests/unit/game/x01MatchView.test.tsx` — **coordinated (`game-engine`, before the frontend half):** `src/game-engine/modes/StandardMode.ts` (`initializeMatch` only); `tests/unit/game-engine/modes/StandardMode.test.ts` | **after M1, M2, M3** (`types.ts`). **Engine half → frontend half.** The engine test file is **owned by `game-engine`** (it lives under `tests/unit/game-engine/`) — `frontend` does not edit it. **M6 must run after M4** (`X01MatchView.tsx`). | pending |
| **M5** | **A tie is a tie, and the tie-break rule is on screen.** The mode owns a structured, JSON-safe `MatchResult`; the engine derives and exposes it **alongside** the existing `resultSignature` seam — **no duplicate `MatchState.result` field** (**B10**); the Shanghai check reads a dedicated flag, never `roundRecords` (**A5**); the banner names the tie and states the rule; the engine README's `MatchState` block is updated. | `game-engine`  | **owned:** `src/game-engine/types.ts`; `src/game-engine/GameEngine.ts`; `src/game-engine/modes/ShanghaiMode.ts`; `src/game-engine/index.ts`; `src/game-engine/README.md`; `tests/unit/game-engine/modes/ShanghaiMode.test.ts` — **coordinated (`frontend`, after the engine half):** `src/components/game/GameResultBanner.tsx`; `src/components/game/types.ts` **§`GameResultBannerProps`**; `app/game/shanghai/page.tsx`; `tests/unit/game/gameResultBanner.test.tsx`                                            | **after M3** (`ShanghaiMode.ts`, `shanghai/page.tsx`) and **after M4** (`types.ts`, and M4's `leg`/`set` props must survive — **A7**). Engine half → frontend half. **M6 must run after M5** (`gameResultBanner.test.tsx`).                     | pending |
| **M6** | **The result screen can be undone from in every mode.** `onUndo` is **wired** into the around-the-clock, shanghai and x01 result banners — only the cricket view has it today — and all four modes are pinned with tests. The banner component is **not** changed.                                                                                                                                                                   | `frontend`     | **owned:** `app/game/around-the-clock/page.tsx`; `app/game/shanghai/page.tsx`; `src/components/x01/X01MatchView.tsx`; `tests/unit/game/modeViews.test.tsx`; `tests/unit/game/gameResultBanner.test.tsx` — **coordinated:** none                                                                                                                                                                                                                                                                                    | **after M1, M2, M3** (`modeViews.test.tsx`), **after M4** (`X01MatchView.tsx`), **after M5** (`shanghai/page.tsx`, `gameResultBanner.test.tsx`). **Last of the code packages.**                                                                 | pending |
| **M7** | **The design spec and the docs catch up with the shipped modes.** `design-system/darthub/pages/match.md` gets the shipped undo, the ledger-backed bust and the single-source visit strip; `.devflow/memory/CURRENT_STATE.md` gets the new functionality and the measured test count.                                                                                                                                                 | `architect`    | **owned:** `design-system/darthub/pages/match.md`; `.devflow/memory/CURRENT_STATE.md` — **blocked:** `docs/ROADMAP.md` (parallel task) — **not touched:** `docs/DECISIONS.md`; `src/game-engine/README.md` (**M5's**, per **B10**)                                                                                                                                                                                                                                                                                 | **after M1–M6.** **`docs/ROADMAP.md` is blocked** until the opencode-team-integration task settles — M7's doc scope is limited to `match.md` and `CURRENT_STATE.md` until then.                                                                 | pending |

---

## API contract

### No REST change

`app/api/**` is untouched by every package. The route handlers, their payloads and their
authorisation are exactly as they are today. The `backend` agent owns `app/api/`; nothing here
reaches it.

### Engine contracts that change

```ts
// src/game-engine/modes/AroundTheClockMode.ts — per-player target index.
export type AroundTheClockModeData = {
  playerProgress: Record<string, number>;
  currentTargetIndex: Record<string, number>; // was: number
};

// src/game-engine/modes/ShanghaiMode.ts — per-player round history.
export type ShanghaiModeData = {
  currentRound: number;
  dartsThisRound: Record<string, number>;      // new — replaces totalDartsThisRound
  roundRecords: Record<string, ShanghaiRoundRecord>;
  finishedRounds: Record<string, number[]>;    // new
  shanghaiWinnerId?: string;                   // new — the dedicated flag ruling A5 requires
};

// src/game-engine/types.ts — the structured result, next to the EXISTING signature seam.
export interface MatchResult {
  readonly winnerId?: string;
  readonly tied: boolean;
  readonly tieBreak?: string;
}

export interface DartGameMode {
  // …the existing members…
  resultSignature?(state: MatchState): string;  // existing — :213, string-valued, audit-only
  result?(state: MatchState): MatchResult;      // new — structured, JSON-safe
}

// src/game-engine/GameEngine.ts — the derived result, exposed publicly.
getResult(): MatchResult | undefined;
```

**No `MatchState` field is added for the result.** The engine holds **one** notion of "how the
match ended": `resultKey` and the structured result come from the same mode-owned source.

### Component contracts that change

```ts
// The convention M1 establishes and M2/M3 follow.
players: ReadonlyArray<{ id: string; name: string; … }>;
currentPlayerId?: string | null;

// M4
export interface MatchFormatChoice {
  readonly id: string;
  readonly label: string;
  readonly legs?: number;
  readonly sets?: number;
}
// PlayerSetupOptions gains legs?: number; sets?: number.
// PlayerSetupProps gains readonly matchFormat?: readonly MatchFormatChoice[];

// M5
// GameResultBannerProps gains readonly tied?: boolean; readonly tieBreak?: string;
// and KEEPS M4's leg / set props (ruling A7).

// M6 — unchanged: GameResultBannerProps.onUndo already exists.
```

### Invariants that hold throughout

- The engine stays **framework-agnostic** — `tests/unit/game-engine/frameworkAgnostic.test.ts`
  scans every `.ts` under `src/game-engine` for react / next / socket.io / Node built-ins /
  browser-only globals and requires the snapshot to survive a JSON round-trip.
- The engine keeps **exactly one record of the darts** (`MatchState.throws`). No view keeps a
  private copy or a private counter.
- Exactly **one `primary`** per surface; the token vocabulary is
  `src/components/game/classes.ts`.
- **No new runtime dependencies.**

---

## Risiken

| #   | Risk                                                                                                                                                                                                                                                                                                    | Likelihood                                                                                                  | Impact                                                                             | Mitigation                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The ATC completion rule is changed wrongly.** "Every player must finish" would make a two-player match **un-endable**.                                                                                                                                                                                | low (ruling B4 is explicit and the mode's own doc agrees)                                                   | **critical**                                                                       | `isMatchComplete` uses `players.some(...)`; a test pins that one player finishing completes the match while the other has hit nothing.                                                   |
| 2   | **The Shanghai early return is dropped** while reshaping `applyThrow`.                                                                                                                                                                                                                                  | medium — it is the block right next to the code being rewritten                                             | **critical** — the "Shanghai!" win dies silently                                   | Ruling B7; the existing test `tests/unit/game-engine/modes/ShanghaiMode.test.ts:86-97` pins it and is **not** modified by M3.                                                            |
| 3   | **The engine ends up with two notions of "how the match ended"** — the new `MatchResult` and the old `resultSignature` drifting apart.                                                                                                                                                                  | medium                                                                                                      | high — a correction audit that lies                                                | Ruling B10; the structured result and `resultKey` must come from the **same** mode-owned source; `shouldAudit` keeps working.                                                            |
| 4   | **Five packages edit `src/components/game/types.ts`**, and a later one silently reverts an earlier one's interface.                                                                                                                                                                                     | medium                                                                                                      | medium                                                                             | The order M1 → M2 → M3 → M4 → M5 is fixed; each package edits **only its own named interface**; `npm run typecheck` runs after every package.                                            |
| 5   | **Four packages append to `tests/unit/game/modeViews.test.tsx`** and one rewrites another's block.                                                                                                                                                                                                      | medium                                                                                                      | medium                                                                             | Append-only; each package adds its own `it(...)`; the file is read before it is edited.                                                                                                  |
| 6   | **The existing test at `tests/unit/game/modeViews.test.tsx:107` breaks** with two players (the label matches twice).                                                                                                                                                                                    | **certain**                                                                                                 | medium                                                                             | Ruling B2: the assertion becomes `getAllByLabelText` or is scoped to a player's `<section>` — **updated, never deleted** (B6/C2).                                                        |
| 7   | **`tests/unit/game-engine/UndoCorrectModes.test.ts` is an untracked file** from a parallel task; M2 and M3 must update it and it may change under them.                                                                                                                                                 | medium                                                                                                      | medium                                                                             | Read it before editing; never delete it; if it changes, re-read and re-run the whole package's gate.                                                                                     |
| 8   | **`docs/ROADMAP.md` is edited by a parallel task** while M7 wants it.                                                                                                                                                                                                                                   | **certain**                                                                                                 | medium                                                                             | M7's roadmap step is **blocked** and its scope is limited to `match.md` and `CURRENT_STATE.md`; the coordinator sequences the roadmap edit after the parallel task.                      |
| 9   | **The leg/set readout cannot be built honestly** because the sizes are not in the state (`src/components/x01/X01MatchView.tsx:69-80` returns `{}` on purpose).                                                                                                                                          | medium                                                                                                      | medium                                                                             | Ruling B9 covers both halves: seed the slice **and** carry the sizes to the view.                                                                                                        |
| 10  | **The result screen's tie state breaks the "No winner" wording** and an existing banner test goes red.                                                                                                                                                                                                  | medium                                                                                                      | low                                                                                | `tests/unit/game/gameResultBanner.test.tsx` is **updated**, not weakened (B6/C2); the headline change is explicit in M5's acceptance criteria.                                           |
| 11  | **`npm run build` is claimed without being run.**                                                                                                                                                                                                                                                       | medium                                                                                                      | medium                                                                             | The re-anchoring marked the build **nicht lokal verifiziert**; M7's verification command does **not** include the build, and no package claims a build it did not run.                   |
| 12  | **A commit is made without the user's approval.**                                                                                                                                                                                                                                                       | low                                                                                                         | high — unrequested history                                                         | Ruling C4; every package ends with a verification command and an empty `## Result` section, never a commit.                                                                              |
| 13  | **The Docker test times out and is mistaken for a regression.** `tests/unit/dockerignore.test.ts:187-189` builds the real image under a hard **600 s** timeout; on this 2-CPU host it passes with seconds of headroom (**590 s** measured) and times out when another `docker build` shares the daemon. | medium — the orchestrator's second full-suite run hit exactly this (540 tests, 1 failure, timeout at 600 s) | medium — a false regression could send an implementer chasing a non-existent break | A red `dockerignore` is **contention, not a regression**: re-run `npx vitest run tests/unit/dockerignore.test.ts` **alone** before investigating. The file touches no file in this plan. |

---

## Progress log

| Date       | Event                            | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-15 | Plan created                     | The `feature/game-modes` plan (2026-11-12, commit `4014b44`) was ported onto this tree (commit `d73c37f`, base `origin/main` `b07665a`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-11-15 | Plan re-anchored                 | The original carried **34** explicit `path:line` references and **119** file references across **36** unique files. **23** moved, **3** were obsolete (their target does not exist in this tree), the rest were confirmed correct. The full list is in the plan's "Re-anchoring log".                                                                                                                                                                                                                                                                                                                         |
| 2026-11-15 | Pre-flight re-verified           | All 28 rulings (A1–A11, B1–B10, C1–C7) re-checked against this tree; each carries a `file:line` proof. See `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-15 | Work packages split              | M1–M7 turned into `001-…` … `007-…`, one owning agent each, file lists made disjoint and every same-file conflict sequenced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-15 | Suite re-verified (2nd full run) | A second independent full-suite run in this worktree measured the same **106 test files / 540 tests**, with **1 failure**: `tests/unit/dockerignore.test.ts` timed out at its hard 600 s cap while another `docker build` from the parallel task shared the same Docker daemon on this 2-CPU host. Run **alone** once the competing build had finished, the same file passed — **3 tests passed, 590.77 s**, exit 0. The failure is therefore **contention, not a regression**; the caveat is recorded in the plan's verified-state bullet, in the pre-flight file's provisional-ruling note and as risk #13. |
| —          | **Next step**                    | Execute package **001** (M1, `frontend`). The gate is already green: `npx vitest run tests/unit/game-engine/modes` (5 files / 32 tests) and `npm run typecheck`. Nothing is implemented yet — every status is `pending`.                                                                                                                                                                                                                                                                                                                                                                                      |

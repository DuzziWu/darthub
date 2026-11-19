# Game Modes — Multiplayer, Match Format, and Live Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the five shipped game modes from single-player showcases into real multiplayer matches — two-player Cricket and Around The Clock, best-of-N legs and sets in x01, tie-breaking, and the missing replay/finish affordances — so a match can be started, played and completed by two people in a browser.

**Architecture:** The engine already owns a single throw ledger and re-derives all state by replaying it (`src/game-engine/GameEngine.ts` — `undoLastThrow` `:131`, `correctThrow` `:156`, `getVisits` `:213`, private `replay` `:280-309`). This plan does **not** replace that. It extends the mode contract (`DartGameMode`) where two of the three non-x01 modes are wrong for more than one player, extends the match configuration with legs/sets (already implemented in `LegSetManager` but never reachable from the UI), and rewrites the four match views to be player-count-agnostic instead of hardcoding `PLAYER_ID = "player1"`.

**Tech Stack:** TypeScript strict, React 19 (Next.js App Router), Vitest, Playwright, Tailwind v4 token layer (`app/globals.css`), existing design-system tokens in `src/components/game/classes.ts`.

**Spec:**

- `docs/PRD.md:55-65` (engine scope), `docs/PRD.md:92-100` (multiplayer scope)
- `docs/ROADMAP.md` — the multiplayer gaps this plan closes. **Note:** today's `docs/ROADMAP.md`
  is 64 lines and has **no** "Open gaps" section; the milestone list is at `:45-48` and the
  delivery-status table at `:32-41`.
- `design-system/darthub/pages/match.md` — the match page contract (throw strip, score sheet, throw pipeline)
- `design-system/darthub/MASTER.md:661-672` — the one-primary-per-surface rule (the rule itself
  at `:672`)
- Verified state of the repository on **2026-11-15** against commit **`d73c37f`** (base
  `origin/main` `b07665a`) in this worktree:
  - `npm run typecheck` → **clean** (exit 0).
  - `npm run lint` → **clean** (exit 0).
  - `npm run format:check` → **clean** (exit 0).
  - `npx vitest run` → **106 test files / 540 tests, all passed** (exit 0; 785 s wall clock).
    _Note:_ the count includes the currently **untracked**
    `tests/unit/game-engine/UndoCorrectModes.test.ts` (a parallel task's file).
  - **The Docker test is environment-conditional.** `tests/unit/dockerignore.test.ts:187-189`
    builds the real image (`docker build`, `:231`) under a hard **600 s** timeout. On this
    2-CPU host it passes with only seconds of headroom (**590 s** measured) and **times out**
    if any other `docker build` runs against the same daemon in parallel — so a red
    `dockerignore` result is **contention, not a regression**: re-run that file alone before
    investigating.
  - `npx vitest run tests/unit/game-engine/modes` → **5 test files / 32 tests, all passed**
    (exit 0) — the gate for the engine-side packages.
  - App Router surface: **10** `page.tsx` under `app/`, **14** `route.ts` under `app/api/`,
    **1** `app/layout.tsx` — 25 route files in total. The 2026-11-12 claim of "23 routes" is
    not reproducible from the file system; count the files rather than trusting the number.
  - `npm run build` → **nicht lokal verifiziert** (not run in this session; no build claim is
    made here).

> **Re-anchoring (2026-11-15).** This plan was written on 2026-11-12 against commit `4014b44`
> in the `feature/game-modes` worktree and has been **re-anchored** onto this tree. The original
> carried **34** explicit `path:line` references and **119** file references across **36** unique
> files; every one of them was re-read. **23** references moved, **3** were found to be
> **obsolete** (their target does not exist in this tree at all) and the rest were confirmed
> correct. The changes are listed in the "Re-anchoring log" section at the end of this file.
> The substantive changes are:
> the `MatchState.result` proposal of M5 is **replaced** by an extension of the existing
> `resultSignature` seam (see M5's deviation note), M6 is **no longer test-only** because three
> of the four views do not pass `onUndo` to the result banner in this tree, and M2's
> "every player must finish" completion rule is **rejected** in favour of the mode's own
> documented rule.
>
> **Pre-flight rulings.** The rulings that bind this plan live in
> **`docs/superpowers/plans/2026-11-12-game-modes-preflight.md`** — all 28 of them (A1–A11,
> B1–B10, C1–C7), each with a `file:line` proof from this tree. Where that file and this plan
> disagree, **the pre-flight file wins**. It is referenced again at M1, M2, M3, M4, M5, M6 and
> M7.

## Global Constraints

- **No new runtime dependencies.** `socket.io-client` is installed but unused; this plan does not add it to any client path.
- **No commits without the user's explicit approval.** Every task ends with a verification step, not a commit. (Repo rule: `.claude/plans/darthub-design-implementation/_plan.md:139-140`.)
- TypeScript strict. `npm run lint`, `npm run typecheck`, `npm run format:check` must be clean at the end of every task.
- The engine stays framework-agnostic — `tests/unit/game-engine/frameworkAgnostic.test.ts` must stay green.
- The engine keeps exactly one record of the darts (`MatchState.throws`). No view may keep a private copy of a dart.
- Reuse `src/components/game/classes.ts` tokens. Do not introduce a second `primary` on any surface (MASTER.md:672 — exactly one `primary` per surface).
- Never weaken or delete an existing test. A failing existing test is fixed at its root cause.
- No shadcn/ui, no modal library, no new CSS framework.
- Do not touch `src/realtime/` — the socket path is a separate plan. The realtime server still runs `NeutralScoreMode`.
- **Do not extend the correction flow, and do not rely on it.** The independent review of the throw-correction feature (`.claude/plans/throw-correction-undo/008-independent-review.md`, 2026-11-12) left three MEDIUM findings open: the engine's `correctThrow` can produce a ledger `recordThrow` could not (turn-rotation desync, unreachable from the shipped UI but reachable from the engine API), a finished-visit correction leaves no audit record, and the "finished visit — correct?" confirmation is unreachable in the product. This plan neither fixes nor depends on those gaps; it must not widen them, and a task that touches `useMatchHistory` or `correctThrow` must first land the review's fixes.

## Review Focus

The failure modes most likely to bite a player, each pinned to the task whose tests cover it:

1. **A second player's dart is attributed to the first player.** Cricket's score sheet takes one `marks` map and the view hardcodes `PLAYER_ID`; two players would read the same sheet. **Expected:** each player's marks are their own, and a dart is scored to the player whose turn it is. Pinned in Task M1.
2. **Around The Clock's target index is shared between players.** `AroundTheClockModeData.currentTargetIndex` is one number for the whole match, so a second player cannot be on a different target — and a player who throws the _wrong_ number has their dart silently swallowed, leaving the dart counter and the score sheet out of step. **Expected:** each player has their own target, and a miss on the current target is visibly a miss. Pinned in Task M2.
3. **Shanghai's score sheet and its mode disagree as soon as a second player sits down.** The round table is derived from the raw ledger index (`app/game/shanghai/page.tsx:59-68`, the `marksByRound` helper), which puts both players' darts in the same round, and the mode never records what a player scored in a round (`roundRecords[player].marks` is declared at `src/game-engine/modes/ShanghaiMode.ts:18-26` but never incremented). **Expected:** the table is the engine's own per-player round history, and a round's marks are recorded. Pinned in Task M3.
4. **A best-of-N match is impossible to choose.** `LegSetManager` exists and `StandardMode` reads `config.legs`, but no UI passes `legs`/`sets` into `MatchConfig`, and `MatchConfig.legs`/`sets` are never set — so a match that should span three legs is always a single leg. **Expected:** the setup offers the format, the engine honours it, and the score sheet shows legs and sets. Pinned in Task M4.
5. **A tied match has no winner.** Shanghai can end level on marks; `ShanghaiMode.isMatchComplete` returns true and the view names the player whose dart completed the match (`app/game/shanghai/page.tsx:124`, `setWinnerId(playerId)`) — so a 21–21 draw is reported as a win for whoever threw last. **Expected:** a tie is reported as a tie, and the tie-break rule is stated on screen. Pinned in Task M5.
6. **A mode's result screen cannot be undone from in three of the five modes.** `GameResultBanner` already offers "Undo last dart" **when** it is given an `onUndo` prop (`src/components/game/GameResultBanner.tsx:102-110`), but in this tree only the **cricket** view passes one (`app/game/cricket/page.tsx:239`). The around-the-clock, shanghai and x01 views render the banner without it (`app/game/around-the-clock/page.tsx:225-231`, `app/game/shanghai/page.tsx:272-278`, `src/components/x01/X01MatchView.tsx:235-241`), and **no** test asserts the undo from the result screen — the 2026-11-12 reference `tests/unit/game/x01MatchView.test.tsx:246-270` **does not exist** in this tree (that file is 188 lines and contains no "Undo last dart" assertion). **Expected:** every mode's result screen offers Undo and New game, and the undo returns the match to play. Pinned in Task M6.
7. **A second player cannot be added in three of the five modes.** `maxPlayers={1}` on Cricket, Around The Clock and Shanghai; the score sheets take a single player's state. **Expected:** the setup offers two players and both appear on the score sheet. Pinned in Task M1/M2/M3.

---

### Task M1: Cricket — two players, one score sheet per player

**Files:**

- Modify: `src/components/game/CricketScoreSheet.tsx`
- Modify: `src/components/game/types.ts:263-272` (`CricketScoreSheetProps`)
- Modify: `app/game/cricket/page.tsx`
- Test: `tests/unit/game/cricketCorrection.test.tsx`
- Test: `tests/unit/game/modeViews.test.tsx`
- Create: `tests/unit/game-engine/modes/CricketMultiplayer.test.ts`

**Interfaces:**

- Consumes: `CricketMode` (`src/game-engine/modes/CricketMode.ts`), `getCricketWinnerId(state): string | null`, `MARKS_TO_CLOSE`, `CRICKET_TARGETS`.
- Produces: `CricketScoreSheetProps` gains a `players: ReadonlyArray<{ id: string; name: string; marks: Record<string, number> }>` field. The existing `marks` and `playerName` fields are **removed**, not kept as aliases — a sheet that can show one player cannot be told to show two.

- [ ] **Step 1: Write the failing engine test — a cricket score belongs to the player who threw it**

Create `tests/unit/game-engine/modes/CricketMultiplayer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import { CricketMode } from "@/game-engine/modes/CricketMode";

describe("cricket with two players", () => {
  it("gives each player their own marks", () => {
    const engine = new GameEngine(new CricketMode());
    engine.startMatch({ playerIds: ["alice", "bob"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 20 });
    const state = engine.getState();
    const marks = (state.modeData as { marks: Record<string, Record<string, number>> }).marks;
    expect(marks["alice"]!["20"]).toBe(3);
    expect(marks["bob"]!["20"]).toBe(0);
  });

  it("scores a dart on a number the thrower closed and an opponent has open", () => {
    // Alice closes the 20. Bob plays elsewhere, so the 20 is still open for
    // him. Alice's next dart on the 20 scores, because the number is closed
    // for her and open for him.
    const engine = new GameEngine(new CricketMode());
    engine.startMatch({ playerIds: ["alice", "bob"] });
    for (let i = 0; i < 3; i += 1) engine.recordThrow({ playerId: "alice", points: 20 });
    for (let i = 0; i < 3; i += 1) engine.recordThrow({ playerId: "bob", points: 19 });
    engine.recordThrow({ playerId: "alice", points: 20 });
    const state = engine.getState();
    expect(state.players.find((p) => p.id === "alice")!.totalPoints).toBe(20);
    expect(state.players.find((p) => p.id === "bob")!.totalPoints).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes or fails**

Run: `npx vitest run tests/unit/game-engine/modes/CricketMultiplayer.test.ts`
Expected: PASS. The engine already scores per player — `CricketMode.applyThrow` writes to
`data.marks[throwRecord.playerId]` and `awardPointsIfScoring` credits
`throwRecord.playerId`. The scoring rule the second test pins is the engine's own
(`awardPointsIfScoring`, `src/game-engine/modes/CricketMode.ts:105-119`): a dart scores
when the number was **already closed for the thrower** and at least one opponent still
has it open. These tests pin the behaviour so the view refactor in Steps 5–9 cannot
break it.

> **Pre-flight binding on this task: B1, B2, B3/C1, B6/C2.** The player name must be rendered in
> its **own element** (B1); the existing `tests/unit/game/modeViews.test.tsx:107` assertion must
> become `getAllByLabelText` or be scoped, because with two players the label matches twice
> (B2); every `toBeInTheDocument()` becomes `expect(...).toBeTruthy()` (B3/C1); and existing
> tests are updated, never weakened (B6/C2). See
> `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`.

- [ ] **Step 3: Change `CricketScoreSheetProps` to carry a player list**

In `src/components/game/types.ts`, replace the `CricketScoreSheetProps` interface with:

```ts
export interface CricketScoreSheetProps {
  /** The targets in play, e.g. 20 to 15 and the bull (25). */
  targets: readonly number[];
  /** The marks that close a target. */
  marksToClose: number;
  /** Every seated player and the marks they hold, in seating order. */
  players: ReadonlyArray<{
    id: string;
    name: string;
    marks: Record<string, number>;
  }>;
  /** The player whose turn it is. */
  currentPlayerId?: string | null;
}
```

- [ ] **Step 4: Write the failing sheet test — two players, two tables**

In `tests/unit/game/modeViews.test.tsx`, add to the existing `describe` block:

```tsx
it("shows a cricket score sheet per player", () => {
  render(
    <CricketScoreSheet
      targets={[20, 19, 18, 17, 16, 15, 25]}
      marksToClose={3}
      players={[
        { id: "alice", name: "Alice", marks: { "20": 3, "19": 1 } },
        { id: "bob", name: "Bob", marks: { "20": 1 } },
      ]}
      currentPlayerId="bob"
    />,
  );
  expect(screen.getByText("Alice")).toBeInTheDocument();
  expect(screen.getByText("Bob")).toBeInTheDocument();
  expect(screen.getByLabelText("20, 3 of 3 marks, closed")).toBeInTheDocument();
  expect(screen.getByLabelText("20, 1 of 3 marks")).toBeInTheDocument();
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/unit/game/modeViews.test.tsx`
Expected: FAIL — `CricketScoreSheet` does not accept a `players` prop.

- [ ] **Step 6: Rewrite `CricketScoreSheet` to render one sheet per player**

In `src/components/game/CricketScoreSheet.tsx`, replace the component with one that maps over `players` and renders the existing target grid once per player. Keep the existing grid markup exactly as it is — extract it into a local `PlayerTargets` component so the per-target markup is not duplicated:

```tsx
export function CricketScoreSheet({
  targets,
  marksToClose,
  players,
  currentPlayerId,
}: CricketScoreSheetProps) {
  return (
    <div className="space-y-lg">
      {players.map((player) => (
        <section
          key={player.id}
          aria-label={`${player.name} cricket targets`}
          className="rounded-md border border-rule bg-surface"
        >
          <header className="flex items-center justify-between border-b border-rule px-md py-sm">
            <h2 className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
              {player.name}
              {player.id === currentPlayerId ? " · ON TURN" : ""}
            </h2>
            <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
              {marksToClose} marks to close
            </p>
          </header>
          <ul className="grid grid-cols-4 gap-md p-md">
            {targets.map((target) => {
              const key = String(target);
              const count = player.marks[key] ?? 0;
              const closed = count >= marksToClose;
              const label = target === 25 ? "BULL" : String(target);
              return (
                <li
                  key={key}
                  aria-label={`${label}, ${count} of ${marksToClose} marks${closed ? ", closed" : ""}`}
                  className={`rounded-sm border p-md text-center ${
                    closed ? "border-brass bg-raised" : "border-rule bg-sunken"
                  }`}
                >
                  <span
                    className={`block font-mono text-heading font-bold ${
                      closed ? "text-brass" : "text-ink"
                    }`}
                  >
                    {label}
                  </span>
                  <span aria-hidden="true" className="mt-xs flex justify-center gap-xs">
                    {[0, 1, 2].map((pip) => (
                      <span
                        key={pip}
                        className={`h-2 w-2 rounded-full ${
                          pip < count ? "bg-brass" : "border border-edge"
                        }`}
                      />
                    ))}
                  </span>
                  <span
                    className={`mt-xs block font-caption text-caption ${
                      closed ? "text-brass" : "text-ink-muted"
                    }`}
                  >
                    {closed ? "CLOSED" : `${count}/${marksToClose}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

The `targetLabel` helper stays, but is now used inline as `target === 25 ? "BULL" : String(target)`. Delete the now-unused `playerName` handling.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/unit/game/modeViews.test.tsx`
Expected: PASS.

- [ ] **Step 8: Rewrite the cricket view to seat two players**

In `app/game/cricket/page.tsx`:

1. Replace `const PLAYER_ID = "player1";` with a helper that derives player ids from the names the setup collected:

```ts
/** The engine's player ids, in seating order. */
function playerIdsFor(names: readonly string[]): string[] {
  return names.map((_, index) => `player${index + 1}`);
}
```

2. `startMatch` becomes:

```ts
const startMatch = useCallback(
  (names: string[], options: PlayerSetupOptions) => {
    history.cancelCorrection();
    const eng = new GameEngine(new CricketMode());
    const ids = playerIdsFor(names);
    const state = eng.startMatch({ playerIds: ids });
    setEngine(eng);
    setMatchState(state);
    const byId: Record<string, string> = {};
    ids.forEach((id, index) => {
      byId[id] = names[index] ?? id;
    });
    setPlayerNames(byId);
    setWinnerId(null);
    setMessage("");
    setOptions(options);
    setPhase("playing");
  },
  [history],
);
```

3. `recordThrow` must read the marks of the **player who threw**, not of `PLAYER_ID`:

```ts
const playerId = matchState.currentPlayerId ?? "";
const before = readMarks(matchState, playerId);
...
const after = readMarks(state, playerId);
```

Add a module-level helper:

```ts
/** The marks one player holds, read from the mode's own state. */
function readMarks(state: MatchState, playerId: string): Record<string, number> {
  const marks = (state.modeData as CricketModeData | undefined)?.marks;
  return marks?.[playerId] ?? {};
}
```

4. The score sheet becomes:

```tsx
<CricketScoreSheet
  targets={CRICKET_TARGETS}
  marksToClose={MARKS_TO_CLOSE}
  players={(matchState?.players ?? []).map((player) => ({
    id: player.id,
    name: playerNames[player.id] ?? player.id,
    marks: readMarks(matchState!, player.id),
  }))}
  currentPlayerId={matchState?.currentPlayerId ?? null}
/>
```

5. `maxPlayers` becomes `2` and `minPlayers` becomes `1` on the `PlayerSetup`.

6. The badge counts the closed targets of the **current player**:

```ts
const currentPlayerId = matchState?.currentPlayerId ?? null;
const currentMarks = currentPlayerId ? readMarks(matchState!, currentPlayerId) : {};
const closed = CRICKET_TARGETS.filter(
  (target) => (currentMarks[String(target)] ?? 0) >= MARKS_TO_CLOSE,
).length;
```

7. The winner comes from the mode, not from `state.players[0]`:

```ts
import { getCricketWinnerId } from "@/game-engine/modes/CricketMode";
...
setWinnerId(getCricketWinnerId(state));
```

- [ ] **Step 9: Write the failing view test — a second player's marks are their own**

In `tests/unit/game/cricketCorrection.test.tsx`, add:

```tsx
it("shows two cricket sheets, one per player", () => {
  render(<CricketPage />);
  // start a match with two players
  // ...
  expect(screen.getByLabelText("Alice cricket targets")).toBeInTheDocument();
  expect(screen.getByLabelText("Bob cricket targets")).toBeInTheDocument();
});
```

Follow the file's existing setup helper for rendering the page and filling the setup form — read `tests/unit/game/cricketCorrection.test.tsx:1-35` for the established pattern and match it.

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run tests/unit/game/cricketCorrection.test.tsx`
Expected: PASS.

- [ ] **Step 11: Verify the whole suite and the gates**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run format:check`
Expected: all green; the test count is at least 540 + the new tests (the 2026-11-12 figure of
487 was measured on a different tree).

---

### Task M2: Around The Clock — a target per player, and a visible miss

**Files:**

- Modify: `src/game-engine/modes/AroundTheClockMode.ts`
- Modify: `src/game-engine/modes/AroundTheClockMode.ts` (`AroundTheClockModeData`)
- Modify: `app/game/around-the-clock/page.tsx`
- Modify: `src/components/game/AroundTheClockScoreSheet.tsx`
- Modify: `src/components/game/types.ts:274-279` (`AroundTheClockScoreSheetProps`)
- Test: `tests/unit/game-engine/modes/AroundTheClockMode.test.ts`
- Test: `tests/unit/game/modeViews.test.tsx`

> **Pre-flight binding on this task: B4, B5, B6/C2, B8, B1, B3/C1.** See
> `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`. The load-bearing one is **B4**:
> the completion rule of Step 3 below is **rejected as written** and replaced — the snippet
> shown there is the _corrected_ one.

**Interfaces:**

- Consumes: `AROUND_THE_CLOCK_TARGETS` (unchanged).
- Produces: `AroundTheClockModeData` changes shape:

```ts
export type AroundTheClockModeData = {
  /** Per-player: how many targets this player has hit. */
  playerProgress: Record<string, number>;
  /** Per-player: the index of the target this player is aiming at. */
  currentTargetIndex: Record<string, number>;
};
```

The old single `currentTargetIndex: number` field is **removed**, not kept as a fallback — two
sources of truth for "the target in play" is the bug being fixed. It is declared at
`src/game-engine/modes/AroundTheClockMode.ts:10` today; `playerProgress` already exists there
as a per-player map (`:9-13`) and is kept.

- [ ] **Step 1: Write the failing engine test — each player has their own target**

Add to `tests/unit/game-engine/modes/AroundTheClockMode.test.ts`:

```ts
it("gives each player their own target to hit", () => {
  const engine = new GameEngine(new AroundTheClockMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  engine.recordThrow({ playerId: "alice", points: 1 });
  engine.recordThrow({ playerId: "alice", points: 5 });
  engine.recordThrow({ playerId: "alice", points: 9 });
  const state = engine.getState();
  const data = state.modeData as AroundTheClockModeData;
  expect(data.currentTargetIndex["alice"]).toBe(1);
  expect(data.currentTargetIndex["bob"]).toBe(0);
});

it("does not advance a player whose dart missed the current target", () => {
  const engine = new GameEngine(new AroundTheClockMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  engine.recordThrow({ playerId: "alice", points: 1 });
  engine.recordThrow({ playerId: "alice", points: 5 });
  engine.recordThrow({ playerId: "alice", points: 9 });
  engine.recordThrow({ playerId: "bob", points: 20 });
  const data = engine.getState().modeData as AroundTheClockModeData;
  expect(data.currentTargetIndex["bob"]).toBe(0);
  expect(data.playerProgress["bob"]).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/game-engine/modes/AroundTheClockMode.test.ts`
Expected: FAIL — `currentTargetIndex` is a number today, not a map, and Bob's dart on 20 does not advance the shared index but also has no per-player index at all.

- [ ] **Step 3: Rewrite the mode to track a target per player**

In `src/game-engine/modes/AroundTheClockMode.ts`:

```ts
export type AroundTheClockModeData = {
  /** Per-player: how many targets this player has hit. */
  playerProgress: Record<string, number>;
  /** Per-player: the index of the target this player is aiming at. */
  currentTargetIndex: Record<string, number>;
};

export class AroundTheClockMode implements DartGameMode {
  readonly id = "around-the-clock";

  initializeMatch(draft: MutableMatchState): void {
    for (const player of draft.players) {
      player.totalPoints = 0;
    }
    const currentTargetIndex: Record<string, number> = {};
    for (const player of draft.players) {
      currentTargetIndex[player.id] = 0;
    }
    draft.modeData = { currentTargetIndex, playerProgress: {} } satisfies AroundTheClockModeData;
  }

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void {
    const data = requireModeData(draft);
    const player = draft.players.find((p) => p.id === throwRecord.playerId);
    if (!player) {
      return;
    }
    const index = data.currentTargetIndex[throwRecord.playerId] ?? 0;
    if (index >= AROUND_THE_CLOCK_TARGETS.length) {
      return;
    }
    const target = AROUND_THE_CLOCK_TARGETS[index]!;
    if (!hitsTarget(throwRecord.points, target)) {
      // A miss consumes the dart but does not move the player's target.
      return;
    }
    data.playerProgress[throwRecord.playerId] = index + 1;
    player.totalPoints = index + 1;
    data.currentTargetIndex[throwRecord.playerId] = index + 1;
    draft.modeData = structuredClone(data);
  }

  isMatchComplete(state: MatchState): boolean {
    const data = state.modeData as AroundTheClockModeData | undefined;
    if (!data) {
      return false;
    }
    // **Ruling B4:** the match ends when ONE player has cleared every target.
    // The mode's own class doc says so ("The player who hits all 21 targets
    // first wins the match", src/game-engine/modes/AroundTheClockMode.ts:20-22)
    // and the registry publishes the same rule
    // (src/game-engine/modes/registry.ts:168). A rule that required EVERY
    // player to finish would make a two-player match un-endable.
    return state.players.some(
      (player) => (data.currentTargetIndex[player.id] ?? 0) >= AROUND_THE_CLOCK_TARGETS.length,
    );
  }
}
```

Update `requireModeData` to seed `currentTargetIndex` as an empty map:

```ts
function requireModeData(draft: MutableMatchState): AroundTheClockModeData {
  const existing = draft.modeData as AroundTheClockModeData | undefined;
  if (existing && existing.currentTargetIndex && typeof existing.currentTargetIndex === "object") {
    return existing;
  }
  const created: AroundTheClockModeData = { currentTargetIndex: {}, playerProgress: {} };
  draft.modeData = created;
  return created;
}
```

The guard matters twice: a snapshot persisted by the old code carries
`currentTargetIndex` as a number, and a number is not a per-player map — and
`typeof null === "object"`, so the map itself must be checked for truthiness before
the type test.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/game-engine/modes/AroundTheClockMode.test.ts`
Expected: PASS for the new tests. The existing test "advances through all targets and completes the match on the last hit" uses one player and must still pass — `isMatchComplete` now requires **one** player to finish (ruling B4), which for a one-player match is the old behaviour.

> **Ruling B6/C2 — the existing tests are updated, never deleted.** Changing
> `currentTargetIndex` from a number to a per-player map breaks the tests that read the old
> shape: `tests/unit/game-engine/modes/AroundTheClockMode.test.ts:18-19` (the helper casts the
> index to a number), `tests/unit/game-engine/modes/CorrectionReplay.test.ts:113,119,124` and
> `tests/unit/game-engine/UndoCorrectModes.test.ts:180,183,194,197`. Each of them is **updated**
> to the new shape so it still asserts the same behaviour — never dropped, never weakened.

- [ ] **Step 5: Write the failing sheet test — one target per player**

Change `AroundTheClockScoreSheetProps` in `src/components/game/types.ts`:

```ts
export interface AroundTheClockScoreSheetProps {
  /** The targets in order: 1 to 20 and the bull (25). */
  targets: readonly number[];
  /** Every seated player and the target index they are aiming at. */
  players: ReadonlyArray<{
    id: string;
    name: string;
    currentIndex: number;
    hits: number;
  }>;
  /** The player whose turn it is. */
  currentPlayerId?: string | null;
}
```

Add to `tests/unit/game/modeViews.test.tsx`:

```tsx
it("shows the current target of every player in around the clock", () => {
  render(
    <AroundTheClockScoreSheet
      targets={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25]}
      players={[
        { id: "alice", name: "Alice", currentIndex: 4, hits: 4 },
        { id: "bob", name: "Bob", currentIndex: 0, hits: 0 },
      ]}
      currentPlayerId="alice"
    />,
  );
  // Ruling B1: the name is its own element, so `getByText` matches it.
  expect(screen.getByText("Alice")).toBeTruthy();
  expect(screen.getByText("Bob")).toBeTruthy();
});
```

> **Rulings B1, B3/C1, B5.** The name is rendered in its **own element** (B1); the assertions use
> `expect(...).toBeTruthy()`, never `toBeInTheDocument()` (B3/C1); and the progress readout is
> **scoped per player** — the "Progress N / 21" line lives at
> `src/components/game/AroundTheClockScoreSheet.tsx:26-28` and must sit inside the player's own
> `<section>`, so the assertion uses `within(section)` (B5). With two players an unscoped
> `getByText("Progress 0 / 21")` throws "found multiple".

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/unit/game/modeViews.test.tsx`
Expected: FAIL — the sheet does not accept `players`.

- [ ] **Step 7: Rewrite the sheet and the view**

Rewrite `src/components/game/AroundTheClockScoreSheet.tsx` to map over `players`, rendering each player's name and the target they are aiming at. Follow the same per-player structure as the cricket sheet in Task M1 Step 6 — one `<section aria-label={`${player.name} around the clock`}>` per player.

> **Ruling B8 — the sheet keeps the visible string "Target 1".** The 2026-11-12 version of this
> plan cited `tests/unit/game/modeViews.test.tsx:290` as the assertion that protects it. **That
> reference is obsolete in this tree**: the file is 233 lines, line 290 does not exist, and the
> literal string "Target 1" is asserted **nowhere** in `tests/`. What exists today is
> `tests/unit/game/modeViews.test.tsx:131` (`data-current-target` reads "1") and `:132`
> (`"Progress 0 / 21"`), plus the Playwright assertion `e2e/game-center.spec.ts:162`
> (`await expect(page.getByText("Target 1")).toBeVisible();`). The rewrite must therefore keep
> the visible string **"Target 1"** (it is produced by the match badge at
> `app/game/around-the-clock/page.tsx:167`) and must not break the e2e assertion.

In `app/game/around-the-clock/page.tsx`:

1. `startMatch` uses `playerIdsFor(names)` exactly as in Task M1 Step 8, and `maxPlayers` becomes `2`.
2. The current target is read per player:

```ts
const atcData = matchState?.modeData as AroundTheClockModeData | undefined;
const currentPlayerId = matchState?.currentPlayerId ?? null;
const currentIndex = currentPlayerId ? (atcData?.currentTargetIndex[currentPlayerId] ?? 0) : 0;
const currentTarget = AROUND_THE_CLOCK_TARGETS[currentIndex] ?? null;
```

3. The sheet is given the whole roster:

```tsx
<AroundTheClockScoreSheet
  targets={AROUND_THE_CLOCK_TARGETS}
  players={(matchState?.players ?? []).map((player) => ({
    id: player.id,
    name: playerNames[player.id] ?? player.id,
    currentIndex: atcData?.currentTargetIndex[player.id] ?? 0,
    hits: player.totalPoints,
  }))}
  currentPlayerId={currentPlayerId}
/>
```

4. A miss is announced. The mode already consumes the dart without advancing; the view must say so instead of showing nothing. In `recordThrow`, after a successful `history.submitThrow`, compare the target index before and after:

```ts
const before = atcTargetIndex(matchState, playerId);
const state = history.submitThrow({ points, segment: throwInput.segment });
if (!state) return;
const after = atcTargetIndex(state, playerId);
if (points > 0 && after === before) {
  setMessage(
    `Not ${AROUND_THE_CLOCK_TARGETS[before]}. Keep aiming for ${AROUND_THE_CLOCK_TARGETS[before]}.`,
  );
} else {
  setMessage("");
}
```

Add the module-level helper:

```ts
/** The index of the target a player is aiming at. */
function atcTargetIndex(state: MatchState, playerId: string): number {
  const data = state.modeData as AroundTheClockModeData | undefined;
  return data?.currentTargetIndex[playerId] ?? 0;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/game-engine/modes/AroundTheClockMode.test.ts tests/unit/game/modeViews.test.tsx`
Expected: PASS.

- [ ] **Step 9: Verify the whole suite and the gates**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run format:check`
Expected: all green.

---

### Task M3: Shanghai — the round advances on turns, and two players score separately

**Files:**

- Modify: `src/game-engine/modes/ShanghaiMode.ts`
- Modify: `app/game/shanghai/page.tsx`
- Modify: `src/components/game/ShanghaiScoreSheet.tsx`
- Modify: `src/components/game/types.ts:281-292` (`ShanghaiScoreSheetProps`)
- Test: `tests/unit/game-engine/modes/ShanghaiMode.test.ts`
- Test: `tests/unit/game/modeViews.test.tsx`

> **Pre-flight binding on this task: B7, A5, B6/C2, B1, B3/C1.** See
> `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`. The load-bearing one is **B7**:
> the Shanghai early return **must be kept** — see Step 3.

**Interfaces:**

- Consumes: `SHANGHAI_ROUNDS`, `roundTarget(round)`.
- Produces: `ShanghaiModeData` gains a per-player dart count and a per-player round history, so the sheet can show every player's marks per round:

```ts
export type ShanghaiModeData = {
  /** The index of the current round (0-based, so round 1 = index 0). */
  currentRound: number;
  /** Per-player: how many darts they have thrown in the current round. */
  dartsThisRound: Record<string, number>;
  /** Per-player round records for the current round. */
  roundRecords: Record<string, ShanghaiRoundRecord>;
  /** Per-player: the marks they scored in every finished round. */
  finishedRounds: Record<string, number[]>;
};
```

**What is actually broken** (verified against `4014b44` on 2026-11-12 by running the
engine directly — not inferred — and **re-verified on 2026-11-15 against `d73c37f`**):

- `ShanghaiModeData.roundRecords[player].marks` is declared but **never incremented**
  (`src/game-engine/modes/ShanghaiMode.ts:18-26` declares it; `applyThrow` at `:52-100`
  never writes it). It is therefore always `0`, and there is no record anywhere of what
  a player scored in a round.
- `totalDartsThisRound` counts darts across the whole match, not per player
  (`src/game-engine/modes/ShanghaiMode.ts:16,68,93`). For a
  **fixed** roster it happens to advance the round at the right moment (verified: two
  players, three darts each → `currentRound` goes 0 → 1 exactly once). It is
  nevertheless the wrong shape: it cannot say _whose_ darts have been counted, and
  the score sheet has no per-player round history to read.
- The view's round table is derived from the raw ledger index
  (`app/game/shanghai/page.tsx:59-68`: `Math.floor(index / 3) + 1`).
  With two players that puts both players' darts in the same round — verified: two
  players each throwing three singles in round 1 yields a table of
  `{ "1": 3 }` while both players actually scored `3`. The table and the mode
  disagree the moment a second player is seated.

- [ ] **Step 1: Write the failing engine tests — the round history is recorded**

Add to `tests/unit/game-engine/modes/ShanghaiMode.test.ts`:

```ts
it("records the marks each player scored in the round", () => {
  const engine = new GameEngine(new ShanghaiMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  engine.recordThrow({ playerId: "alice", points: 3 });
  const data = engine.getState().modeData as ShanghaiModeData;
  expect(data.roundRecords?.["alice"]?.marks).toBe(3);
});

it("keeps every finished round's marks for every player", () => {
  const engine = new GameEngine(new ShanghaiMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  for (const id of ["alice", "alice", "alice", "bob", "bob", "bob"]) {
    engine.recordThrow({ playerId: id, points: 1 });
  }
  const data = engine.getState().modeData as ShanghaiModeData;
  expect(data.currentRound).toBe(1);
  expect(data.finishedRounds?.["alice"]).toEqual([3]);
  expect(data.finishedRounds?.["bob"]).toEqual([3]);
});

it("keeps each player's marks per round apart", () => {
  const engine = new GameEngine(new ShanghaiMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  for (let i = 0; i < 3; i += 1) engine.recordThrow({ playerId: "alice", points: 3 });
  for (let i = 0; i < 3; i += 1) engine.recordThrow({ playerId: "bob", points: 1 });
  const state = engine.getState();
  expect(state.players.find((p) => p.id === "alice")!.totalPoints).toBe(9);
  expect(state.players.find((p) => p.id === "bob")!.totalPoints).toBe(3);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/game-engine/modes/ShanghaiMode.test.ts`
Expected: the first test FAILS — `record.marks` is `0`, not `3`. The second test FAILS
on `finishedRounds`, which does not exist on the state today. The third test PASSES
already — the players' totals are correct; it is the _per-round_ record that is
missing.

- [ ] **Step 3: Record the round history in the mode**

In `src/game-engine/modes/ShanghaiMode.ts`:

1. Replace the `totalDartsThisRound` counter with a per-player dart count:

```ts
export type ShanghaiModeData = {
  /** The index of the current round (0-based, so round 1 = index 0). */
  currentRound: number;
  /** Per-player: how many darts they have thrown in the current round. */
  dartsThisRound: Record<string, number>;
  /** Per-player round records for the current round. */
  roundRecords: Record<string, ShanghaiRoundRecord>;
  /** Per-player: the marks they scored in every finished round. */
  finishedRounds: Record<string, number[]>;
};
```

2. `initializeMatch` seeds `dartsThisRound` to `{}` and `finishedRounds` to `{}`.

3. `applyThrow` increments the thrower's counter, adds the marks to the round
   record, and advances the round only when **every** player has thrown three darts:

```ts
data.dartsThisRound[throwRecord.playerId] = (data.dartsThisRound[throwRecord.playerId] ?? 0) + 1;

const roundComplete = draft.players.every((player) => (data.dartsThisRound[player.id] ?? 0) >= 3);
if (roundComplete) {
  for (const player of draft.players) {
    const marks = data.roundRecords[player.id]?.marks ?? 0;
    data.finishedRounds[player.id] = [...(data.finishedRounds[player.id] ?? []), marks];
  }
  data.currentRound += 1;
  data.dartsThisRound = {};
  data.roundRecords = {};
}
```

and, in the scoring branch, add the marks to the record next to the segment flags:

```ts
const record = data.roundRecords[throwRecord.playerId]!;
record.marks += marks;
recordSegmentHit(record, throwRecord.points, target);
player.totalPoints += marks;
```

> **Ruling B7 (load-bearing) — the Shanghai early return MUST be kept.** The snippet above
> replaces the scoring block, and the Shanghai check that follows it **must not be dropped**:
>
> ```ts
> // Check for Shanghai (all three segments hit in one round).
> if (record.hitSingle && record.hitDouble && record.hitTriple) {
>   draft.modeData = structuredClone(data);
>   return; // ← the match ends here; the round does NOT advance
> }
> ```
>
> The early return is at `src/game-engine/modes/ShanghaiMode.ts:86-89` today, and it is pinned
> by `tests/unit/game-engine/modes/ShanghaiMode.test.ts:86-97` ("detects Shanghai and completes
> the match immediately": `status === "completed"`, `currentPlayerId === null`, 6 marks). The
> round-advance block runs **after** the early return, and the early-return path must
> **skip** the round advance — a Shanghai ends the match, not the round. Cost if wrong: the
> "Shanghai!" win silently stops working and an existing test goes red.

4. `requireModeData` seeds the new fields too (`{ currentRound: 0, dartsThisRound: {}, roundRecords: {}, finishedRounds: {} }`). It is at `src/game-engine/modes/ShanghaiMode.ts:148-156` today.

5. `isMatchComplete` stays as it is, but the "Shanghai!" check must look at the current round's records only — it already does.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/game-engine/modes/ShanghaiMode.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing sheet test — a row per player, a column per round**

Change `ShanghaiScoreSheetProps` in `src/components/game/types.ts`:

```ts
export interface ShanghaiScoreSheetProps {
  /** The round in play, 1-based. */
  currentRound: number;
  /** The number of rounds in the match. */
  totalRounds: number;
  /** The target of every round, the first round first. */
  targets: readonly number[];
  /** Every seated player and the marks they scored in every round. */
  players: ReadonlyArray<{
    id: string;
    name: string;
    marksByRound: number[];
  }>;
  /** The player whose turn it is. */
  currentPlayerId?: string | null;
  /** The segments the current player has hit in the round in play. */
  hit: { single: boolean; double: boolean; triple: boolean };
}
```

`currentRound` and `hit` stay: the round-in-play header and the S/D/T strip
("Shanghai possible") belong to the whole match, not to one player. `marksByRound`
(the single map) is **removed** — the per-player array replaces it.

Add to `tests/unit/game/modeViews.test.tsx`:

```tsx
it("shows a shanghai row per player and a column per round", () => {
  render(
    <ShanghaiScoreSheet
      currentRound={2}
      totalRounds={7}
      targets={[1, 2, 3, 4, 5, 6, 7]}
      players={[
        { id: "alice", name: "Alice", marksByRound: [3, 2, 1, 0, 0, 0, 0] },
        { id: "bob", name: "Bob", marksByRound: [1, 1, 0, 0, 0, 0, 0] },
      ]}
      currentPlayerId="alice"
      hit={{ single: true, double: false, triple: false }}
    />,
  );
  expect(screen.getByText("Alice")).toBeTruthy();
  expect(screen.getByText("Bob")).toBeTruthy();
});
```

> **Rulings B1, B3/C1.** The name is rendered in its **own element** (B1) and the assertions use
> `expect(...).toBeTruthy()` (B3/C1). The "ON TURN" marker must not be concatenated into the
> same cell text.

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/unit/game/modeViews.test.tsx`
Expected: FAIL — the sheet does not accept `players`.

- [ ] **Step 7: Rewrite the sheet and the view**

Rewrite `src/components/game/ShanghaiScoreSheet.tsx` to render a table: one row per
player, one column per round, plus a total column. The existing single-player grid
of round cells is replaced by this table. Keep the S/D/T strip (`SEGMENTS`, the
`hit` prop) — it reports the round in play for everyone.

In `app/game/shanghai/page.tsx`:

1. `startMatch` uses `playerIdsFor(names)` as in Task M1 Step 8; `maxPlayers` becomes `2`.
2. The round table comes from the **mode's own state**, not from a private
   counter and not from the raw ledger. After Task M3 the mode knows exactly
   which round every dart belongs to: the finished rounds are in
   `finishedRounds` (one entry per round, per player) and the round in play is
   in `roundRecords`. Replace `marksByRoundFromLedger`
   (`app/game/shanghai/page.tsx:59-68`) with:

```ts
/**
 * The marks every player scored in every round, read from the mode's state.
 *
 * `finishedRounds` holds the rounds that are done; the round in play is
 * still in `roundRecords`. Reading both means the table is always the
 * engine's own view of the match — an undo or a correction rescores it
 * free.
 */
function marksByRoundFromMode(
  data: ShanghaiModeData | undefined,
  playerIds: readonly string[],
): Map<string, number[]> {
  const byPlayer = new Map<string, number[]>();
  for (const playerId of playerIds) {
    const finished = data?.finishedRounds[playerId] ?? [];
    const current = data?.roundRecords[playerId]?.marks ?? 0;
    byPlayer.set(playerId, [...finished, current]);
  }
  return byPlayer;
}
```

The old helper divided the raw ledger index by three, which is only right
while exactly one player is seated — with two players it puts both players'
darts in the same round.

3. The sheet is given the roster:

```tsx
<ShanghaiScoreSheet
  currentRound={currentRound}
  totalRounds={SHANGHAI_ROUNDS}
  targets={ROUND_TARGETS}
  players={(matchState?.players ?? []).map((player) => ({
    id: player.id,
    name: playerNames[player.id] ?? player.id,
    marksByRound: marksByRound.get(player.id) ?? [],
  }))}
  currentPlayerId={matchState?.currentPlayerId ?? null}
  hit={hit}
/>
```

`ROUND_TARGETS` already exists in the page (`app/game/shanghai/page.tsx:33-35`) —
use it rather than rebuilding the array.

4. The `hit` strip reads the **current player's** record, not `PLAYER_ID`'s:
   `data?.roundRecords?.[matchState?.currentPlayerId ?? ""]`. Today the view hardcodes
   `PLAYER_ID` at `app/game/shanghai/page.tsx:186` — that is the bug.

5. The badge shows the current round and the target: `badge={`Round ${currentRound + 1} · ${roundTarget(currentRound + 1)}`}`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/game-engine/modes/ShanghaiMode.test.ts tests/unit/game/modeViews.test.tsx`
Expected: PASS.

- [ ] **Step 9: Verify the whole suite and the gates**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run format:check`
Expected: all green.

---

### Task M4: Best-of-N legs and sets, reachable from the setup

**Files:**

- Modify: `src/components/game/PlayerSetup.tsx`
- Modify: `src/components/game/types.ts` (`PlayerSetupOptions`, `PlayerSetupProps`)
- Modify: `src/components/x01/X01MatchView.tsx`
- Modify: `src/components/game/ScoreDisplay.tsx`
- Modify: `src/game-engine/modes/StandardMode.ts` — **only** the `initializeMatch` seeding
  required by ruling B9. The engine-side work is otherwise already done.
- Test: `tests/unit/game/playerSetup.test.tsx`
- Test: `tests/unit/game/x01MatchView.test.tsx`
- Test: `tests/unit/game-engine/modes/StandardMode.test.ts` — **owned by the `game-engine`
  agent** (the file lives under `tests/unit/game-engine/`), not by the frontend agent. See the
  work-package plan's task table.

**Interfaces:**

- Consumes: `LegSetManager` (`src/game-engine/rules/LegSetManager.ts`), `LEG_SET_MODE_DATA_KEY` (`src/game-engine/rules/LegSetManager.ts:118`), `MatchConfig.legs` / `MatchConfig.sets` (`src/game-engine/types.ts:164-167`), `StandardMode.configure` (`src/game-engine/modes/StandardMode.ts:67-77`).
- Produces: `PlayerSetupOptions` gains `legs?: number` and `sets?: number`. `PlayerSetupProps` gains an optional `matchFormat?: readonly { id: string; label: string; legs?: number; sets?: number }[]` prop — when absent, the setup offers no format choice (so the three non-x01 modes are unchanged).

> **Ruling B9 (load-bearing) — the leg/set slice must be seeded, and the sizes must reach the
> view.** `Leg 1/3` **cannot render today**. `StandardMode.initializeMatch`
> (`src/game-engine/modes/StandardMode.ts:89-93`) sets only `player.totalPoints`; the
> `LEG_SET_MODE_DATA_KEY` slice is written **only** in `handleLegCompleted`
> (`src/game-engine/modes/StandardMode.ts:149`), i.e. after the first leg ends. Two things are
> therefore required:
>
> 1. `StandardMode.initializeMatch` seeds `LEG_SET_MODE_DATA_KEY` with
>    `LegSetManager.initialProgress()` (`src/game-engine/rules/LegSetManager.ts:77-78`) whenever a
>    leg/set manager is active (legs > 0 or sets > 0).
> 2. The **sizes** must also reach the view. The view's own reader,
>    `src/components/x01/X01MatchView.tsx:69-80`, reads the key and then returns `{}` on
>    purpose — "the sizes the match was configured with are not in the state: without them there
>    is no honest '2/5' to show". So the seeded slice alone is **not** enough; either the
>    configured sizes are added to the seeded progress, or the view keeps the chosen sizes in
>    its own state (it already holds `outRule` and `boardSource` there) and combines them with
>    the engine's won-counts.
>
> Cost if wrong: M4's readout never appears in the product.
>
> Full ruling set: `docs/superpowers/plans/2026-11-12-game-modes-preflight.md` (B9, plus B3/C1,
> B6/C2, C2, C6 and C4).

- [ ] **Step 1: Write the engine tests — the leg structure survives a replay and is recorded**

Add to `tests/unit/game-engine/modes/StandardMode.test.ts` (import
`LEG_SET_MODE_DATA_KEY` from `@/game-engine/rules` and the `LegSetProgress` type
from `@/game-engine` — both are exported):

```ts
it("keeps the leg structure alive across an undo", () => {
  const engine = new GameEngine(new StandardMode({ startScore: 101 }));
  engine.startMatch({ playerIds: ["alice"], outRule: "double", legs: 3 });
  // Alice scores 22 in one visit: 101 - 1 - 20 - 1 = 79.
  for (const points of [1, 20, 1]) engine.recordThrow({ playerId: "alice", points });
  const after = engine.getState();
  expect(after.players[0]!.totalPoints).toBe(79);
  engine.undoLastThrow();
  const undone = engine.getState();
  expect(undone.players[0]!.totalPoints).toBe(80);
});

it("records a leg win in the mode's own state", () => {
  const engine = new GameEngine(new StandardMode({ startScore: 20 }));
  engine.startMatch({ playerIds: ["alice", "bob"], outRule: "double", legs: 3 });
  engine.recordThrow({ playerId: "alice", points: 20, segment: "double" });
  const progress = engine.getState().modeData?.[LEG_SET_MODE_DATA_KEY] as LegSetProgress;
  expect(progress.legsWon).toEqual({ alice: 1 });
  expect(progress.matchWinnerId).toBeNull();
});
```

The second test pins the property the plan is really about: the leg structure
already works in the engine (verified against `4014b44` — `legsWon` is `{ alice: 1 }`
after Alice takes the first leg, and both players are back at the start score).
What is missing is the **UI** that lets a player choose the format.

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/game-engine/modes/StandardMode.test.ts`
Expected: PASS — `StandardMode.configure` already reads `config.legs`, and `createSeedDraft` re-applies the retained configuration. These tests pin the behaviour so the UI work in Steps 4–8 cannot break the replay.

- [ ] **Step 3: Write the failing setup test — the format is offered and reported back**

In `tests/unit/game/playerSetup.test.tsx`, add:

```tsx
it("offers the match format and reports the chosen one", () => {
  const onStart = vi.fn();
  render(
    <PlayerSetup
      modeName="501"
      modeDescription="Classic x01."
      minPlayers={1}
      maxPlayers={2}
      matchFormat={[
        { id: "single", label: "Single leg" },
        { id: "bo3", label: "Best of 3 legs", legs: 3 },
      ]}
      onStart={onStart}
    />,
  );
  fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Alice" } });
  fireEvent.click(screen.getByRole("radio", { name: /Best of 3 legs/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start match" }));
  expect(onStart).toHaveBeenCalledWith(["Alice"], expect.objectContaining({ legs: 3 }));
});
```

The repository has no `@testing-library/user-event` — use `fireEvent`, as
`tests/unit/game/playerSetup.test.tsx` does.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/unit/game/playerSetup.test.tsx`
Expected: FAIL — `PlayerSetup` has no `matchFormat` prop.

- [ ] **Step 5: Add the format choice to the setup**

In `src/components/game/types.ts`:

```ts
export interface PlayerSetupOptions {
  outRule: OutRuleId;
  boardSource: BoardSourceId;
  /** Best-of-N legs per set, when the match has one. */
  legs?: number;
  /** Best-of-N sets per match, when the match has one. */
  sets?: number;
}
```

and on `PlayerSetupProps`:

```ts
  /** The match formats on offer. Absent means a single leg. */
  readonly matchFormat?: readonly MatchFormatChoice[];
```

with

```ts
export interface MatchFormatChoice {
  readonly id: string;
  readonly label: string;
  readonly legs?: number;
  readonly sets?: number;
}
```

In `src/components/game/PlayerSetup.tsx`:

1. Add the prop to the destructure with a default of `undefined`.
2. Add state, defaulting to the first choice so the form never starts with
   nothing selected:

```ts
const [format, setFormat] = useState<MatchFormatChoice | null>(matchFormat?.[0] ?? null);
```

3. Render the choices as a radio group, mirroring the existing `CHECKOUT` group's markup and class vocabulary:

```tsx
{
  matchFormat && matchFormat.length > 1 && (
    <div role="radiogroup" aria-labelledby="match-format-label">
      <p
        id="match-format-label"
        className="mb-sm font-caption text-caption uppercase tracking-[0.04em] text-ink-faint"
      >
        Match format
      </p>
      <div className="space-y-sm">
        {matchFormat.map((choice) => (
          <label key={choice.id} className="flex items-center gap-md">
            <span className={RADIO_CELL}>
              <input
                type="radio"
                name="match-format"
                value={choice.id}
                checked={format?.id === choice.id}
                onChange={() => setFormat(choice)}
                className={`${RADIO_INPUT} ${DISABLED}`}
              />
              <span aria-hidden="true" className={RADIO_MARK} />
            </span>
            <span className="block font-label text-label text-ink">{choice.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

4. `handleStart` passes the format's legs and sets:

```ts
onStart(filled, {
  outRule: rule,
  boardSource: source,
  ...(format?.legs === undefined ? {} : { legs: format.legs }),
  ...(format?.sets === undefined ? {} : { sets: format.sets }),
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/unit/game/playerSetup.test.tsx`
Expected: PASS.

- [ ] **Step 7: Wire the format into the x01 view and the engine config**

In `src/components/x01/X01MatchView.tsx`:

1. Define the formats next to the mode description. The type is
   `readonly MatchFormatChoice[]` — a plain array, not `as const`, so `legs` widens to
   `number` and matches the prop type:

```ts
/** The match formats x01 offers. */
const MATCH_FORMATS: readonly MatchFormatChoice[] = [
  { id: "single", label: "Single leg" },
  { id: "bo3", label: "Best of 3 legs", legs: 3 },
  { id: "bo5", label: "Best of 5 legs", legs: 5 },
];
```

2. Pass `matchFormat={MATCH_FORMATS}` to the `PlayerSetup`.

3. `startMatch` passes them to the engine:

```ts
const state = nextEngine.startMatch({
  playerIds,
  outRule: options.outRule,
  ...(options.legs === undefined ? {} : { legs: options.legs }),
  ...(options.sets === undefined ? {} : { sets: options.sets }),
});
```

- [ ] **Step 8: Show the legs and sets on the score sheet**

`ScoreDisplay` does not receive the match state — it takes `players`, `currentPlayerId`,
`playerNames` and an optional `leg` / `set` pair (`src/components/game/types.ts:128-143`).
Read the progress in the **view** and pass it down, rather than widening the component's
props to the whole state.

In `src/components/x01/X01MatchView.tsx`, read the leg/set slice out of the state:

```ts
// `MatchModeData` is `Record<string, unknown>`, so the slice needs a cast.
const legSet = matchState?.modeData?.[LEG_SET_MODE_DATA_KEY] as LegSetProgress | undefined;
```

`playerIds` is local to `startMatch` (`src/components/x01/X01MatchView.tsx:127`), so it is
not in scope at render time. The leg and the set in play are the same for every
player — they are the leg the match is _on_, not a player's tally. Take the
highest tally any player has reached and add one:

```ts
/** The number of legs any player has won. */
function legsWonBy(legSet: LegSetProgress | undefined): number {
  if (!legSet) return 0;
  return Math.max(0, ...Object.values(legSet.legsWon));
}

/** The number of sets any player has won. */
function setsWonBy(legSet: LegSetProgress | undefined): number {
  if (!legSet) return 0;
  return Math.max(0, ...Object.values(legSet.setsWon));
}

/** The leg in play, e.g. `{ current: 2, total: 3 }`. */
const leg = legSet ? { current: legsWonBy(legSet) + 1, total: legs ?? 1 } : undefined;

/** The set in play, e.g. `{ current: 1, total: 2 }`. */
const set = legSet ? { current: setsWonBy(legSet) + 1, total: sets ?? 1 } : undefined;
```

`options` is the setup's choices. The x01 view does **not** keep a single options object
today — it holds `outRule` and `boardSource` as two pieces of state
(`src/components/x01/X01MatchView.tsx:111-112`). Add the leg and set sizes the same way, as
two more pieces of state:

```ts
const [legs, setLegs] = useState<number | undefined>(undefined);
const [sets, setSets] = useState<number | undefined>(undefined);
```

Set them in `startMatch` next to the existing two:

```ts
setLegs(options.legs);
setSets(options.sets);
```

and read `legs` / `sets` in the `leg` and `set` descriptors instead of `options.legs` /
`options.sets`. `playAgain` re-starts the match with `{ outRule, boardSource }`
(`src/components/x01/X01MatchView.tsx:212-215`) — it must carry the leg and set sizes
too, or "Play again" silently drops the format:

```ts
const playAgain = useCallback(() => {
  const names = Object.entries(playerNames).map(([, name]) => name);
  startMatch(names, {
    outRule,
    boardSource,
    ...(legs === undefined ? {} : { legs }),
    ...(sets === undefined ? {} : { sets }),
  });
}, [boardSource, legs, outRule, playerNames, sets, startMatch]);
```

Pass them to the sheet:

```tsx
<ScoreDisplay
  players={[...matchState.players]}
  currentPlayerId={currentPlayerId}
  playerNames={playerNames}
  throwHistory={[...matchState.throws]}
  leg={leg}
  set={set}
  caption="Remaining"
/>
```

`ScoreDisplay` already accepts and renders `leg` and `set` — it shows them in the
header (`Leg 2/3`, `Set 1/2`, `src/components/game/ScoreDisplay.tsx:29-38`). That is
the leg and set the **match** is on, which is what the header needs. Do not add a
per-player leg count to `ScoreDisplay`: the header already carries the format, and a
per-row counter would need a new prop and a new row cell for information that only
matters between legs.

Import `LEG_SET_MODE_DATA_KEY` from `@/game-engine/rules` and the `LegSetProgress`
type from `@/game-engine` (both are exported).

- [ ] **Step 9: Write the failing view test — the format reaches the engine**

In `tests/unit/game/x01MatchView.test.tsx`, add:

```tsx
it("passes the chosen match format to the engine configuration", () => {
  render(<X01MatchView startScore={501} modeName="501" />);
  fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Dave" } });
  fireEvent.click(screen.getByRole("radio", { name: /best of 3 legs/i }));
  fireEvent.click(screen.getByRole("button", { name: /start match/i }));
  expect(screen.getByText("Leg 1/3")).toBeTruthy();
});
```

`fireEvent`, not `userEvent` — the repository has no `@testing-library/user-event`.
The radio's accessible name is the format's label, because `PlayerSetup` renders the
label text next to the input (as the checkout group already does).
`expect(...).toBeTruthy()`, not `toBeInTheDocument()` — **ruling B3/C1**.

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run tests/unit/game/x01MatchView.test.tsx`
Expected: PASS.

- [ ] **Step 11: Verify the whole suite and the gates**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run format:check`
Expected: all green.

---

### Task M5: A tie is a tie, and the tie-break rule is on screen

**Files:**

- Modify: `src/game-engine/modes/ShanghaiMode.ts`
- Modify: `src/game-engine/types.ts` (`DartGameMode`, and the new `MatchResult` type)
- Modify: `src/game-engine/GameEngine.ts` (the conversion, **not** a new state field)
- Modify: `src/game-engine/index.ts` (export `MatchResult` if it becomes public)
- Modify: `src/game-engine/README.md:195-207` (the `MatchState` code block)
- Modify: `src/components/game/GameResultBanner.tsx`
- Modify: `src/components/game/types.ts` (`GameResultBannerProps`)
- Modify: `app/game/shanghai/page.tsx`
- Test: `tests/unit/game-engine/modes/ShanghaiMode.test.ts`
- Test: `tests/unit/game/gameResultBanner.test.tsx`

> ### ⚠ Deviation from the 2026-11-12 draft — the `MatchState.result` field is **not** added
>
> The 2026-11-12 draft of this task proposed a new `MatchState.result?: MatchResult` field,
> written by the engine. **That proposal is changed.** The reason, verified on 2026-11-15
> against `d73c37f`:
>
> - **The tree already has a result seam.** `src/game-engine/types.ts:213` declares
>   `resultSignature?(state: MatchState): string;` on `DartGameMode`. The only implementation
>   is `src/game-engine/modes/StandardMode.ts:129`. The engine consumes it in
>   `src/game-engine/GameEngine.ts:358-364` (`private resultKey(state): string`), which falls
>   back to `"complete" | "open"`.
> - **Adding `MatchState.result` would be a second, parallel result mechanism** next to that
>   seam — two places that answer "how did the match end?", drifting apart. That duplication
>   must be avoided.
> - **But the existing seam is not a ready-made replacement.** It is **optional**,
>   **string-valued**, **audit-only**, implemented by **one** mode, and its engine-side use is
>   **private**. `resultKey` has exactly **one** caller: `shouldAudit` at
>   `src/game-engine/GameEngine.ts:344-351` (line `350`), where it decides whether a
>   correction of a dart in the live turn enters the audit trail. It answers _"did the result
>   change?"_ — it does **not** answer _"who won, is it a tie, by what margin?"_, which is
>   exactly what M5's result screen needs.
> - **Therefore M5 EXTENDS the existing seam rather than bypassing it.** The structured result
>   belongs on the **mode** (e.g. a `mode.result(state)` accessor returning a JSON-safe
>   `MatchResult`), and the engine converts it alongside `resultSignature`, so the audit
>   comparison keeps working. The engine does **not** bolt an unrelated `MatchState.result`
>   field onto the state.
> - **`MatchResult` must be JSON-safe** (ruling C5: the engine stays framework-agnostic and the
>   snapshot survives a JSON round-trip — `src/game-engine/types.ts:120-125`,
>   `tests/unit/game-engine/frameworkAgnostic.test.ts:70-73`) and **must be exported from
>   `src/game-engine/index.ts`** if it becomes part of the public surface. Today that barrel
>   exports **no** `MatchResult` or equivalent (`src/game-engine/index.ts:11-34`).
> - **M5 must update the engine README's `MatchState` code block itself**
>   (`src/game-engine/README.md:195-207`), because the shape changes. M7's doc scope does not
>   cover the engine README — this is the scope gap the 2026-11-12 scan found.
>
> **Rulings binding on this task: B10 (above), A4, A5, B3/C1, C5.** See
> `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`.

**Interfaces:**

- Consumes: `GameResultBanner` (`src/components/game/GameResultBanner.tsx`).
- Produces: a structured, JSON-safe `MatchResult` **on the mode**, exposed through the existing
  `DartGameMode` seam:

```ts
/** How the match ended, when it ended in anything but a plain win. */
export interface MatchResult {
  /** The winners, when there is exactly one. */
  readonly winnerId?: string;
  /** True when the match ended level. */
  readonly tied: boolean;
  /** The rule that decides a tie, named for the screen. */
  readonly tieBreak?: string;
}
```

The engine derives it — never the view. The view reads what the engine derived.

- [ ] **Step 1: Write the failing engine test — a level match is a tie**

Add to `tests/unit/game-engine/modes/ShanghaiMode.test.ts`:

```ts
it("reports a level match as a tie", () => {
  const engine = new GameEngine(new ShanghaiMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  // Both players score the same number of marks across the rounds.
  // Play 7 rounds of single 1 for each player.
  for (let round = 0; round < 7; round += 1) {
    for (const playerId of ["alice", "bob"]) {
      for (let dart = 0; dart < 3; dart += 1) {
        engine.recordThrow({ playerId, points: 1 });
      }
    }
  }
  const state = engine.getState();
  expect(state.status).toBe("completed");
  expect(engine.getResult()?.tied).toBe(true);
});
```

`engine.getResult()` is the engine's **public** accessor for the derived result (the deviation
note above explains why it is not a state field). The mode owns the answer; the engine derives
and exposes it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/game-engine/modes/ShanghaiMode.test.ts`
Expected: FAIL — `GameEngine` has no `getResult()` today, and `DartGameMode` has no
`result` accessor.

- [ ] **Step 3: Extend the existing result seam instead of adding a second one**

In `src/game-engine/types.ts`, add the `MatchResult` interface (above) and give
`DartGameMode` **one** new optional member, next to the existing `resultSignature`
(`src/game-engine/types.ts:213`):

```ts
  /**
   * The structured result of the match — who won, or that it ended level.
   *
   * The mode owns the meaning, exactly as it owns the meaning of
   * {@link resultSignature}. The engine derives the signature and the
   * structured result from the same source, so the two can never disagree.
   */
  result?(state: MatchState): MatchResult;
```

In `src/game-engine/GameEngine.ts`:

1. `applyToDraft` (`:242-270`) records the derived result when the match completes:

```ts
if (this.mode.isMatchComplete(asMatchState(draft))) {
  draft.status = "completed";
  draft.currentPlayerId = null;
  draft.throwsInCurrentTurn = 0;
  this.result = this.buildResult(draft);
}
```

2. Add the helper and the public accessor:

```ts
/**
 * Describes how the match ended: the winner, or a tie when the mode
 * ended the match level. The mode owns the tie-break rule.
 */
private buildResult(draft: MutableMatchState): MatchResult | undefined {
  return this.mode.result?.(asMatchState(draft));
}

/** The structured result of the match, once it has ended. */
getResult(): MatchResult | undefined {
  return this.result;
}
```

3. **Keep the audit comparison alive.** `resultKey` (`:358-364`) must still answer _"did the
   result change?"_ for `shouldAudit` (`:344-351`). Either `ShanghaiMode` also implements
   `resultSignature` (as `StandardMode` does at `:129`), or `resultKey` is derived from the
   structured result. **Whichever is chosen, the structured result and the signature must come
   from the same mode-owned source** — the engine must not hold two independent notions of
   "how the match ended".

4. `ShanghaiMode` implements the accessor:

```ts
result(state: MatchState): MatchResult {
  const data = state.modeData as ShanghaiModeData | undefined;
  // A "Shanghai!" wins the match outright, whatever the totals say.
  //
  // RULING A5: the flag is read from the mode's OWN dedicated field or
  // from the ledger-derived segment flags — NEVER from `roundRecords`,
  // because `roundRecords` is cleared when the round advances
  // (src/game-engine/modes/ShanghaiMode.ts:96) and a completed round's
  // flags no longer exist there.
  const shanghai = data?.shanghaiWinnerId;
  if (shanghai) {
    return { winnerId: shanghai, tied: false };
  }
  const best = Math.max(...state.players.map((player) => player.totalPoints));
  const leaders = state.players.filter((player) => player.totalPoints === best);
  if (leaders.length === 1) {
    return { winnerId: leaders[0]!.id, tied: false };
  }
  return {
    tied: true,
    tieBreak:
      "Tied on marks — the highest single round wins; if that is level too, the tied players play the final round.",
  };
}
```

`ShanghaiMode` therefore needs a **dedicated** `shanghaiWinnerId` field in its mode data
(written where the Shanghai check happens, `src/game-engine/modes/ShanghaiMode.ts:86-89`) — that
is the "dedicated mode flag" ruling **A5** requires.

> **Ruling A4 — the winner rule must not assume a shared ATC `currentTargetIndex`.**
> `AroundTheClockModeData.currentTargetIndex` is a **shared** number today
> (`src/game-engine/modes/AroundTheClockMode.ts:10,64`) and becomes a per-player map in M2. Any
> winner rule written against the shared index breaks. M5's rule reads the cricket/standard data
> or a mode-specific accessor — never a shared ATC index.

The Shanghai check comes first: a player who hits all three segments of the target
wins the match on the spot (`ShanghaiMode.isMatchComplete`), and that player need not
be ahead on the total — the round they scored is worth 6 marks while the round they
missed is worth 0.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/game-engine/modes/ShanghaiMode.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing banner test — a tie is announced as a tie**

In `tests/unit/game/gameResultBanner.test.tsx`, add:

```tsx
it("announces a tie instead of naming a winner", () => {
  render(
    <GameResultBanner
      winnerId={null}
      tied
      players={[
        { id: "alice", totalPoints: 21 },
        { id: "bob", totalPoints: 21 },
      ]}
      playerNames={{ alice: "Alice", bob: "Bob" }}
      onPlayAgain={vi.fn()}
      onBackToHub={vi.fn()}
    />,
  );
  expect(screen.getByText(/tie/i)).toBeTruthy();
});
```

> **Ruling B3/C1:** `expect(...).toBeTruthy()`, never `toBeInTheDocument()` — there is no
> `@testing-library/jest-dom` in this repository (`package.json:47-48`).

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/unit/game/gameResultBanner.test.tsx`
Expected: FAIL — the banner has no `tied` prop.

- [ ] **Step 7: Teach the banner about a tie**

In `src/components/game/GameResultBanner.tsx`:

1. Add `readonly tied?: boolean;` and `readonly tieBreak?: string;` to the props
   (`src/components/game/types.ts:145-160`).
2. The headline currently reads "No winner" when `winnerId` is null
   (`src/components/game/GameResultBanner.tsx:48-54`). A tie is **not** "no winner" —
   it is a result. Change the headline to name the tie, and put the tie-break rule
   in the sub-line where the margin normally goes:

```tsx
<h2 data-result-headline className="font-display text-display text-ink">
  {tied ? "Tie" : winnerName ? (leg ? `${winnerName} takes leg ${leg.current}` : `${winnerName} wins`) : "No winner"}
</h2>
<p className="font-body text-body text-ink-muted">
  {tied
    ? (tieBreak ?? "The match ended level.")
    : `${margin === null ? "The match is over." : `Won by ${margin} points.`}${leg && set ? ` Leg ${leg.current}/${leg.total}, set ${set.current}/${set.total}.` : ""}`}
</p>
```

The `Trophy` icon stays — a tie is still a finished match, and the icon is
decorative (`aria-hidden`).

3. In `app/game/shanghai/page.tsx`, pass the result:

```tsx
<GameResultBanner
  winnerId={winnerId}
  tied={engine?.getResult()?.tied ?? false}
  tieBreak={engine?.getResult()?.tieBreak}
  ...
/>
```

The view reads the engine's derived result — it never computes one. The engine is the single
source of truth for "how did the match end".

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/game/gameResultBanner.test.tsx tests/unit/game-engine/modes/ShanghaiMode.test.ts`
Expected: PASS.

- [ ] **Step 9: Verify the whole suite and the gates**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run format:check`
Expected: all green.

---

### Task M6: The result screen can be undone from in every mode — and the wiring is added

> ### ⚠ Re-anchored — this task is **no longer test-only** in this tree
>
> The 2026-11-12 draft claimed: "**Verified on 2026-11-12: this already works.** … all four
> views already pass a `handleUndo` that returns the match to play." **That is not true of this
> tree.** Re-verified on 2026-11-15 against `d73c37f`:
>
> - The **prop** exists: `GameResultBannerProps.onUndo?: () => void`
>   (`src/components/game/types.ts:151-155`).
> - The **button** is rendered when the prop is passed
>   (`src/components/game/GameResultBanner.tsx:102-110`).
> - **Only the cricket view passes it**: `app/game/cricket/page.tsx:239`.
> - The **other three do not**: `app/game/around-the-clock/page.tsx:225-231`,
>   `app/game/shanghai/page.tsx:272-278` and `src/components/x01/X01MatchView.tsx:235-241` all
>   render `<GameResultBanner>` **without** an `onUndo` prop.
> - The 2026-11-12 reference `tests/unit/game/x01MatchView.test.tsx:246-270` **does not exist**
>   — that file is 188 lines in this tree and contains no "Undo last dart" assertion
>   (`grep -rn "Undo last dart" tests/ src/ app/ e2e/` → only the component's own JSX at
>   `src/components/game/GameResultBanner.tsx:108`).
>
> **Therefore M6 wires the three missing views and then pins all four with tests.** The
> pattern to follow is the existing per-mode undo suite
> `tests/unit/game/undoAcrossModes.test.tsx:63-80`, which drives all five pages.
>
> Full ruling set: `docs/superpowers/plans/2026-11-12-game-modes-preflight.md` (A8, B3/C1,
> B6/C2, C2, C3 and C4).

**Files:**

- Modify: `app/game/around-the-clock/page.tsx` (pass `onUndo={handleUndo}`)
- Modify: `app/game/shanghai/page.tsx` (pass `onUndo={handleUndo}`)
- Modify: `src/components/x01/X01MatchView.tsx` (pass `onUndo={handleUndo}`)
- Test: `tests/unit/game/modeViews.test.tsx`
- Test: `tests/unit/game/gameResultBanner.test.tsx`

**Interfaces:**

- Consumes: `GameResultBanner`, `history.undo()` from `useMatchHistory`.
- Produces: the `onUndo` prop is now **wired** in the around-the-clock, shanghai and x01 views.
  The banner component itself is **not** changed by this task.

- [ ] **Step 1: Write the failing banner test — the banner renders the undo action**

In `tests/unit/game/gameResultBanner.test.tsx`, add:

```tsx
it("renders the undo action when given one", () => {
  const onUndo = vi.fn();
  render(
    <GameResultBanner
      winnerId="alice"
      players={[{ id: "alice", totalPoints: 0 }]}
      playerNames={{ alice: "Alice" }}
      onPlayAgain={vi.fn()}
      onBackToHub={vi.fn()}
      onUndo={onUndo}
    />,
  );
  expect(screen.getByRole("button", { name: /undo last dart/i })).toBeTruthy();
});
```

> **Ruling B3/C1:** `expect(...).toBeTruthy()`, never `toBeInTheDocument()`.

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run tests/unit/game/gameResultBanner.test.tsx`
Expected: PASS — the banner already renders it. If it fails, the banner regressed and the
task becomes a fix, not a test.

- [ ] **Step 3: Wire the three missing views**

Each of the three views already has a `handleUndo` that returns the match to play
(`app/game/around-the-clock/page.tsx:114-123`, `app/game/shanghai/page.tsx:149-158`,
`src/components/x01/X01MatchView.tsx:201-210`). Each just has to hand it to the banner:

```tsx
<GameResultBanner
  ...
  onUndo={handleUndo}
/>
```

The cricket view already does this (`app/game/cricket/page.tsx:239`) and is the pattern.

- [ ] **Step 4: Write the failing view tests — undo returns each mode to play**

In `tests/unit/game/modeViews.test.tsx`, add one test per mode for the four views (cricket,
around the clock, shanghai, x01): play to a win, press "Undo last dart" on the
result banner, assert the match is back in play and the score is the pre-winning value.

Follow the existing pattern in `tests/unit/game/undoAcrossModes.test.tsx:63-80` (the
per-mode undo suite over the five pages) — the 2026-11-12 reference
`tests/unit/game/x01MatchView.test.tsx:246-270` **does not exist in this tree** and must not be
re-created. The mode-specific details the pattern needs:

| Mode     | How to win in the test                          | What to assert after the undo              |
| -------- | ----------------------------------------------- | ------------------------------------------ |
| Cricket  | Close all seven targets with three singles each | The sheet is back, the marks are one fewer |
| ATC      | Hit all 21 targets                              | The target is back to the last one         |
| Shanghai | Reach round 7                                   | The round is back to round 6               |

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/game/modeViews.test.tsx`
Expected: PASS. If a mode's undo does not return the match to play, fix that mode's
`handleUndo` — set `setPhase("playing")` and `setWinnerId(null)` — exactly as
`app/game/cricket/page.tsx:126-135` does.

- [ ] **Step 6: Verify the whole suite and the gates**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run format:check`
Expected: all green.

---

### Task M7: The design spec and the docs catch up with the shipped modes

**Files:**

- Modify: `design-system/darthub/pages/match.md`
- Modify: `.devflow/memory/CURRENT_STATE.md`
- **Blocked:** `docs/ROADMAP.md` — owned by a parallel task (the opencode-team-integration
  work). M7 does not edit it until that task settles. See Step 2.
- **Not touched:** `docs/DECISIONS.md` — checked explicitly, M7 does not need it.
- Test: none — this task is verified by reading, and by the suite staying green.

> **Rulings binding on this task: B10 (the engine README is M5's job, not M7's), C5, C6, C3.**
> See `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`.

**Interfaces:**

- Consumes: the state of the repository after Tasks M1–M6.
- Produces: documentation that matches the code. No code is touched.

- [ ] **Step 1: Update the match page spec**

In `design-system/darthub/pages/match.md` §3 (lines 82-84), the paragraph "**Undo is out of
scope for this plan.** The engine has no undo, so the button must not be rendered as a
live control until the engine supports it." is no longer true. Replace it with the
shipped behaviour:

```markdown
**Undo is live.** The engine owns the throw ledger and re-derives every value from it, so
the `UNDO` button in the Actions slot is a live `secondary` control from the first dart
onwards. It is `disabled` while the ledger is empty. Tapping a dart chip arms it as the
correction target; the pad then replaces that dart instead of adding one.
```

In §6 (rule 3, lines 151-156), the sentences "**The UI computes the bust itself** from
the out rule in force…" and "A bust **consumes no dart** and **ends no turn**, so the BUST
chip is UI-local visit state" are also no longer true — the bust is in the ledger
(`MatchState.throws`, `bust: true`) and the chip is read from the ledger. Replace the
rule with:

```markdown
3. **A bust is entered in the ledger and counted for nothing.** The engine records the dart
   with `bust: true` and rejects it with a `GameEngineBustError`; the score and the counters
   stay as they were. The BUST chip is read from the ledger, never from the error message
   and never from UI-local state.
```

And the paragraph below the rules (lines 162-164) — "**So the visit strip is assembled
from two sources:** the engine's returned state for the counted darts, and a small
UI-local record for the busted dart." — collapses to:

```markdown
**So the visit strip is assembled from the ledger alone:** the engine's returned state
carries the counted darts and the busted darts, and the strip reads both from it.
```

> **The engine README's `MatchState` block is M5's job, not M7's.** The 2026-11-12 draft left
> `src/game-engine/README.md:195-207` out of M7's scope even though M5 changes the shape it
> documents. Ruling **B10** assigns that update to **M5** (see M5's Files list). M7 must not
> duplicate it.

- [ ] **Step 2: Update the roadmap — BLOCKED until the parallel task settles**

> **`docs/ROADMAP.md` is owned by the parallel opencode-team-integration task.** It is being
> edited right now in another worktree. M7 must **not** schedule an edit of that file as if it
> were free.

When the parallel task has settled, the update is: the milestone list at
`docs/ROADMAP.md:45-48` and the delivery-status table at `:32-41`. Note that the 2026-11-12
draft cited "milestone M1's status line (line 115)" — **that line does not exist**: today's
`docs/ROADMAP.md` is 64 lines long. Add what this plan closed: the five local modes now
seat two players, and x01 offers best-of-N legs. Do not touch the realtime row — this
plan does not reach the socket path.

- [ ] **Step 3: Update the memory file**

In `.devflow/memory/CURRENT_STATE.md` (189 lines; the "Working functionality" section starts at
line 9), update that section to say that all five modes seat two players and that x01 offers
best-of-N legs. Update the "Measured quality baseline" table with the new test count.

- [ ] **Step 4: Run the whole suite and the gates one last time**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run format:check && npm run build`
Expected: all green, and the build succeeds.

- [ ] **Step 5: Report the result**

Report the final test count, the routes built, and the remaining known gaps. Do **not**
commit — the user approves commits separately.

---

## Self-Review

**Spec coverage.** The PRD's engine scope (`docs/PRD.md:55-65`) asks for leg and set flow
and tie-breaking throw order — Task M4 delivers the leg/set flow, Task M5 the tie. The
PRD's multiplayer scope (`docs/PRD.md:92-100`) asks for real matches — Tasks M1–M3 deliver
two-player Cricket, Around The Clock and Shanghai. The design system's match-page contract
(`design-system/darthub/pages/match.md`) is updated in Task M7 so the spec stops
contradicting the code. Every gap the plan closes is listed in the Review Focus section
with the task that pins it.

**Step scan.** Every step names one action and its checkable result. The engine
implementations in Tasks M2/M3/M5 carry code blocks because the data-shape change is the
whole point of the step; the view rewrites in Tasks M1/M2/M3/M6 name the exact prop
changes and the exact helper signatures, and leave the JSX to the implementer where the
existing file already shows the pattern.

**Type consistency.** `AroundTheClockModeData.currentTargetIndex` becomes
`Record<string, number>` in Task M2 and is read as such in Task M2 Step 7 and in
`app/game/around-the-clock/page.tsx`. `ShanghaiModeData` gains `dartsThisRound` and
`finishedRounds` in Task M3 and drops `totalDartsThisRound`; the view reads
`marksByRound` (a `Map<string, number[]>`) in Task M3 Step 7. **Task M5 does NOT add a
`MatchState.result` field** — it extends the existing `DartGameMode.resultSignature` seam
with a structured, JSON-safe `MatchResult` the engine derives and exposes through
`GameEngine.getResult()` (see M5's deviation note). `PlayerSetupOptions.legs`/`sets` are
introduced in Task M4 and read in `X01MatchView` in Task M4 Step 7;
`MatchFormatChoice` is introduced in Task M4 Step 5 and used in Task M4 Step 7.
`GameResultBannerProps.onUndo` already exists (`src/components/game/types.ts:151-155`) —
Task M6 **wires** it into the three views that lack it and adds tests; it does not add the
prop. `ShanghaiScoreSheetProps` loses `marksByRound: Record<string, number>` and gains
`players` (Task M3 Step 5); `currentRound` and `hit` stay.

**Verification.** Every factual claim in this plan about the **current** code was
checked by running the engine or reading the file — not inferred. The three claims
that were wrong on the first draft, and are now corrected:

- The Shanghai round advance was described as broken. It is not: the dart counter
  advances the round at the right moment for a fixed roster (verified). What is
  broken is that `roundRecords[player].marks` is never incremented and that the view's
  round table is derived from the raw ledger index, which puts both players' darts in
  one round. Task M3 was rewritten around those two defects.
- The undo-from-result affordance was described as missing in three modes. It is
  present in all four views (`GameResultBannerProps.onUndo` already exists). Task M6
  was rewritten as test-only. **→ Corrected again on 2026-11-15:** in this tree only the
  cricket view passes `onUndo` (`app/game/cricket/page.tsx:239`); the other three do not.
  Task M6 now **wires** them and then pins them.
- The x01 legs/sets engine support was described as missing. It works
  (`StandardMode.configure` reads `config.legs`; `LegSetManager` aggregates it).
  What is missing is the UI that lets a player choose it. Task M4 is now explicitly a
  UI task — plus the B9 seeding that makes the readout possible at all.

**Review Focus.** All seven lines are pinned: 1 → Task M1 Steps 1 and 9; 2 → Task M2 Steps 1
and 8; 3 → Task M3 Steps 1 and 3; 4 → Task M4 Steps 1 and 7; 5 → Task M5 Steps 1 and 8; 6 →
Task M6 Steps 1, 3 and 4; 7 → Tasks M1 Step 8, M2 Step 7, M3 Step 7.

**Proportion.** The plan is longer than a one-paragraph spec because the spec here is a
gap list, and each gap needs an engine shape, a prop shape, a UI shape and a test. The
code blocks are the mode data shapes and the prop signatures — the parts an implementer
cannot guess — and the JSX bodies are described, not transcribed, except where the exact
markup already exists in a file the implementer will read anyway.

---

## Re-anchoring log (2026-11-15)

Every `path:line` reference below was re-read in this tree and corrected. The list is here so
the next reader can see what moved without diffing against the 2026-11-12 branch.

### References that moved

| Was                                                     | Is now                                            | Why                                                                 |
| ------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `docs/PRD.md:55-66`                                     | `docs/PRD.md:55-65`                               | The engine-scope section ends at line 65.                           |
| `design-system/darthub/MASTER.md:660-675`               | `design-system/darthub/MASTER.md:661-672`         | The buttons section is 661-672; the one-`primary` rule is line 672. |
| `app/game/shanghai/page.tsx:56-66`                      | `app/game/shanghai/page.tsx:59-68`                | The `marksByRound` helper.                                          |
| `app/game/shanghai/page.tsx:126`                        | `app/game/shanghai/page.tsx:124`                  | `setWinnerId(playerId)` — "whoever threw last" wins.                |
| `app/game/shanghai/page.tsx:30-31`                      | `app/game/shanghai/page.tsx:33-35`                | `ROUND_TARGETS` (line 30 is `PLAYER_ID`).                           |
| `app/game/shanghai/page.tsx:253`                        | `app/game/shanghai/page.tsx:272-278`              | The result banner — and it has **no** `onUndo`.                     |
| `src/game-engine/modes/CricketMode.ts:104-118`          | `src/game-engine/modes/CricketMode.ts:105-119`    | `awardPointsIfScoring`.                                             |
| `src/game-engine/types.ts:162-165`                      | `src/game-engine/types.ts:164-167`                | `MatchConfig.legs` / `MatchConfig.sets`.                            |
| `src/game-engine/types.ts:190-203` (README)             | `src/game-engine/README.md:195-207`               | The `MatchState` code block.                                        |
| `src/components/game/types.ts:45-60`                    | `src/components/game/types.ts:128-143`            | `ScoreDisplayProps`.                                                |
| `src/components/game/types.ts:72`                       | `src/components/game/types.ts:151-155`            | `GameResultBannerProps.onUndo`.                                     |
| `src/components/game/types.ts:146-155`                  | `src/components/game/types.ts:263-272`            | `CricketScoreSheetProps`.                                           |
| `src/components/game/types.ts:157-162`                  | `src/components/game/types.ts:274-279`            | `AroundTheClockScoreSheetProps`.                                    |
| `src/components/game/types.ts:164-175`                  | `src/components/game/types.ts:281-292`            | `ShanghaiScoreSheetProps`.                                          |
| `src/components/x01/X01MatchView.tsx:56-57`             | `src/components/x01/X01MatchView.tsx:111-112`     | The `outRule` / `boardSource` state.                                |
| `src/components/x01/X01MatchView.tsx:70`                | `src/components/x01/X01MatchView.tsx:127`         | `playerIds` inside `startMatch`.                                    |
| `src/components/x01/X01MatchView.tsx:154-157`           | `src/components/x01/X01MatchView.tsx:212-215`     | `playAgain`.                                                        |
| `src/components/x01/X01MatchView.tsx:183`               | `src/components/x01/X01MatchView.tsx:235-241`     | The result banner — and it has **no** `onUndo`.                     |
| `app/game/cricket/page.tsx:128-137`                     | `app/game/cricket/page.tsx:126-135`               | `handleUndo`.                                                       |
| `app/game/cricket/page.tsx:212`                         | `app/game/cricket/page.tsx:239`                   | The `onUndo={handleUndo}` prop.                                     |
| `app/game/around-the-clock/page.tsx:203`                | `app/game/around-the-clock/page.tsx:225-231`      | The result banner — and it has **no** `onUndo`.                     |
| `tests/unit/game/cricketCorrection.test.tsx:1-40`       | `tests/unit/game/cricketCorrection.test.tsx:1-35` | The setup helpers end at line 35.                                   |
| `design-system/darthub/pages/match.md` §6 lines 152-157 | lines 151-156                                     | The bust rule.                                                      |

### References that were **obsolete** and are now stated as such

| Was                                                                 | Now                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/game/modeViews.test.tsx:290` (the "Target 1" assertion) | The file is **233 lines**; line 290 does not exist and "Target 1" is asserted nowhere in `tests/`. The literal lives in `e2e/game-center.spec.ts:162`; the unit assertions are `tests/unit/game/modeViews.test.tsx:131-132`. |
| `tests/unit/game/x01MatchView.test.tsx:246-270` (the undo pattern)  | The file is **188 lines** and contains no "Undo last dart" assertion. The pattern to follow is `tests/unit/game/undoAcrossModes.test.tsx:63-80`.                                                                             |
| `docs/ROADMAP.md` line 115 (M1's status line)                       | `docs/ROADMAP.md` is **64 lines**. The milestone list is at `:45-48`, the delivery-status table at `:32-41`. The file is also **owned by a parallel task** — M7's Step 2 is blocked until it settles.                        |

### References that were already correct and were kept

`docs/PRD.md:92-100` · `design-system/darthub/MASTER.md:672` ·
`design-system/darthub/pages/match.md:82-84` and `:162-164` ·
`.claude/plans/darthub-design-implementation/_plan.md:139-140` ·
`src/components/game/ScoreDisplay.tsx:29-38` ·
`src/components/game/GameResultBanner.tsx:48-54` and `:102-110` ·
`src/game-engine/modes/ShanghaiMode.ts:18-26` · `tests/unit/game/modeViews.test.tsx:107` ·
`src/game-engine/types.ts:213` · `src/game-engine/GameEngine.ts:358-364` ·
`src/game-engine/modes/StandardMode.ts:89-93` and `:149` ·
`src/game-engine/modes/registry.ts:168` · `package.json:47-48`.

### Substantive changes, not just moved lines

1. **M2's completion rule is rejected** (ruling B4): "every player must finish" contradicts the
   mode's own documented rule and makes a two-player match un-endable.
2. **M5 no longer adds a `MatchState.result` field** (ruling B10): it extends the existing
   `resultSignature` seam instead. See M5's deviation note.
3. **M6 is no longer test-only**: three of the four views do not pass `onUndo` to the result
   banner in this tree.
4. **M4 needs the B9 seeding** and the sizes must reach the view, not just the seeded slice.
5. **M7's `docs/ROADMAP.md` edit is blocked** by the parallel opencode-team-integration task.

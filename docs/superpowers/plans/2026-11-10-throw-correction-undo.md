# Throw Correction & Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution is **native and sequential in one session** per the governing spec (§2, §9): no parallel subagents, no commits.

**Goal:** Let a player undo the last entered dart and tap any entered dart to correct it, with score, remaining, checkout, bust state, turn order, mode data and the whole match state recalculated correctly for every game mode — in the local single-device match views.

**Architecture:** The engine already owns a throw ledger (`MatchState.throws` + `corrections`) and re-derives all state by replaying the ledger through the mode's own `applyThrow` (`src/game-engine/GameEngine.ts` — `undoLastThrow`, `correctThrow`, `getVisits`, private `replay`). That backend is verified present and is **not rewritten**. This plan (1) locks the existing engine behaviour with the 14 spec test cases, (2) adds one shared hook (`useMatchHistory`) and one presentational strip (`ThrowHistoryControls`), and (3) wires the four match views to them, deleting each view's private `visit`/`visits` bookkeeping so the engine ledger is the only record of darts.

**Tech Stack:** TypeScript strict, React (Next.js app router), Vitest, existing design-system tokens in `src/components/game/classes.ts`.

**Spec:** The governing spec is the "AUTONOMOUS NIGHT RUN – DARTHUB FEATURE COMPLETION" brief (supplied 2026-11-10). The pre-existing DevFlow plan `.claude/plans/throw-correction-undo/_plan.md` documents the engine design already implemented (tasks 001–002 done; 003–008 are what this plan executes).

## Global Constraints

- **No commits, ever.** The spec forbids them; every task ends with verification, not a commit.
- No new runtime dependencies. No shadcn/ui additions, no modal library — confirmation is a two-stage inline control.
- TypeScript strict; `npm run lint`, `npm run typecheck`, `npm run format:check` must be clean at the end.
- Reuse the existing design-system vocabulary: `classes.ts` tokens, `visitBadge`/`VISIT_*_CLASS` from `VisitChips.tsx`, lucide icons. No parallel component language.
- Do not touch: global Claude settings, provider config, `src/realtime/socketServer.ts` handlers (realtime undo is out of scope — no client consumes it; the engine API is designed so a future handler is a thin wrapper; this is documented in the final report), or unrelated project areas.
- Never remove or disable an existing test to get green. A failing test is debugged at its root cause (superpowers:systematic-debugging).
- Preserve all existing uncommitted work; edit in place.
- Realtime/multiplayer correctness is guaranteed at engine level (player attribution read from the recorded dart, event order = ledger order) and pinned by 2-player engine tests. Socket-level events are explicitly out of scope.
- Environment honesty: if PostgreSQL or Playwright cannot run here, document it in the final report. Never claim a test ran that did not.

## Review Focus

Failure modes the spec implies but whose tests live in specific tasks (each line is pinned there):

1. **Correcting a cricket dart changes another player's marks** — cricket scores against opponents' marks; the corrected score must be the replay, not a subtraction. Pinned in Task 2 (`CricketMode` test).
2. **Correcting an early dart makes a _later_ dart bust** — correction must be _refused_, leaving state and ledger bit-identical. Pinned in Task 1 (refusal deep-equal test).
3. **Undoing a busting dart** — the bust consumed no dart slot, so undo must not corrupt `throwsInCurrentTurn`/turn order. Pinned in Task 1 (bust-undo test).
4. **Correction/undo of the match-winning dart** — undo must return a completed match to `inProgress` with full pre-dart state; `correctThrow` on a completed match is refused. Pinned in Task 1 (completed-match tests) and Task 5 (result-phase undo button).
5. **A correction silently double-books a dart** — correction replaces one ledger entry (length unchanged); the corrected value must not be added on top. Pinned in Task 1 (no-double-booking test).

---

### Task 1: Engine core tests — undo, correct, refusal, multiplayer

**Files:**

- Create: `tests/unit/game-engine/UndoCorrect.test.ts`

**Interfaces:**

- Consumes: existing `GameEngine` (`startMatch`, `recordThrow`, `undoLastThrow`, `correctThrow`, `getState`, `getVisits`), `NeutralScoreMode`, `StandardMode`, error classes from `@/game-engine/types`.
- Produces: none (test-only task). Green here proves the existing engine satisfies spec Phase E cases 1, 2, 3, 4, 5 (undo half), 7, 8, 13, 14 and Review Focus 2/3/5. A _failing_ test is a real engine bug — fix the engine at the root cause, not the test.

- [ ] **Step 1: Write the tests**

Create `tests/unit/game-engine/UndoCorrect.test.ts` with these cases (values exact; use `expect(after).toEqual(before)` deep-equality for state comparisons, comparing `getState()` snapshots):

```ts
// describe("GameEngine undo & correct")

// 1. undo of last dart: startMatch(2 players, Neutral), record A(20), B(40),
//    A(30) → snapshot S3; undoLastThrow() → toEqual(S2-state-before-3rd-throw)
//    (capture state after each recordThrow).
// 2. correct replaces, not adds: A(20), B(40) → correctThrow(1, {points: 18})
//    → equals the state of a fresh engine where B threw 18 first (equivalence
//    with a re-played ledger). Also: state.throws.length === 2 unchanged.
// 3. consecutive corrections: correctThrow(0,…), then correctThrow(0,…) again;
//    second equals a fresh replay with the final value; corrections audit has 2
//    entries only if the darts were outside the in-progress turn (here: none,
//    since all darts sit in the current turn — assert accordingly).
// 4. correcting a bust (StandardMode, startScore 501, outRule "double"):
//    record a busting dart (e.g. 170 with remaining 50 → bust recorded in
//    ledger with bust:true, engine throws GameEngineStateError); then
//    correctThrow(lastIndex, {points: 50, segment: "double"}) → counted, score
//    0, match completed; the corrected entry has bust:false.
// 5. completed match: after winning, undoLastThrow() → status "inProgress",
//    winner's totalPoints back to startScore, currentPlayerId back to winner;
//    correctThrow(anyIndex,…) on a completed match → throws GameEngineStateError,
//    state deep-equal before/after.
// 6. refused corrections (StandardMode): (a) index out of range; (b) replacement
//    that busts the corrected dart; (c) two players, A(20) B(40) then correct
//    dart 0 to a value that makes dart 1 bust (e.g. values chosen so B's dart
//    exceeds B's remaining) → each throws GameEngineStateError AND
//    getState() after === toEqual(getState()) before, throws.length unchanged,
//    corrections array unchanged.
// 7. no player movement: 2 players, A(20) B(40) A(30); correctThrow(0,…) →
//    throws[0].playerId still A; B's darts untouched; turn order re-derived
//    correctly (currentPlayerId as in the replayed ledger).
// 8. bust + undo interplay: StandardMode, record one counted dart then a bust
//    (bust consumes no slot, throwsInCurrentTurn stays 1); undoLastThrow()
//    removes the bust → throwsInCurrentTurn still 1, turn of same player;
//    undo again → back to zero.
// 9. getVisits: for a ledger with a bust mid-turn, groupVisits output has the
//    bust in its own visit and the next dart opens a fresh one; lengths sum
//    to throws.length.
// 10. no double booking: after a sequence of records + corrections, every
//     player's totalPoints equals the sum replayed from throws (independent
//     check, not reading engine internals).
// 11. multiplayer ordering: 3 players, 4 darts alternating; undo last →
//     currentPlayerId is the player who threw dart 4; correctThrow on dart 1
//     does not reorder throws (indexes stable, players intact).
```

- [ ] **Step 2: Run and triage**

Run: `npx vitest run tests/unit/game-engine/UndoCorrect.test.ts`
Expected: PASS. Any failure = real engine defect: diagnose at root cause (read the failing assertion, reproduce minimally, fix engine), re-run until green. Do not weaken a test.

- [ ] **Step 3: Regression check**

Run: `npx vitest run tests/unit/game-engine`
Expected: all engine tests pass (existing `GameEngine.test.ts`, mode tests, validation tests).

---

### Task 2: Engine tests — undo/correct across Cricket, Around-The-Clock, Shanghai, leg replay

**Files:**

- Create: `tests/unit/game-engine/modes/CorrectionReplay.test.ts`

**Interfaces:**

- Consumes: `CricketMode`, `AroundTheClockMode`, `ShanghaiMode`, `StandardMode` (constructor/config shapes as used by `app/game/*/page.tsx`), `GameEngine`, `GameEngineStateError`.
- Produces: none (test-only). Pins spec Phase E cases 6, 9, 10, 11 and Review Focus 1/4.

- [ ] **Step 1: Write the tests**

```ts
// describe("correction replay across modes")

// 1. Double-out survives replay (spec case 6): StandardMode({startScore: 501}),
//    startMatch({outRule: "double"}). Play a leg to completion (win on a double),
//    then record 1 dart in leg 2; correctThrow that dart → modeData.legSet
//    progress identical to before, out rule still "double" (a leg win resets
//    scores to startScore — assert winner back at 501 after the leg).
// 2. Leg-winning correction is audited: same match; correctThrow the winning
//    dart to a non-winning value (match no longer complete) → corrections
//    audit gains an entry naming dartIndex/playerId/old/new values.
// 3. Cricket (case 9, Review Focus 1): 2 players, both open marks. Player A
//    hits a target where A has 2 marks (closed) and B has 1 → A scores.
//    correctThrow A's dart to a different target → A's score reverts and, if
//    the new target scores, B's mark situation is re-derived from replay
//    (assert exact marks object from modeData, both players).
// 4. Around the clock (case 10): 2 players advance currentTargetIndex via hits;
//    correctThrow an earlier hitting dart to a miss → currentTargetIndex
//    re-derived backwards exactly; correct it back → index returns.
// 5. Shanghai (case 11): fill one round (players*3 darts), round advances;
//    correctThrow a dart of the *previous* round → roundRecords of that round
//    re-derived, round counter unchanged, corrections audit gains an entry
//    (finished-visit correction, spec case 12).
```

- [ ] **Step 2: Run and triage**

Run: `npx vitest run tests/unit/game-engine/modes/CorrectionReplay.test.ts`
Expected: PASS; failures debugged at root cause as in Task 1.

- [ ] **Step 3: Full engine suite**

Run: `npx vitest run tests/unit/game-engine`
Expected: green.

---

### Task 3: `useMatchHistory` — the shared view-level hook

**Files:**

- Create: `src/components/game/useMatchHistory.ts`
- Test: `tests/unit/game/useMatchHistory.test.ts`

**Interfaces:**

- Consumes: `GameEngine` instance owned by the calling view (`engine: GameEngine | null`, `matchState: MatchState | null`), `deriveVisitIndexes` from `@/game-engine/throwLedger` (via `src/game-engine/index.ts` — verify export; add re-export if missing), `DARTS_PER_TURN` from `GameEngine`.
- Produces (exact contract used by Task 5):

```ts
export function useMatchHistory(options: {
  engine: GameEngine | null;
  matchState: MatchState | null;
}): {
  /** Darts of the visit in progress (the last ledger group), oldest first. */
  currentVisit: readonly RecordedThrow[];
  /** True when there is at least one dart in the ledger. */
  canUndo: boolean;
  /** The dart index armed as correction target, or null. */
  correctionTarget: number | null;
  /** Armed target sits in a finished visit and needs explicit confirmation. */
  awaitingConfirmation: boolean;
  /** Arms a dart as correction target (confirmation stage for finished visits). */
  selectThrow(dartIndex: number): void;
  /** Confirms a finished-visit correction, arming the target. */
  confirmCorrection(): void;
  /** Cancels the correction flow, changing nothing. */
  cancelCorrection(): void;
  /** Armed target → engine.correctThrow; otherwise engine.recordThrow.
   *  Refusals re-throw; the armed target STAYS armed on refusal. */
  submitThrow(input: { points: number; segment?: ThrowSegment }): void;
  /** Removes the last entered dart (also on a completed match); clears any
   *  armed correction first. */
  undo(): void;
};
```

- [ ] **Step 1: Write the failing test**

`tests/unit/game/useMatchHistory.test.ts` using `renderHook` from `@testing-library/react` and a real `new GameEngine(new NeutralScoreMode())` (check an existing component test for the exact renderHook setup; match its style). Cases:

```ts
// 1. submitThrow with no armed target records a dart; with an armed target it
//    corrects (state equals the corrected replay; throws.length unchanged).
// 2. selectThrow on a dart in the current visit → correctionTarget set,
//    awaitingConfirmation false.
// 3. selectThrow on a dart in a finished visit (2+ visits via a completed turn)
//    → awaitingConfirmation true, target NOT yet armed; confirmCorrection()
//    arms it; cancelCorrection() disarms, state untouched.
// 4. submitThrow refusal (e.g. out-of-turn input → engine throws) → error
//    propagates to caller, correctionTarget still armed, state unchanged.
// 5. undo with an armed correction → correction cleared AND last dart removed.
// 6. canUndo tracks throws.length > 0; currentVisit is the last ledger group
//    (after a bust mid-turn: the group after the bust).
// 7. null engine / null matchState → all actions no-op safely, canUndo false.
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/game/useMatchHistory.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

`useState` for `correctionTarget` + `awaitingConfirmation`; `useCallback` for each action. "Finished visit" check: a dart's visit index (via `deriveVisitIndexes(matchState.throws, DARTS_PER_TURN)`) `< max visit index`. All engine calls inside `if (!engine || !matchState) return`. No other logic — the engine owns every rule.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/game/useMatchHistory.test.ts`
Expected: PASS.

---

### Task 4: `ThrowHistoryControls` — tappable darts, undo button, confirm stage

**Files:**

- Create: `src/components/game/ThrowHistoryControls.tsx`
- Test: `tests/unit/game/ThrowHistoryControls.test.tsx`

**Interfaces:**

- Consumes: `visitBadge`, `VISIT_COUNTED_CLASS`, `VISIT_BUST_CLASS` from `./VisitChips` (widen `visitBadge`'s parameter to `{ points: number; segment?: ThrowSegment; bust?: boolean }` so `RecordedThrow` satisfies it — edit `VisitChips.tsx:16`), `SECONDARY_BUTTON` from `./classes`.
- Produces:

```tsx
export function ThrowHistoryControls(props: {
  throws: readonly RecordedThrow[];
  correctionTarget: number | null;
  awaitingConfirmation: boolean;
  canUndo: boolean;
  onSelectThrow: (dartIndex: number) => void;
  onUndo: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element;
```

Behaviour: each dart renders as a **button** (keeps chip visuals; `data-visit` attribute as today; armed dart gets a distinct highlight class from `classes.ts`; `aria-pressed` on the armed dart; touch target ≥ 44×44 CSS px via existing padding tokens). Undo button labelled `Undo` (`aria-disabled`/disabled when `!canUndo`), placed after the chips. When `awaitingConfirmation`: inline two-stage prompt "Finished visit — correct?" with `Confirm`/`Cancel` buttons. When armed and not awaiting: hint line "Correcting {badge} — enter the new value" plus a `Cancel` button. No modals.

- [ ] **Step 1: Write the failing test**

`@testing-library/react` (match existing UI tests' setup):

```ts
// 1. renders one button per dart with the visitBadge label; bust dart shows BUST.
// 2. tapping dart i calls onSelectThrow(i); armed dart has aria-pressed="true".
// 3. undo button disabled when canUndo=false, enabled + calls onUndo otherwise.
// 4. awaitingConfirmation shows Confirm/Cancel → onConfirm/onCancel called.
// 5. armed target shows the "Correcting …" hint and Cancel button.
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/game/ThrowHistoryControls.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Presentational only: no engine, no state — props in, events out. Reuse chip classes verbatim.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/game/ThrowHistoryControls.test.tsx`
Expected: PASS.

---

### Task 5: Wire the four match views; delete per-view visit bookkeeping

**Files:**

- Modify: `src/components/x01/X01MatchView.tsx` (delete `visits`/`visitOwner` state, `isBustThrow` local bust detection, the bust `catch` branch's chip bookkeeping)
- Modify: `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx` (delete `visit` state)
- Modify: `src/components/game/VisitChips.tsx` (widen `visitBadge` param; keep `VisitChips` for any remaining consumer)
- Modify: `src/components/game/types.ts` (drop `VisitEntry` once unreferenced; `ScoreDisplayProps.throwHistory` → `ReadonlyArray<RecordedThrow>`)
- Modify: `src/components/game/ScoreDisplay.tsx` (accept `RecordedThrow[]` in `throwHistory`)
- Modify: `src/components/game/GameResultBanner.tsx` (optional `onUndo?: () => void` → renders an `Undo last dart` button when provided)
- Test: `tests/unit/game/cricketCorrection.test.tsx` (new integration test); update any existing test referencing `VisitEntry`

**Interfaces:**

- Consumes: `useMatchHistory` (Task 3), `ThrowHistoryControls` (Task 4), `engine.getVisits()` for the "last group = visit in progress" — actually use `history.currentVisit` from the hook instead; `RecordedThrow` from `@/game-engine/types`.
- Produces: the four views where the pad, board, strip and score sheet all read one ledger. Pinned by the cricket integration test.

- [ ] **Step 1: Write the failing integration test**

`tests/unit/game/cricketCorrection.test.tsx`: render `<CricketPage />` (import from `app/game/cricket/page`), start a match via `PlayerSetup`, throw darts via the `ThrowInputPad` buttons (query by accessible name — check `ThrowInputPad` markup for the button names), then:

```ts
// 1. throw a scoring dart → marks sheet updates; strip shows the dart chip.
// 2. tap that chip → hint "Correcting …" appears; enter the replacement value
//    via the pad → marks equal the corrected replay (exact marks object),
//    no second dart appended (strip still shows one dart for the visit).
// 3. press Undo → marks revert to pre-throw values; strip empty for the visit.
// 4. undo again on empty ledger → no crash, message shown.
// 5. match over: win condition reached → result banner shows "Undo last dart";
//    pressing it returns to the playing layout with the winning dart removed.
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/game/cricketCorrection.test.tsx`
Expected: FAIL (no correction affordance in the view yet).

- [ ] **Step 3: Wire the four views**

Pattern (identical in each view; the differences are only the score sheet and the message text):

```tsx
const history = useMatchHistory({ engine, matchState });

// recordThrow: try { history.submitThrow(input); /* message from new state */ }
// catch (error) { setMessage(...) }   // refusals surface as messages

// MatchLayout visit prop:
visit={
  <ThrowHistoryControls
    throws={history.currentVisit}
    correctionTarget={history.correctionTarget}
    awaitingConfirmation={history.awaitingConfirmation}
    canUndo={history.canUndo}
    onSelectThrow={history.selectThrow}
    onUndo={() => { history.undo(); setPhase("playing"); }}
    onConfirm={history.confirmCorrection}
    onCancel={history.cancelCorrection}
  />
}

// result phase: <GameResultBanner … onUndo={() => { history.undo(); setPhase("playing"); }} />
```

View-specific notes:

- **X01MatchView**: the bust `catch` branch becomes just `setAnnouncement(...)` — the bust chip now comes from the ledger. Announcement for a recorded dart uses the returned state (`remainingAfter` still computable from `state.players`). `ScoreDisplay` gets `throwHistory={history.currentVisit}`. If `isBustThrow` is referenced nowhere else (grep `isBustThrow`), delete it and its export; if a test imports it, keep the function but drop the view's usage.
- **cricket / around-the-clock / shanghai**: same pattern; keep each view's existing message logic (`marksGained` etc.) but compute it from the returned state, not from a parallel `visit` array.
- Miss handling stays: `{ points: 0 }` carries no segment (engine rejects it) — unchanged.

- [ ] **Step 4: Run the view tests**

Run: `npx vitest run tests/unit/game tests/unit/game-center tests/unit/ui`
Expected: PASS. Fix fallout at root cause (e.g. `gameCenterPage`/`modeRegistry` fixtures referencing `VisitEntry`).

- [ ] **Step 5: Design-system check**

Run: `npx vitest run tests/integration/ui-skeletons.test.tsx`
Expected: PASS — the new controls must not break the responsive skeleton assertions (1440/1024/390 widths).

---

### Task 6: Docs, final verification, report

**Files:**

- Modify: `src/game-engine/README.md` (document the ledger, `undoLastThrow`, `correctThrow`, `getVisits`, refusal rules, audit trail — replacing the thin current note)
- Modify: `.claude/plans/throw-correction-undo/_plan.md` (mark tasks 003–008 status `done`, note execution via this plan)

**Interfaces:**

- Consumes: everything above.
- Produces: the final session report (chat, structured per spec Phase F: what was implemented, files changed, tests passed, tests not run and why, open problems, decisions, next steps).

- [ ] **Step 1: Update the engine README**

Section per operation with the refusal rules verbatim: index out of range; completed match; corrected dart would bust; a later dart would newly bust. Note undo is allowed on completed matches; corrections are refused there. Note the audit trail conditions (finished visit, or changed match result).

- [ ] **Step 2: Full quality gate (each run once, reuse results)**

```bash
npm run lint
npm run typecheck
npm run format:check
npx vitest run                      # full unit + integration
npm run build                       # production build
```

Expected: all clean. Playwright: run only if the environment supports a browser + (for DB-backed flows) PostgreSQL; otherwise record "not run: <reason>" in the report. Failing items → root-cause fix, re-run only the failing slice.

- [ ] **Step 3: Mark the DevFlow plan done and write the final report**

Update `_plan.md` statuses. Report in chat per Phase F. No commit.

---

## Self-Review Notes

- **Spec coverage:** Phase A → executed above (this plan is its output). Phase B undo/correct → Tasks 1–2 (engine, incl. refusal rules, multiplayer attribution, finished visits). Phase C UI → Tasks 3–5 (undo button, visual feedback, replace flow, finished-visit protection, touch targets, responsive via `ui-skeletons`). Phase D adjacent issues → Task 5 deletes the double state management (view `visits` vs engine ledger) and the x01 duplicate bust record; other listed issues (loading states, player-switch bugs) are only fixed if Task 5/6 verification reproduces them — no speculative refactors. Phase E → Tasks 1–2 (all 14 cases: 1,2,3,4,5,7,8,13,14 in Task 1; 6,9,10,11,12 in Task 2) + Task 5 (UI integration) + Task 6 (lint/typecheck/format/build). Phase F → Task 6.
- **Multiplayer/sync:** engine-level guarantees pinned by Task 1 tests 7/11; socket handlers deliberately out of scope (no client) and documented — consistent with the pre-existing plan's scope decision.
- **Type consistency:** `useMatchHistory`'s returned names (`currentVisit`, `correctionTarget`, `awaitingConfirmation`, `selectThrow`, `confirmCorrection`, `cancelCorrection`, `submitThrow`, `undo`, `canUndo`) are used identically in Tasks 4 and 5. `visitBadge` parameter widening (Task 4) is consumed by Task 5's type changes.

# Task 005: Wire segment-aware throws and fix Double Out in the x01 match views

**Status**: completed
**Depends on**: 002, 003, 007

**Files this task owns:** `app/game/page.tsx`, `app/game/301/page.tsx`, `src/game-engine/modes/StandardMode.ts` (the two x01 wrappers' `outRule` default only), `tests/unit/game-engine/modes/StandardMode.test.ts` (the additions described below). **Files this task does not touch:** `src/components/game/**` (task 007), `src/components/board/**` (task 003), `src/game-engine/rules/**` (the rules are untouched).
**Retry count**: 0

## Description
Make the board the input to the match, and fix the defect that makes the advertised checkout rule unwinnable. A click on the board produces a `{ segment, points }` pair that reaches the engine, and Double Out becomes a rule that can actually be won — and lost.

## Context
### Read first
- `design-system/darthub/board.md` — §6 (interaction), §7 (the board in the match layout), §8.6 (source modes in the match header), §9 (the checkout decision).
- `DESIGN.md` §8.3, §8.5 — the match view and the score sheet.

### The verified defect
- `src/game-engine/rules/OutRules.ts:61` — `DoubleOutRule.isCheckout` requires `segment === "double"`.
- `src/game-engine/types.ts:31,92` — `ThrowInput`/`ThrowRecord` carry an optional `segment` that the UI **never sends**: `app/game/page.tsx` calls `engine.recordThrow({ playerId, points })` with points only.
- `app/game/page.tsx:29` — `new StandardMode({ startScore: START_SCORE })`; `:31` — `eng.startMatch({ playerIds: ids })`. **No `outRule` is ever passed**, so the mode falls back to `"straight"`.

So **Double Out is unwinnable through the current interface**, and the Game Center copy advertising *"finish on a double"* is false.

### The fix has two halves — both are required
1. **The mode's default.** `Standard501Mode` and `Standard301Mode` are constructed with `outRule: "double"`, so the advertised rule is the default rule. (`StandardMode`'s own default stays `"straight"` — changing that would alter the engine's behaviour for other callers.)
2. **The configuration path.** The setup surface passes the player's chosen rule through `MatchConfig.outRule` to `eng.startMatch({ playerIds, outRule })`.

The player chooses the checkout rule at match start: **Double out, Master out or Straight out**, with Double out the default for 501 and 301.

**Half 1 is a change to `src/game-engine/modes/StandardMode.ts`**, so it is *configuration*, not a rule change: the `OutRule` implementations in `src/game-engine/rules/OutRules.ts` are untouched, `LegSetManager` is untouched, and no scoring arithmetic changes.

**One consequence to expect, not to fight:** `StandardMode` derives its `id` from the out rule (`src/game-engine/modes/StandardMode.ts:59`), so `Standard501Mode`'s id becomes `x01-501-double-out` instead of `x01-501`. That is the existing suffix mechanism doing its job.

### The existing engine test — read this before touching `StandardMode.ts`
`tests/unit/game-engine/modes/StandardMode.test.ts` is the engine's contract for the x01 modes. It asserts straight-out behaviour, and **half 1 will break it**. Specifically:

- `it starts a match at 501 and allows scoring down to zero` — finishes on `points: 1` with **no segment**. Under double out, `isCheckout(undefined, 1)` is false (`src/game-engine/rules/OutRules.ts:61` requires `segment === "double"`), so the throw becomes a bust.
- `it starts a match at 301 and behaves identically with a lower start score` — same shape, same failure.

**These assertions must be updated, and only these.** The update is to make the test exercise the rule it is about, explicitly:

- The 501 and 301 cases construct `new StandardMode({ startScore: 501 })` / `{ startScore: 301 }` — **`StandardMode`, not the wrappers** — so they keep testing the plain-mode behaviour the test has always tested, unchanged, and they stay green without any edit.
- Add **new** cases asserting the wrappers' new default: `new Standard501Mode()` finishes on a double and does **not** finish on a non-double.

Do not edit the mode's scoring, do not delete assertions, and do not weaken the test to "it does not throw". The old test's *content* — that `StandardMode` allows scoring down to zero — remains exactly as it is.

### What must not change
**The game rules and the scoring behaviour do not change.** Do not modify `src/game-engine/rules/OutRules.ts`, `LegSetManager`, or any mode's scoring. This task changes what the **UI sends** and what the **UI shows** — and the mode defaults that make the advertised rule true.

### Files
- `app/game/page.tsx` and `app/game/301/page.tsx` — the x01 match views: the board, the score sheet, the throw pipeline, the checkout selector.
- `src/components/game/` — the shared components are rebuilt in task 007; this task may use them but must not duplicate them.
- `src/components/board/DartBoard.tsx` — from task 003.

### The throw pipeline
- A board click resolves to `{ segment, points }` and is submitted as `engine.recordThrow({ playerId, points, segment })`.
- The dart pad (the numeric input) must also send a **segment**, so a player using the pad can win a Double Out. A pad key for `16` must be able to say "that was a double 16" — the design specifies an **armed band** (`1×` / `2×` / `3×`) followed by the number. Without this, the pad is a second unwinnable path.
- The throw history records the segment, so the score sheet can label each visit (`T20`, `D16`, `S7`).
- A miss (0 points) is a legal throw, not an error.
- The engine's own validation still applies: an invalid segment/points pair is rejected by the engine, not silently accepted by the UI.

### A bust is a thrown error, not a returned state — the UI must know this
This is the single most important interface detail of this task, and the plan previously left it implicit.

`StandardMode.applyThrow` throws `GameEngineStateError("Bust: …")` when a throw busts (`src/game-engine/modes/StandardMode.ts:104`), and `GameEngine.recordThrow` propagates it. **A bust never reaches the UI as a state.** The engine's own README says it: *"Busts are rejected outright (`GameEngineStateError`) and leave the match state untouched."*

Three consequences the score sheet depends on:

1. **The UI computes the bust itself.** After the throw, the UI knows the out rule in force and the player's remaining score before the dart, so it can determine that the dart busted. It must not infer a bust from the absence of a state change, and it must not string-match the error message to tell a bust apart from "not your turn" — both are `GameEngineStateError`.
2. **A bust does not consume a dart.** The engine leaves `throwsInCurrentTurn` and the score untouched, so the busted dart is not in the returned state and the "darts this turn" counter does not advance. The BUST chip is therefore **UI-local state** for the current visit, not engine state.
3. **A bust does not end the turn.** The engine keeps the same current player. The UI's turn indicator must follow the engine's `currentPlayerId`, not the UI's own notion of whose turn it is.

So the visit strip is assembled from two sources: the engine's returned state for counted darts, and a small UI-local record for the busted dart. Both are needed for the "green = counted, red = bust" chips the design specifies.

**Do not change the engine's bust handling.** It is existing, tested behaviour (`tests/unit/game-engine/rules/OutRules.test.ts` and the 038 plan's acceptance criteria) and it is outside this plan's boundary.

### The match layout
Per `board.md` §7 and the reference division of attention: **the board on one side, the player score sheet on the other, the throw strip along the top.** The score sheet shows each player's remaining score in tabular figures, the visit chips (green = counted, red = bust), the turn indicator (brass), leg/set progress, and the checkout rule in force. The board shows the last dart's impact.

Below 768 px the board is a **read-only preview** and the dart pad is the input.

### The board source in the match header
The source chosen at setup (Virtual / Camera / Smart Dart) is shown in the match header. Only Virtual Board is implemented; the other two are presented as unavailable with a visible reason.

## Requirements (Test Descriptions)
- [x] `it submits the segment with every throw`
- [x] `it lets a double finish the leg under the double out rule`
- [x] `it rejects a non-double finish under the double out rule`
- [x] `it lets a double finish the leg when the dart pad is used`
- [x] `it passes the chosen checkout rule to the match configuration`
- [x] `it defaults 501 and 301 to double out`
- [x] `it records a miss as a legal throw`
- [x] `it shows the resolved segment in the throw history`
- [x] `it shows a bust chip when a throw busts and leaves the score unchanged`
- [x] `it shows the board source in the match header`
- [x] `it renders inside the shell's main landmark`

## Acceptance Criteria
- **Double Out is winnable and losable.** A test asserts a double finishes the leg under `"double"`, and that a single of the same value does not.
- The dart pad can express a double, so the accessible path is not a second dead end.
- `MatchConfig.outRule` carries the player's choice; `Standard501Mode`/`Standard301Mode` default to `"double"`.
- **The engine's rules are untouched.** `git diff src/game-engine/rules/` is **empty** — `OutRules.ts` and `LegSetManager` are unchanged. Under `src/game-engine/modes/`, the only change is the two x01 wrappers' `outRule` default. `git diff src/game-engine/modes/` shows no change to any scoring path, and no change to `StandardMode`'s own `"straight"` default.
- `tests/unit/game-engine/modes/StandardMode.test.ts` is updated as described above: the two straight-out cases construct `StandardMode` explicitly and keep their existing assertions; new cases cover the wrappers' double-out default.
- The x01 match views render the board, the score sheet and the throw strip in the specified layout, and they render **inside the shell's `<main>`** — no page-level `<main>`.
- The score sheet's BUST chip is driven by the UI's own bust determination, not by string-matching the engine's error message.
- `npm run typecheck`, `npm run lint` and `npm run test` stay green (no new failures).

## Implementation Notes

### What changed
- **`src/game-engine/modes/StandardMode.ts`** — the only engine change: `Standard501Mode` and `Standard301Mode` now pass `outRule: "double"` to `super(...)`. `StandardMode`'s own default stays `"straight"`, and no scoring path is touched. The wrappers' ids become `x01-501-double-out` / `x01-301-double-out` through the existing suffix mechanism, which is what the Game Center copy reads.
- **`src/components/x01/X01MatchView.tsx`** (new) — the shared x01 match view, used by both pages. It lives outside `src/components/game/**` (task 007) and `src/components/board/**` (task 003), so it collides with neither.
- **`app/game/page.tsx`** and **`app/game/301/page.tsx`** — thin pages: `"use client"`, a doc comment, and `<X01MatchView startScore={501|301} modeName="501|301" />`. No page-level `<main>`; the shell owns the landmark.
- **`tests/unit/game-engine/modes/StandardMode.test.ts`** — the two straight-out cases now construct `new StandardMode({ startScore: 501 })` / `{ startScore: 301 }` explicitly, with their assertions unchanged; three new cases cover the double-out behaviour.
- **`tests/unit/game/x01MatchView.test.tsx`** (new, jsdom) — the eight UI requirements.
- **`e2e/game-center.spec.ts`** — the 501 journey now asserts the visit list (`S20`) instead of the old `#1` throw-history row.
- **`tests/unit/tailwind/designTokens.test.ts`** — the two x01 pages left the `pendingMigration` allow-list; they use semantic tokens only.
- **`src/game-engine/README.md`** — documents that `StandardMode`'s own default is `"straight"` while the two wrappers default to `"double"`.

### The throw pipeline
- A board click resolves through `resolveBoardHit` to `{ points, segment, label }` and is submitted as `engine.recordThrow({ playerId, points, segment })`.
- The dart pad's armed band (`1×` / `2×` / `3×`) turns a sector key into a segment too, so the pad can express "that was a double 16" — without it the accessible path would be a second unwinnable route.
- A miss is `points: 0` with **no `segment` key at all** (not `segment: undefined`): the engine rejects a segment on a zero-scoring throw, and an explicit `undefined` key is a different value from an absent one.

### The two halves of the fix
1. The wrapper default is `"double"`, so the advertised rule is the default rule.
2. The setup surface passes the player's choice through `MatchConfig.outRule`: `eng.startMatch({ playerIds, outRule })`.

The view therefore constructs `new StandardMode({ startScore })` **without** an explicit rule and lets `MatchConfig` govern — `StandardMode` gives the constructor precedence, so pinning `"double"` in the constructor would make the configuration path dead and silently ignore a player who chose Master out.

### How a bust is detected without string-matching
The engine reports a bust by **throwing** `GameEngineStateError`, and reports "not your turn" the same way — so the UI cannot read the message. The view decides for itself, from the rule and the score *before* the dart:

```ts
export function isBustThrow(rule, remaining, points, segment) {
  const next = remaining - points;
  if (next < 0) return true;
  if (next === 0 && !rule.isCheckout(segment, points)) return true;
  return rule.isStrandedBust(next);
}
```

This mirrors `StandardMode.resolveRemaining` exactly, using the shared `OutRule` predicates (`isCheckout`, `isStrandedBust`) — no error message is ever inspected. The computed flag is taken *before* the dart is submitted; when the engine then throws, the caught `GameEngineStateError` is treated as a bust only when the view's own computation says so, so "not your turn" is still announced as itself.

A bust consumes no dart and does not end the turn: the engine's state is untouched, and the view records a UI-local `{ bust: true }` visit entry with the score from before the dart. The BUST chip replaces the visit; the next dart opens a fresh one. The turn indicator follows the engine's `currentPlayerId`, never the view's own notion of whose turn it is.

### Layout
The header strip (mode name, checkout badge, board source, visit chips) runs along the top; below it a grid puts the board on one side and the score sheet, the dart pad and the live announcement on the other. Below 768 px (`useIsCompact`, `matchMedia("(max-width: 767px)")`) the board is a read-only preview and the pad is the input.

### Verification
- `npx tsc --noEmit` clean, `npm run lint` clean, `npx prettier --check` clean on every touched file.
- `npx vitest run` — 403 passed, 1 failed: `tests/integration/linkGuest.test.ts`, which needs PostgreSQL on `localhost:5432` (environmental, pre-existing).
- All 18 Playwright e2e tests pass.
- `git diff src/game-engine/rules/` is empty; `git diff src/game-engine/modes/StandardMode.ts` shows only the two wrapper constructors. (The `modes/index.ts` diff in the working tree is task 008's, not this task's.)
- The Game Center **Checkout** column now reads **"Double out"** for 501 and 301, and the footnote reads "501 and 301 start on Double out."
- Screenshot of the match view: `test-results/task005-match-view.png` (header `501 · DOUBLE OUT · VIRTUAL BOARD · D16 T20`, board left, score sheet and dart pad right, score 409 after D16 + T20).


# Task 008: Migrate the cricket, around-the-clock and shanghai match views

**Status**: completed
**Depends on**: 003, 007

**Files this task owns:** `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx`, and any addition to `src/components/game/types.ts` needed for these modes' state. **Files this task does not touch:** `app/game/page.tsx` and `app/game/301/page.tsx` (task 005), `src/components/game/*` other than `types.ts` (task 007), `src/game-engine/modes/*` (the modes are untouched).
**Retry count**: 0

## Description
Bring the three non-x01 match views onto the new system. They each have private UIs today — they were built alongside the x01 views but never converged — so they need migrating onto the shared components and the token layer.

## Context
### Read first
- `DESIGN.md` §8.5 — the match view specification and the per-mode notes.
- `design-system/darthub/MASTER.md` Part III — the component specs.
- `design-system/darthub/board.md` §7 — the board in the match layout.

### Files
- `app/game/cricket/page.tsx`
- `app/game/around-the-clock/page.tsx`
- `app/game/shanghai/page.tsx`

Each of the three currently carries its **own private UI** rather than using the shared components in `src/components/game/`. That duplication is the reason these pages drifted from the x01 ones. Migrating them onto the shared components is the point of this task — not just restyling them in place.

### What each view needs
- **Cricket** — the target list (20–15 and Bull), the mark counts per target, the close action, and the win state. The targets are the score surface here, not a numeric total: the shared score sheet must express marks and closures, not just a remaining score. `src/components/game/types.ts` will need the extra state these modes carry.
- **Around the Clock** — the current target, the 21-target progress, and the win state. The target is a single large number in the mono face.
- **Shanghai** — the round number, the round target, the per-round marks, and the Shanghai (all three segments in one round) detection.

### The segment means different things in these modes — read the mode, do not assume
The x01 modes consume `segment` to decide a checkout. **These three modes do not read `segment` at all.** Each derives everything from `points`:

- `CricketMode.toSegmentHit(points)` (`src/game-engine/modes/CricketMode.ts:27`) maps a point value to a target and a mark count: `points === 25` → bull, 1 mark; `points === 50` → bull, 2 marks; `points === target` → 1 mark; `2 × target` → 2 marks; `3 × target` → 3 marks.
- `AroundTheClockMode.hitsTarget(points, target)` (`src/game-engine/modes/AroundTheClockMode.ts:73`) matches `points === target`, `2 × target` or `3 × target`. The bull counts at 25 or 50.
- `ShanghaiMode.segmentMarks(points, target)` (`src/game-engine/modes/ShanghaiMode.ts:135`) maps `points === target` → 1 mark, `2 × target` → 2 marks, `3 × target` → 3 marks.

**So the board's throw must be translated into the point value these modes expect, and the board's `segment` must not be sent as-is.**

Concretely, for cricket: a board hit on the **outer bull** resolves to `{ points: 25, segment: "bull" }` — which is what `CricketMode` expects for one bull mark. A board hit on the **inner bull** resolves to `{ points: 50, segment: "bull" }` — which `CricketMode` reads as **two** bull marks, because it matches `points === 2 * CRICKET_BULL`. That is the mode's existing behaviour and it is not changed here. But it means the board's inner bull and outer bull are **not** interchangeable in cricket, and a view that collapses them loses a mark.

**The rule for this task:** send the **points** the mode consumes, and treat the board's `segment` as a UI label only. Do not feed `segment` into these modes, and do not "fix" the modes to read it — that would change the game rules, which is outside this plan's boundary.

**Do not derive the point value from the segment.** For around the clock and Shanghai, a triple and a single of the same number are different marks, and the modes distinguish them by `points` alone (`2 × target` vs `3 × target`). The board's `points` already carries that distinction, so it passes straight through.

### Rules
- **The game logic does not change.** `src/game-engine/modes/CricketMode.ts`, `AroundTheClockMode.ts` and `ShanghaiMode.ts` are **not** modified. Their domain tests must pass unchanged.
- The three views reuse the shared components from task 007 rather than re-implementing them. If a mode needs state the shared components cannot express, **extend the shared components** — do not fork a private copy back into the page.
- The board is available on these views too — a cricket dart is a cricket dart. Use the shared `DartBoard` from task 003 and the shared resolver. Their scoring differs (marks, not points), so the segment semantics must be mapped correctly rather than assumed; read the mode implementations to see what each mode consumes — the mapping is written out above.
- The board's armed segment is the same shared state the x01 views use, passed down the same way.
- Token layer only — no palette utilities.
- Density and states follow the same rules as task 007.
- The layout follows `board.md` §7: board on one side, the mode's score surface on the other, throw strip along the top.
- The views render inside the shell's `<main>` landmark — no page-level `<main>` (task 004 converted them).

### Traps to avoid
- The three views share a shape but **not** a model. Cricket has no remaining score; Shanghai has rounds, not legs. Forcing them into the x01 score sheet would invent data — which is banned.
- **A bust is a thrown error, not a returned state** (see task 005). These modes have no checkout rule, so they do not bust — but the views share the throw pipeline, and the code that handles a thrown `GameEngineStateError` must not misreport a non-x01 throw as a bust.
- `app/game/shanghai/page.tsx` previously had its throw-history state fixed to `useState`; its round history is computed from the throw history. Do not regress that.
- **The cricket bull is 25 points for one mark and 50 points for two marks.** A board hit on the inner bull is 50 points, and `CricketMode` reads that as two marks. Do not collapse the two bulls.

## Requirements (Test Descriptions)
- [x] `it uses the shared game components instead of a private copy`
- [x] `it shows the cricket targets and their mark counts`
- [x] `it counts the inner bull as two marks and the outer bull as one`
- [x] `it shows the current target and the progress in around the clock`
- [x] `it shows the round and its marks in shanghai`
- [x] `it uses only semantic tokens and no palette utilities`
- [x] `it accepts a board throw and applies it to the mode`

## Acceptance Criteria
- All three views use the shared components; no private duplicate of a shared component remains in a page file.
- The three modes' domain tests are **unchanged and green**; no file under `src/game-engine/modes/` is modified.
- No invented data: cricket shows marks, around the clock shows the target and progress, shanghai shows the round and its marks — each mode shows what it actually has.
- A board throw is accepted by each view and applied to the correct mode, and the point value sent is the one the mode consumes.
- Token layer only — the palette-utility test from task 001 passes across these pages.
- The views render inside the shell's `<main>` landmark — no page-level `<main>`.
- `npm run typecheck`, `npm run lint` and `npm run test` stay green (no new failures).

## Implementation Notes

### What each view is now

Every one of the three views is the same skeleton, and the mode's own surface is the only
thing that differs:

```
PlayerSetup  →  MatchLayout  →  [ mode score surface · message · ThrowInputPad | GameResultBanner ]
```

- **`MatchLayout`** (new, `src/components/game/MatchLayout.tsx`) — the throw strip along
  the top (mode name, live badge, "Game Center"), the board in its well on the left and the
  mode's surface in a 480 px column on the right (`xl:grid-cols-[minmax(0,1fr)_480px]`).
  It owns the `DartBoard` and the armed band, exactly as the x01 views do.
- **`CricketScoreSheet`** (new) — the targets 20…15 and BULL, each with its marks (three
  pips) and its `CLOSED` state. Cricket has no remaining score, so this **is** its score
  surface; it carries the player's name and the "3 marks to close" rule in its header.
- **`AroundTheClockScoreSheet`** (new) — the target in play as one large mono figure
  (`data-current-target`), the progress (`Progress 0 / 21`) and the strip of all 21 targets
  (hit / current / not yet).
- **`ShanghaiScoreSheet`** (new) — the round (`Round 1 / 7`), its target, the marks of
  every round, and the three segments of the round in play (S/D/T), so a Shanghai (all
  three in one round) is visible as it happens.

Shared components used: `PlayerSetup`, `ThrowInputPad`, `GameResultBanner`, `ScoreDisplay`
(around the clock and shanghai only — cricket has no numeric score to put in it),
`DartBoard` (through `MatchLayout`) and `MatchLayout` itself. **No view declares a
component of its own** — the pages are state and wiring only.

### The bull mapping — how it works

The board's `points` are passed straight through to the mode; the board's `segment` is
never sent to the engine (these three modes read `points` alone). The inner bull is 50
points and the outer bull 25, so `CricketMode.toSegmentHit` counts the inner bull as
**two** marks and the outer bull as **one** — the two bulls are never collapsed. The
cricket view reads the marks the mode awarded by diffing the mode's own mark state
before and after the dart (`marksGained`), so it does not re-implement the scoring rule.
The tests cover both bulls from the board's own keyboard grid ("Inner bull, 50 points"
→ 2 marks, "Outer bull, 25 points" → 1 mark) and the win path closes the bull with
25 + 50 = 3 marks.

Around the clock and shanghai need no mapping: the board's `points` already carry the
single / double / treble distinction (`2 × target` vs `3 × target`).

### Two extensions to the shared components

The task says to extend the shared components rather than fork a private copy. Two small
extensions were needed, both backwards compatible:

1. **`PlayerSetup`** gained `showCheckoutRule?: boolean` (default `true`). Cricket, around
   the clock and shanghai have no checkout, and offering them a "Double out / Master out
   / Straight out" choice would be a rule they cannot use. The x01 views are unaffected.
2. **`src/components/game/types.ts`** gained the prop types of the new components
   (`MatchLayoutProps`, `CricketScoreSheetProps`, `AroundTheClockScoreSheetProps`,
   `ShanghaiScoreSheetProps`, `BoardThrow`) and `PlayerSetupProps.showCheckoutRule`.

The mode surfaces are new files in `src/components/game/`, not copies of anything: no
file owned by task 007 was rewritten, only `PlayerSetup.tsx` was extended and `types.ts`
was added to.

### No invented data

- Cricket shows marks and closures — no remaining score. `ScoreDisplay` is not used there.
- Around the clock shows the target and the progress; the number in the player sheet is
  the mode's own `totalPoints` (the targets hit), not a remaining score.
- Shanghai shows the round, its target and the marks of every round; the per-round marks
  are computed from the throw history (the mode only keeps the round in play), so the
  old behaviour was not regressed. `marksFor` in the page mirrors the mode's own rule
  (single 1 / double 2 / treble 3) — the mode file itself is untouched.

### A bust is never reported

None of the three modes has a checkout rule, so they never bust. The `catch` in each
view shows the error message as an invalid throw; it never prints "BUST", and the visit
is never marked as a bust.

### Tests

`tests/unit/game/modeViews.test.tsx` — 9 tests: the seven required ones plus the win
state of around the clock and the full cricket close (which also proves the bull
mapping end to end). The "shared components" test is a source-level check (each page
imports `@/components/game/**` and `@/components/board` and declares no component of its
own) plus a render-level check that the board and the dart pad are on the surface. The
token test scans the three page files for palette utilities and arbitrary hex colours.

`e2e/game-center.spec.ts` — the six e2e tests for the three views were rewritten onto
semantic selectors (a label, a role, a `[data-current-target]` hook): the setup form's
`Player 1` label and `Start match` button, the cricket target labels
(`"20, 0 of 3 marks"`), the dart pad scoped by `getByRole("region", { name: "Dart pad" })`
and the shanghai round labels. A new e2e test covers the bull: the outer bull is one
mark and the inner bull two.

### State

`npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build` are
green. `npm run test`: **390 passed, 1 failed** — the failure is the pre-existing
`tests/integration/linkGuest.test.ts`, which needs PostgreSQL on `localhost:5432` (it
failed the same way before this task). The three modes' domain tests are untouched and
green; no file under `src/game-engine/modes/` was modified.

### Known deviations / follow-ups

- The three views are single-player (`maxPlayers={1}`), as the pages were before this
  task — they hard-coded one player id.
- Cricket has no "close" button: the mode closes a target itself at three marks, so a
  manual close would be a game rule that does not exist.
- `board.md` §8.3 says the board stops being an input at 390 px (a read-only preview).
  That is not implemented here — it needs a viewport rule the board component does not
  expose yet, and it would have to land on the x01 views at the same time.
- The three views do not show a "throw history" list. The visit is visible in the board's
  dart marker and, for around the clock and shanghai, in the player sheet's visit chips.

### Screenshots

`test-results/shot-cricket.png`, `test-results/shot-around-the-clock.png` and
`test-results/shot-shanghai.png` (1440 px, gitignored).

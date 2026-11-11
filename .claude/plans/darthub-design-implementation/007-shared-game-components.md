# Task 007: Rebuild the shared game components on the token layer

**Status**: completed
**Depends on**: 001, 004, 006

**Files this task owns:** everything in `src/components/game/` except `BoardSourceSelector.tsx` (created by task 006). **Files this task does not touch:** `src/board/**` (task 002), `app/game-center/page.tsx` and `src/game-engine/modes/registry.ts` (task 006), the match views in `app/game/**` (tasks 005 and 008).
**Retry count**: 0

## Description
Rebuild the four shared game components against the design system. They are used by all five match views, so getting them right once fixes every match view — and gives task 005 a proper dart pad to wire the segment into.

## Context
### Read first
- `DESIGN.md` §8.4, §8.5 — the component specifications and interaction states.
- `design-system/darthub/MASTER.md` Part III — the component specs.
- `design-system/darthub/board.md` §8.4 — the dart pad (the redesign of `ThrowInputPad`).

### Files — all in `src/components/game/`
| File | State today | What it becomes |
|---|---|---|
| `ScoreDisplay.tsx` | per-player score row | the score sheet row: remaining score in tabular mono, visit chips, turn indicator, leg/set progress |
| `ThrowInputPad.tsx` | a 7-column grid of every score 0–60, coloured by band | the **dart pad**: an armed-band control (`1×` / `2×` / `3×`) followed by the number, sending `{ segment, points }` |
| `GameResultBanner.tsx` | result banner | the result state, in the display face, with the leg/set outcome |
| `PlayerSetup.tsx` | player name inputs | the setup form with visible labels, helper text and the checkout selector |
| `types.ts` | the shared prop types | extended for the segment-aware throws |
| `BoardSourceSelector.tsx` | created by task 006 | consumed here — the setup form renders it |

### The dart pad — the important change
Today the pad is a flat grid of every score from 0 to 60, coloured by band. That grid **cannot express a double**: `16` is ambiguous between a single 16 and a double 16. Under the double out rule that ambiguity is the bug — the pad cannot say "double 16", so it cannot finish a leg.

The replacement is the **armed band** route: arm `1×` / `2×` / `3×`, then choose a number. The armed band is shown, the result is announced, and the throw carries the segment. `DESIGN.md` §8.4 and `board.md` §8.4 specify the exact behaviour and states.

**The pad has three groups, not two** (`board.md` §6.5):

| Group | Keys | Size |
|---|---|---|
| **Segment** (`role="radiogroup"`) | `1× Single` · `2× Double` · `3× Treble` | ≥ 44×44 |
| **Sector** | `1` … `20` | ≥ 44×44, ≥ 8 px apart |
| **Bull / miss** | `50` (inner bull) · `25` (outer bull) · `MISS` | ≥ 44×44 |

**Bull is not an armed band.** The bull is a separate pair of keys, not a fourth band — a bull is a different *place* on the board, not a different multiplier of a number. `50` throws `{ points: 50, segment: "bull" }`, `25` throws `{ points: 25, segment: "bull" }`.

**`MISS` is a first-class key, distinct from `0`** (`board.md` §6.5) and it throws `{ points: 0 }` with **no segment**. This is not a style preference — the engine rejects it otherwise: `GameEngine.validateThrowInput` calls `isValidSegmentScore(segment, points)`, and that helper returns `false` for any `points <= 0` (`src/game-engine/rules/OutRules.ts:40`). **A miss sent with a segment is a validation error, not a zero-scoring throw.** The pad's `MISS` key must therefore send `points: 0` and omit the segment.

This is the accessible equivalent of the board's painted beds, and it is the mitigation that makes the board's target-size deviation defensible — so it must work completely, including from the keyboard.

**The armed band is one piece of state, shared with the board.** `board.md` §6.5: *"The armed segment is shared — arming 3× in the pad changes what the board's numerals score and is shown on the board as the brass band outline. The two surfaces stay in sync; they are two views of one state."*

So the armed segment is **not** local to the pad. It lives in the match view and is passed down to both the pad and the board. The pad's props are:

```ts
export interface ThrowInputPadProps {
  throwsInCurrentTurn: number;
  /** The armed band. Owned by the match view and shared with the board. */
  armedSegment: ArmedSegment;
  onArmedSegmentChange: (segment: ArmedSegment) => void;
  /** Fires with the resolved throw. A miss sends `segment: undefined`. */
  onThrow: (throwInput: { points: number; segment?: ThrowSegment }) => void;
  disabled?: boolean;
}
```

**`onThrow`'s signature changes** from `(points: number) => void` to `(throwInput: { points: number; segment?: ThrowSegment }) => void`. Every call site must be updated — `app/game/page.tsx`, `app/game/301/page.tsx` (task 005) and the three non-x01 views (task 008). That is why task 005 depends on task 007: **the pad's new signature must exist before the views that use it are written.**

`ThrowSegment` is the engine's type, re-exported from `@/game-engine/types`. Importing it here is fine — `src/components/game/` is a UI folder, and it already imports nothing from the engine, so this is the first such import. Keep it **type-only** (`import type { ThrowSegment } from "@/game-engine/types"`); a value import would pull the engine into the client bundle.

**A miss carries no segment, and that is a correctness requirement rather than a preference.** `validateThrowInput` in `src/game-engine/GameEngine.ts` rejects any throw whose segment does not match its points, and `isValidSegmentScore` returns `false` for `points <= 0`. A miss therefore has to be submitted as `{ points: 0 }` with **no** `segment` key. Sending `{ points: 0, segment: "single" }` is a `GameEngineValidationError`, not a miss. The pad's miss key and the board's out-of-bounds click must both omit the segment, and `segment` is `optional` on the prop type for exactly this reason.

### Rules
- **Token layer only.** No palette utilities — the current components are full of `bg-slate-800`, `text-slate-400`, `bg-blue-800`, `bg-purple-800`.
- **Semantics before colour.** Green (`--color-treble`) means a visit that counted; red (`--color-double`) means a bust. **Colour is never the only carrier of meaning** — each state carries a label or an icon too.
- **Numbers that change use tabular figures** (`--font-mono`), so a score does not reflow as it falls.
- **Density.** The play surface uses `--space-md` / `--space-lg` throughout — a player reads the score mid-turn, and whitespace is the enemy there. The hub and other pages may breathe.
- **Radius.** `--radius-sm` 3 px for keys and buttons, `--radius-md` 4 px for panels. **No pills.** `--radius-full` only for a genuine circle.
- **States.** Every control defines default, hover, focus-visible, active and disabled. Disabled controls are visibly disabled and non-interactive, with reduced opacity and a cursor change.
- **Targets.** Every interactive element ≥ 44 × 44 px with ≥ 8 px spacing. The pad's keys must satisfy this.
- **Reduced motion** is honoured, and no state depends on an animation ending to become correct.
- Icons come from **Lucide** (installed in task 001), one family, consistent stroke, decorative icons `aria-hidden`, icon-only controls with an accessible name.

### Traps the design prototype actually hit
- A **`var` closure bug** in the pad made every key score the last number. The implementation must not repeat it, and the test must assert that two different keys produce two different results.
- The score sheet **overflowed its column** (tally dots over the visit chips).

## Requirements (Test Descriptions)
- [x] `it uses only semantic tokens and no palette utilities`
- [x] `it sends the armed band and the number as a segment and a score`
- [x] `it sends a miss with no segment`
- [x] `it sends two different scores for two different pad keys`
- [x] `it marks a counted visit and a bust with a label and not with colour alone`
- [x] `it renders the remaining score in tabular figures`
- [x] `it gives every control a visible focus ring and a disabled state`
- [x] `it meets the 44 pixel minimum target size`
- [x] `it labels the player inputs visibly rather than with a placeholder alone`

## Acceptance Criteria
- All four components are rebuilt against the token layer, with **no palette utility** left in `src/components/game/`.
- The pad sends a segment; `armed: "double" + 16` produces `{ segment: "double", points: 32 }`.
- The pad's `MISS` key produces `{ points: 0 }` with **no segment** — a miss with a segment is rejected by the engine's validator, so this is a correctness requirement, not a nicety.
- The bull keys `50` and `25` produce `{ segment: "bull", points: 50 }` and `{ segment: "bull", points: 25 }`.
- Two different pad keys produce two different results (the closure-bug regression is covered).
- Every state is distinguishable without relying on colour alone.
- Every interactive target is ≥ 44 × 44 px with ≥ 8 px spacing.
- `src/components/game/types.ts` is updated for the segment-aware props; every existing prop type still resolves, and `ThrowInputPadProps.onThrow` has its new shape.
- The armed segment is a prop of both the pad and the board — neither component holds its own copy.
- `npm run typecheck`, `npm run lint` and `npm run test` stay green (no new failures).

## Implementation Notes

### What was built

**`src/components/game/ThrowInputPad.tsx`** — the dart pad. Three groups, all on the
token layer:

| Group | Keys | Markup |
|---|---|---|
| Segment | `1× Single` · `2× Double` · `3× Treble` | `role="radiogroup"` + `role="radio"` buttons, roving tabindex, arrow keys move the armed band |
| Sector | `1` … `20` | 4 × 5 grid of buttons, visible label is the number, accessible name is the outcome (`"Double 16, 32 points"`) |
| Bull / miss | `50` · `25` · `MISS` | three buttons |

The armed band is named in the group label (`SEGMENT: DOUBLE ×2`), so the state never
depends on colour. The bull is **not** a fourth band — it is a pair of keys. `MISS` is
a first-class key and sends `{ points: 0 }` **with no `segment` key at all** (the object
literal has no `segment` property, not `segment: undefined`).

**`src/components/game/ScoreDisplay.tsx`** — the score sheet: a ruled list, one row per
player, brass rail + `ON TURN` caption on the active row, the remaining score in
`font-mono` `tabular-nums` in a fixed `min-w-[3ch]` column, the player's last visit as
badges (`T20`, `D16`, `S7`, `BULL 50`, `MISS`) with a Lucide `Check` icon, a bust as a
`bg-double` chip with a Lucide `X` and the word **BUST**, three tally dots, and the
leg/set progress in the sheet header.

**`src/components/game/GameResultBanner.tsx`** — the result state in the display face:
a Lucide `Trophy` (decorative) beside the headline `Dave takes leg 2`, a mini sheet with
the word **WIN** / **2ND** / **3RD**, the margin computed from the engine's own numbers
(`runner-up remaining − winner remaining`), and two actions — `Play again` (primary) and
`Game Center` (secondary). No emoji.

**`src/components/game/PlayerSetup.tsx`** — the setup form: the mode heading with a
Lucide icon in brass (the `modeIcon` prop is now a `LucideIcon`, not an emoji string),
a visible `<label for>` above every name input with helper text wired through
`aria-describedby`, the **checkout** radio group (double / master / straight, with the
master rule spelled out as "the inner bull (50)"), the `BoardSourceSelector` from task
006, and an error that is announced (`role="alert"` + `aria-live="polite"`) with a
warning icon.

**`src/components/game/types.ts`** — extended, not replaced. `ArmedSegment` is re-exported
from `@/components/board`; `ThrowSegment` is imported **type-only** from
`@/game-engine/types` (a value import would pull the engine into the client bundle).
`ScoreDisplayProps`, `GameResultBannerProps` and `PlayerSetupProps` keep every field
they had and gain optional ones (`leg`, `set`, `outRule`, `boardSource`,
`onOutRuleChange`, `onBoardSourceChange`). `PlayerSetupProps.onStart` gained a second
parameter — `(playerNames, { outRule, boardSource })` — which the existing one-argument
call sites still satisfy, because a function with fewer parameters is assignable.

**`src/components/game/classes.ts`** (new) — the three shared control classes:
`FOCUS_RING` (2px cream outline, 2px offset, never removed), `TARGET_SIZE`
(`h-11 min-w-11` = 44px) and `DISABLED` (`disabled:opacity-45 disabled:cursor-not-allowed`).

### The two existing call sites — updated, not kept backward-compatible

`app/game/page.tsx` and `app/game/301/page.tsx` were **updated minimally** so the repo
keeps type-checking. Each now owns the armed band (`useState<ArmedSegment>("single")`),
passes `armedSegment` / `onArmedSegmentChange` to the pad, and its `recordThrow` takes
`{ points, segment?: ThrowSegment }` and forwards the segment to
`engine.recordThrow({ playerId, points, segment })`. The `modeIcon="🎯"` emoji prop was
dropped (the prop is now a Lucide icon; the pages still show their own legacy emoji
header — **task 005 owns those files and will rewrite them properly**). No other change
was made to the two views.

### How the 44px target was measured

jsdom has no layout engine, so the unit test asserts the **cause** — every pad key
carries `h-11` and `min-w-11` (2.75rem = 44px) and the key grids carry `gap-md` (8px).
The rendered size was then **measured in Chromium** against the dev server with a
temporary Playwright spec (since deleted): the pad was opened at `/game`, a match was
started, and every key's `getBoundingClientRect()` was read.

> 26 keys, smallest **115.5 × 44 px**, smallest gap between adjacent keys **exactly
> 8 px**.

The compiled CSS was checked too: `.h-11{height:calc(var(--spacing) * 11)}` (2.75rem),
`.gap-md{gap:var(--spacing-md)}` (8px), `.opacity-45{opacity:.45}`, and the focus ring
(`outline-2` / `outline-solid` / `outline-ink` / `outline-offset-2`) is all present in
the emitted stylesheet.

### Tests

`tests/unit/game/` — five files, 25 tests:
`throwInputPad.test.tsx`, `scoreDisplay.test.tsx`, `gameResultBanner.test.tsx`,
`playerSetup.test.tsx`, `tokenLayer.test.ts` (a source scan of every file in
`src/components/game/` for palette utilities and arbitrary hex colours).

### Known failures outside this task (not caused by these changes)

- `tests/unit/async-tmp.test.tsx` — the stray scratch file another agent left behind
  (the orchestrator is deleting it).
- `tests/integration/linkGuest.test.ts` — needs PostgreSQL on `localhost:5432`.
- `tests/unit/ui/dashboard.test.tsx`, `tests/unit/ui/lobby.test.tsx`,
  `tests/unit/ui/secondaryPages.test.tsx`, `tests/integration/ui-skeletons.test.tsx` —
  the parallel worker (task 009) is rebuilding those pages in flight.
- `npm run lint` and `npm run format:check` currently fail on
  `tests/unit/ui/secondaryPages.test.tsx` (the same parallel worker's file: one unused
  variable and a formatting difference). Every file this task owns is clean under
  `eslint`, `prettier --check` and `tsc --noEmit`.

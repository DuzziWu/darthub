# Task 006: Rebuild the Game Center as a rule sheet and add the BoardSource selector

**Status**: completed
**Depends on**: 001, 004

**Files this task owns:** `app/game-center/page.tsx`, `src/game-engine/modes/registry.ts` (new), `src/components/game/BoardSourceSelector.tsx` (new). **Files this task does not touch:** `src/board/**` (task 002 owns it), `src/components/game/*` other than `BoardSourceSelector.tsx` (task 007 owns those), `src/game-engine/modes/StandardMode.ts` (task 005 owns the wrapper defaults).
**Retry count**: 0

## Description
Replace the five interchangeable gradient cards with a rule sheet, and add the board source selector to the match setup. The hub is where the "no interchangeable gradient cards" rule is either honoured or quietly broken, so it gets built first against the design.

## Context
### Read first
- `design-system/darthub/pages/game-center.md` — the Game Center override, including the **Checkout column** and the corrected copy. This file is the specification.
- `DESIGN.md` §8.2 — the Game Center component specification.
- `reports/design/prototype.html` — the reference implementation of the rule sheet.

### The rule sheet
A table, not a card grid. Columns: **Mode, Start, Win condition, Checkout, Targets.**
- 501 — start 501 — "Reach exactly 0" — Double out — —
- 301 — start 301 — "Reach exactly 0" — Double out — —
- Cricket — — "Close 3 marks to score" — — 20–15 + Bull
- Around The Clock — — "Hit every target in order" — — 1–20, then Bull
- Shanghai — — "Hit all 3 segments in one round" — — 1–7

**Those values are placeholders for the test, not the source.** `design-system/darthub/pages/game-center.md` §2.3 makes generation from the mode registry a **hard requirement**: *"Every rule value on this page is read from the mode registry in `src/game-engine/modes/`, not typed as prose in the page file."* The reason given is correctness — the current page hardcodes a rule the engine does not implement, and that is the defect this plan exists to fix. Hardcoding the corrected values in the page would leave the same drift possible one edit away.

So this task must build the registry the sheet reads. It does **not** exist today: `src/game-engine/modes/index.ts` is a barrel of exports, not a registry of mode metadata.

**Where the registry lives.** `src/game-engine/modes/registry.ts`, next to the modes it describes, exporting one entry per mode:

```ts
export interface ModeRuleEntry {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly start: string | null;          // "501" | null
  readonly winCondition: string;
  readonly checkout: string | null;       // "Double out" | null
  readonly targets: string | null;
}
export const MODE_RULES: readonly ModeRuleEntry[];
```

Each entry's values are **derived from the mode's own exported constants**, so they cannot drift:

| Mode | Values come from |
|---|---|
| 501 | `Standard501Mode` — start score 501; checkout from the mode's default out rule |
| 301 | `Standard301Mode` — start score 301; checkout from the mode's default out rule |
| Cricket | `CRICKET_TARGETS` (20–15 + 25) and `MARKS_TO_CLOSE` (3) |
| Around The Clock | `AROUND_THE_CLOCK_TARGETS` (1–20, then 25) |
| Shanghai | `SHANGHAI_ROUNDS` (7) and `roundTarget()` (1–7) |

**The checkout column must read the mode's actual default, not a literal.** `StandardMode` derives its id from the out rule (`src/game-engine/modes/StandardMode.ts:59`), so the default is observable — but a literal `"Double out"` in the registry would drift the moment the mode default changes. The registry reads the default out rule from the mode instance.

**Two halves, both required.** The sheet's claim is only true when the mode default *is* double out — which is task 005's job. If task 005 has not landed, the sheet says what the engine actually does, whatever that is. The page and the engine can never disagree.

**The Master Out description must say "inner bull", not "the bull".** `MasterOutRule.isCheckout` (`src/game-engine/rules/OutRules.ts:71`) accepts `segment === "bull"` **only at `points === 50`** — the inner bull. The outer bull (25) does not finish a master-out leg. Say exactly what the rule accepts, or the sheet re-introduces the kind of inaccuracy this task exists to remove. The same applies to the mode's own description string: **read it from the rule, never from prose.**

**This task adds `src/game-engine/modes/registry.ts` — a new file.** It does not modify `StandardMode.ts` or any other existing engine file; the wrappers' default change belongs to task 005.

The footnote: *"3 darts per turn · Checkout rule is chosen when the match starts: Double out, Master out or Straight out. 501 and 301 start on Double out."* The first clause is a constant (`DARTS_PER_TURN` from `@/game-engine`); the rest is generated from the registry.

**The modes differ by their rules, never by their colour.** No gradient, no per-mode hue. The mode name is set in the display face, the numbers in the mono face, and the row is a ruled sheet line.

### The corrected copy
The current descriptions claim *"finish on a double"* for 501/301 — which was false until task 005 fixed it. The new copy states the rule that is actually in force, read from the registry. **If task 005 has not landed, the copy must not claim double out.**

### The BoardSource selector
A radio group in the match setup:
- **Virtual Board** — available and selected. "Ready — play on the built-in board."
- **Camera Board** — `aria-disabled="true"` but **still focusable** (not the `disabled` attribute, which would hide the explanation), with a visible reason and a `PLANNED` tag.
- **Smart Dart** — the same treatment.

Selecting a planned source is **impossible**: no "click and see", no silent fallback, never an empty or broken board. The source is chosen before the match and shown in the match header (task 005).

**`aria-disabled` on a radio does not prevent selection.** A radio input with `aria-disabled="true"` is still changeable by click and by keyboard — `aria-disabled` is a *semantic* hint to assistive tech, not a behavioural lock. The "cannot be selected" requirement needs a behavioural guard as well:

- The radio group's value is controlled by React state, and the change handler **ignores** a selection of an unavailable option, keeping the current selection.
- The unavailable radio keeps `aria-disabled="true"`, stays in the tab order, and its `aria-describedby` points at the visible reason.

Without the behavioural guard, a mouse click on "Camera Board" silently selects it and the match starts with no board — the exact failure `board.md` §9.2 forbids.

**The `BoardSource` type lives in the board module.** `board.md` §9.1 defines it, and task 002 creates it:

```ts
export type BoardSourceId = "virtual" | "camera" | "smart";
export interface BoardSource {
  readonly id: BoardSourceId;
  readonly label: string;
  readonly available: boolean;
  readonly note?: string;
}
```

It is in `src/board/boardSource.ts` and re-exported from `src/board/index.ts` — **both created by task 002**. This task consumes them; it does not create or edit them.

**The selector component lives in `src/components/game/BoardSourceSelector.tsx`** — task 007 owns `src/components/game/`, so this task creates the file and task 007 builds the rest of that folder around it. The component takes `value` and `onChange` as props and holds no state of its own beyond the guard above.

### Rules
- **No invented data.** Every cell is a fact about the mode. No averages, no player counts, no filler.
- The rule sheet is a **reference**, not a landing page. No hero, no feature grid, no CTA band.
- The table must work on a narrow screen — `DESIGN.md` §10 and the page override specify how a four-column table becomes a stacked list without a horizontal scrollbar at 390 px.
- There is **no footer** in this codebase — the app shell owns the landmark and the navigation. The mode count belongs in the footnote beneath the sheet, not in a footer.

## Requirements (Test Descriptions)
- [x] `it lists every game mode with its start score, win condition and targets`
- [x] `it shows the checkout rule in force for the x01 modes`
- [x] `it generates the rule values from the mode registry rather than from literals`
- [x] `it does not distinguish the modes by colour`
- [x] `it offers the three board sources and marks the unavailable ones as planned`
- [x] `it does not allow selecting an unavailable board source`
- [x] `it keeps the explanation for an unavailable source visible to a keyboard user`
- [x] `it renders the rule sheet without a horizontal scrollbar at 390 pixels`

## Acceptance Criteria
- The page renders a table with the five modes and the specified columns and values.
- **`src/game-engine/modes/registry.ts` exists and the page renders from it.** A test asserts the sheet's cell values equal the registry's entries, so a change to the registry changes the page. No rule value is a literal in `app/game-center/page.tsx`.
- The registry's start scores, targets and marks counts come from the modes' own exported constants (`CRICKET_TARGETS`, `MARKS_TO_CLOSE`, `AROUND_THE_CLOCK_TARGETS`, `SHANGHAI_ROUNDS`, `roundTarget`), and the checkout column comes from the modes' actual default out rule.
- No card, tile or gradient distinguishes one mode from another.
- Every cell traces to a fact about the mode — no invented statistic.
- The BoardSource radio group has exactly three options; the two planned ones carry `aria-disabled="true"`, remain focusable, show a `PLANNED` tag and a visible reason, and **cannot be selected** — a click or keyboard activation on them leaves the selection unchanged.
- `src/board/boardSource.ts` (created by task 002) defines the `BoardSource` type and the three sources, re-exported from `src/board/index.ts`. **This task does not edit them.**
- The description copy matches the rule actually in force — read from the registry, not asserted by hand.
- No horizontal scrollbar at 390 px; the narrow layout follows the page override rather than an invented pattern.
- The page renders inside the shell's `<main>` landmark and uses the token layer only.
- `npm run typecheck`, `npm run lint` and `npm run test` stay green (no new failures).

## Implementation Notes

### Files
- `src/game-engine/modes/registry.ts` (new) — the mode registry.
- `app/game-center/page.tsx` (rebuilt) — the rule sheet. Now a **server component** (no `"use client"`): it holds no state, and the registry must not be dragged into the client bundle.
- `src/components/game/BoardSourceSelector.tsx` (new) — the board-source radio group.
- `tests/unit/game-center/modeRegistry.test.ts`, `tests/unit/game-center/gameCenterPage.test.tsx`, `tests/unit/game-center/boardSourceSelector.test.tsx` (new).
- `e2e/game-center.spec.ts` (updated) and `tests/unit/tailwind/noLegacyUtilities.test.ts` (updated) — the gradient-card assertions are replaced, because a gradient is removed on purpose. The styling-regression tests themselves (stylesheet present, body background, heading font stack) are kept.

### The registry's exported shape
```ts
export interface ModeRuleEntry {
  readonly id: string;            // "501" | "301" | "cricket" | "around-the-clock" | "shanghai"
  readonly name: string;          // the mode name shown in the sheet
  readonly href: string;          // "/game", "/game/301", "/game/cricket", …
  readonly start: string | null;  // "501" | null
  readonly winCondition: string;
  readonly checkout: string | null;   // "Double out" | null
  readonly targets: string | null;
}
export const MODE_RULES: readonly ModeRuleEntry[];   // five entries, in sheet order

export interface OutRuleChoice { readonly id: OutRuleId; readonly label: string; readonly description: string; }
export const OUT_RULE_CHOICES: readonly OutRuleChoice[];  // the engine's own rule set, in order
export function sheetFootnote(): string;                   // the one generated line under the sheet
```

### How each value is derived
| Value | Derived from |
|---|---|
| 501 / 301 start score | the mode instance — `StandardMode` encodes the score it starts from in its id (`x01-501`), read by `readX01Facts` |
| 501 / 301 checkout | the mode's **actual default out rule**, read from the same id and formatted through `OUT_RULE_LABELS` — never a literal |
| Cricket marks | `MARKS_TO_CLOSE` → `Close 3 marks to score` |
| Cricket targets | `CRICKET_TARGETS` minus the bull (the one target the board accepts as a bull, found via the engine's own `isValidSegmentScore`) → `20-15 + Bull` |
| Around The Clock targets | `AROUND_THE_CLOCK_TARGETS` minus the bull → `1-20, then Bull` |
| Shanghai targets | `roundTarget(1..SHANGHAI_ROUNDS)` → `1-7` |
| The checkout rules offered | `OUT_RULES` (the engine's own rule set) — the footnote's "Double out, Master out or Straight out" is that list |
| The darts per turn | `DARTS_PER_TURN` |

**Master Out says "inner bull".** `describeCheckout` reads what a rule accepts (`isCheckout("bull", 50)` yes, `isCheckout("bull", 25)` no) rather than describing it in prose, so the master-out text is "finish on a double or the inner bull (50)". The straight-out text falls out of the same probe ("any finish counts").

### What the checkout column reads today
**"Straight out"** for 501 and 301 — task 005 has not landed, so `Standard501Mode`/`Standard301Mode` still default to `outRule: "straight"`. The footnote says so too: "501 and 301 start on Straight out." That is the honest reading of the engine, not a bug; when task 005 changes the wrappers' default, the sheet changes with it. The test proves it: it probes the rule the mode actually enforces (does a single finish land? does an inner-bull finish land?) and compares that with the rendered cell — a hardcoded "Double out" fails it.

### The BoardSource guard
`src/components/game/BoardSourceSelector.tsx` is a controlled radio group (`value` + `onChange`, no state of its own). The guard is the `onChange` handler:
```ts
onChange={() => { if (!unavailable) { onChange(source.id); } }}
```
The radio's value is controlled by the parent, so an ignored change is restored by React and the selection never moves. `aria-disabled="true"` alone is not a lock — the two planned radios stay focusable (no `disabled` attribute), carry a `PLANNED` tag and their visible reason as the `aria-describedby` target.

### Deliberate omissions
- **No "How scoring works" affordance.** The page override asks for a help link, but the product has no scoring-help route and no help content; a link to nowhere or invented help prose would be worse than its absence. The header carries the h1 and the one-line explanation only.
- **The mode count** is not in a footer — the shell owns the footer landmark — but it is implied by the sheet's five rows.

### The 390 px check
`jsdom` has no layout engine, so the unit test asserts the *cause* (the table is `hidden md:table`, the stacked list is `md:hidden`, nothing in the sheet declares a horizontal scroll, a fixed width above 390 px or `whitespace-nowrap`, and the stacked list carries every value the table carries). The **measurement** lives in the Playwright spec (`e2e/game-center.spec.ts`), which asserts `document.documentElement.scrollWidth <= clientWidth` at 390×844.

### Known failure outside this task
`tests/unit/async-tmp.test.tsx` (a scratch file another agent left in `tests/unit/`) fails the suite; it is not part of this task and was not touched. The only other failure is the pre-existing environmental `tests/integration/linkGuest.test.ts` (needs PostgreSQL on localhost:5432).

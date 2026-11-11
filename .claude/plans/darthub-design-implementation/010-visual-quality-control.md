# Task 010: Visual quality control at 1440 / 1024 / 390

**Status**: completed
**Depends on**: 005, 006, 008, 009
**Retry count**: 0

## Description
Look at every surface in a real browser at three viewports, judge it critically against the design system, and fix what looks wrong. A passing build is not a design acceptance.

## Context
### Read first
- `DESIGN.md` — the whole document, especially §10 (responsive), §11 (accessibility floor) and §12 (do/don't).
- `design-system/darthub/MASTER.md` — the token set and component specs.
- `design-system/darthub/pages/game-center.md` — the Game Center override.
- `reports/design/03-visual-qc.md` — the design phase's own QC, including the thirteen defects it found in the prototype. Several of those defect classes are worth re-checking here.

### The surfaces
`/`, `/game-center`, `/game`, `/game/301`, `/game/cricket`, `/game/around-the-clock`, `/game/shanghai`, `/lobby`, `/career`, `/dashboard` — plus the **match setup** state of each match view (the player-setup screen, before a match starts), since that is a distinct surface.

### The method
1. **Run the dev server** and confirm it is serving the current build (`npm run dev`). The plan previously named a specific PID (33596) — a PID from a previous session is meaningless by the time this task runs. Check whether a dev server is already listening on port 3000 and reuse it if it is serving the current code; otherwise start one.
2. **Capture a screenshot of every surface at 1440, 1024 and 390.** Save them under `reports/design/` (gitignored — local artefacts).
3. **Actually look at each one** and write down what is wrong. A screenshot that has not been looked at is not a check.
4. **Fix every visible problem**, then re-capture.

### Measure with the browser, not with a script that only reads CSS
The contrast, target-size and overflow requirements are about **rendered pixels**, so they must be measured in a browser. Playwright is already installed (`@playwright/test`) and `playwright.config.ts` exists, so the measurements belong in a Playwright script rather than in ad-hoc node code:

- **Contrast**: resolve the *computed* foreground and background colours of the actual element (`getComputedStyle`), composite any alpha over the parent's background, and compute the WCAG ratio. Asserting "the CSS contains `--color-ink`" proves nothing about the rendered pair.
- **Target size**: `element.getBoundingClientRect()` on each interactive element. Remember that a *paintable* target is not the same as a *clickable* one — an element with `pointer-events: none` or zero size does not count.
- **Overflow**: `document.documentElement.scrollWidth > document.documentElement.clientWidth` on the document, and also on the `<body>` — a scrollbar on an inner container is still a horizontal scrollbar the user sees.
- **Focus ring**: focus the element and read `getComputedStyle(el).outlineWidth` / `outlineStyle`, or screenshot the focused state.
- **Reduced motion**: `page.emulateMedia({ reducedMotion: "reduce" })`, then assert the computed `transition-duration` is `0s` for the animated properties.

Write these as a Playwright script under `reports/design/` (gitignored) or as a proper spec under `e2e/` if the assertions are worth keeping.

**The existing e2e suite is a gate, not a formality.** `e2e/game-center.spec.ts` has 16 passing tests, and several of them assert on the **old Game Center** — the gradient cards, `main a` having exactly 5 elements, the `text-3xl` heading, and the `slate-900` background. Rebuilding the Game Center as a rule sheet (task 006) will break them. Update those assertions to the new design — the point of the e2e file is to catch exactly this kind of drift, not to be rewritten to whatever the code now does. If an assertion is removed, say why in the commit.

**Two more e2e files touch the match views**: `e2e/game-center.spec.ts` also drives the 501, cricket, around-the-clock and shanghai flows, clicking pad keys by their old labels (`"T20"`, `"S1"`, `"20"`). The new dart pad has a different structure (armed band + sector keys), so those selectors change too. `e2e/career.spec.ts` is entirely `test.skip`-ed and needs no update.

### What to look for
- **Layout** — cramping, clipped or truncated text, collisions, inconsistent spacing, a horizontal scrollbar at 390 px, content hidden behind the sticky header or the mobile tab bar.
- **Hierarchy** — is the primary action primary? Is the score the most prominent thing on a match view? Is anything competing that should not?
- **Typography** — the display face on headings, mono on every number that changes, tabular figures so a falling score does not reflow, no body text below 16 px on mobile, no orphaned headings.
- **Colour** — every foreground/background pair at its measured contrast; semantic colour used for meaning; **no raw hex or palette utility** drifting in; `--color-rule` not carrying meaning.
- **Consistency** — identical radii, spacing, icon size and stroke width across surfaces; no one-off values.
- **Banned patterns** — interchangeable gradient cards, arbitrary bento grids, excessive rounding, emoji as icons, decorative glow, invented statistics.
- **Interaction states** — hover, focus-visible (a visible ring, never removed), active, disabled.
- **Accessibility floor** — contrast ≥ 4.5:1, targets ≥ 44 × 44 px with ≥ 8 px spacing, colour never the sole carrier of meaning, `prefers-reduced-motion` honoured, keyboard reachable.

### Measuring, not guessing
The design phase measured rather than eyeballed, and that is what caught the bearing error and the degenerate ring paths. Do the same — with the browser-based measurements described above, and record the actual numbers.

**The board's keyboard route is the thing to check hardest.** The painted beds are a documented deviation, so the mitigation must be verifiably present: the armed-band + numeral route, the 62-cell roving-tabindex grid, and the pad's segment radio group. A board with a beautiful SVG and no keyboard route is a failure, not a pass.

### The record
Write `reports/design/04-implementation-qc.md`: per surface, per viewport, what was seen, what was wrong, what was changed, and the before/after screenshot paths. A clean surface gets one line saying it was checked and passed.

### The board's documented deviation
The board's painted beds are a **documented deviation** from WCAG 2.2 SC 2.5.8 (AA, 24 × 24 px) — the treble band is 8 mm of a 451 mm board, so no renderable board can satisfy it. `board.md` §8.3.2 states the mitigation: the beds are a pointer precision shortcut, every outcome they offer is duplicated by ≥ 44 px controls (the armed-band + numeral route and the redesigned dart pad), and below 768 px the board is a **read-only preview** with the pad as the input. **Verify the mitigation is actually present** — the board alone is not a defect, but a missing keyboard route is.

## Requirements (Test Descriptions)
- [x] `it captures every surface at 1440, 1024 and 390`
- [x] `it has no horizontal overflow at 390 pixels on any surface`
- [x] `it has no interactive target below 44 pixels except the board's painted beds`
- [x] `it meets a 4.5 to 1 contrast ratio for body text on every surface`
- [x] `it shows a visible focus ring on every interactive element`
- [x] `it collapses motion under prefers-reduced-motion`
- [x] `it contains no palette utility, raw hex or emoji icon in a component`
- [x] `it provides the keyboard route that duplicates the board's capability`
- [x] `it makes the board a read-only preview below 768 pixels`
- [x] `it keeps the e2e suite passing against the new design`

## Acceptance Criteria
- Every surface is captured and **critically reviewed** at all three viewports; the review is written down, not just the screenshots.
- Every visible problem found is **fixed**, and the fix is verified by a re-capture. Nothing is noted-and-left.
- The measurement results (contrast ratios, target sizes, overflow) are recorded with the actual numbers, and the measurements were taken in a browser against rendered pixels.
- **The e2e suite passes.** `e2e/game-center.spec.ts` is updated to assert the new Game Center and the new dart pad — the assertions are rewritten to the new design's contract, not loosened to whatever the code now does.
- The board's documented deviation is confirmed as mitigated — the armed-band keyboard route exists, the 62-cell roving grid is operable, and the pad's segment radio group is present and focusable.
- **The board is a read-only preview below 768 px in all five match views.** `design-system/darthub/board.md` §8.3 and `DESIGN.md` §8.3 specify it, and the `DartBoard` component already exposes the `readOnly` prop (`pointer-events: none`, no buttons, `aria-hidden="true"`). Task 005 implemented the rule for the two x01 views — `src/components/x01/X01MatchView.tsx` derives `compact` from a `useIsCompact()` hook and passes `readOnly={compact}`. **Task 008 did not implement it for the three non-x01 views**: `src/components/game/MatchLayout.tsx` renders `<DartBoard armedSegment={armedSegment} onThrow={onBoardThrow} />` with **no `readOnly` prop**, so on a phone those three views still offer the board's 9 mm treble band as a touch target. This task owns closing that gap: `MatchLayout` must apply the same compact rule, so on a phone the dart pad is the input everywhere and the board's painted beds are not presented as touch targets. Verify it by loading each of the five match views at 390 px and confirming the board does not accept pointer input while the pad does.
- `reports/design/04-implementation-qc.md` exists and answers the questions above.
- The token-utility test from task 001 passes across every component and page.
- `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build` stay green, `npm run test` introduces no new failure, and the Playwright suite passes.

## Implementation Notes

Fifteen surfaces were captured at 1440, 1024 and 390 in a real browser, looked at, measured, fixed
and re-captured. The record is `reports/design/04-implementation-qc.md`; the screenshots are
`reports/design/qc/<surface>-<width>.png`; the measurements are
`reports/design/qc/measurements.json`.

### The gap this task owned, closed

`MatchLayout` now applies the same compact rule the x01 views already had. The board is a
read-only preview below 768 px in **all five** match views — `aria-hidden="true"`,
`pointer-events: none`, no buttons — and the pad is the input everywhere. The single
`useIsCompact()` hook in `src/components/game/useIsCompact.tsx` is the one place the breakpoint
lives; `MatchLayout` reuses it rather than writing a second threshold.

### Eleven defects found and fixed

1. **The board was 300 px at every viewport.** The well's wrapper was `inline-block`, which
   shrink-wraps to the SVG's intrinsic 300 px, so the `max-w-[634px]` / `max-w-[554px]` caps never
   applied. The wrapper is now `w-full` and the cap sits on the well, padding included. The board
   measures **600 px** at 1440, **510 px** at 1024, **300 px** at 390 — `DESIGN.md` §10.2.
2. **The footer floated mid-page** on every short page. `<main>` is now `flex flex-col` and the
   footer is `mt-auto`, so it sits at the foot of the viewport.
3. **The five match views were five layouts.** `MatchLayout` is now the one shell for all five;
   `X01MatchView` renders through it. The strip's type and chrome live once in
   `src/components/game/classes.ts` (`MATCH_STRIP`, `MATCH_TITLE`, `MATCH_BADGE`, `MATCH_SOURCE`),
   so the two families cannot drift apart again.
4. **The three non-x01 views dropped the board source**, so their strips did not name it. They now
   keep `PlayerSetupOptions` and pass the label through `boardSourceLabel()`.
5. **The Game Center was 1200 px / 32 px at 1024**; it is now 900 px / 24 px below 1280.
6. **The match view ran the full 1440 px**, leaving a void between the board and the sheet. It is
   now `max-w-[1200px]`, matching the Game Center.
7. **The throw strip was a bare row of text.** It is now a 56 px `bg-surface` band, sticky below
   the app header from the md breakpoint up, as `match.md` §3 specifies.
8. **The lobby stranded "Create Room"** on its own row under a 900 px rule. The private room is
   one row now: label left, action right.
9. **Two emoji in a component** — the Shanghai sheet's "✓" dingbat became the Lucide `Check`
   icon, and three numbered emoji in a route's comments became plain numbers.
10. **The token test only scanned `src/components/game`**, which is how the board kept its raw hex
    values. It now walks every component and page under `src/components`, `src/ui` and `app`, and
    fails on a palette utility, an arbitrary colour, a raw hex or an emoji icon. The widened scan
    finds zero of each across the 49 UI files.
11. **A capture artefact**, not a product defect: the first captures showed the sticky header
    painted mid-page, because the capture clicked a pad key and screenshotted a scrolled page. The
    capture script now scrolls back to the top first.

### The measurements, in numbers

- **Contrast:** the lowest value on any surface is **4.55 : 1** (the Shanghai sheet's
  `text-ink-faint` on `bg-sunken`); the rest run 4.94 – 5.35 : 1. Floor: 4.5 : 1.
- **Target size:** the smallest interactive element measured anywhere is **44 × 44 px**. Floor:
  44 × 44.
- **Overflow:** `scrollWidth == clientWidth` on the document **and** on `<body>` at every surface
  at 390 px.
- **Focus ring:** walked with real `Tab` presses, not a scripted `.focus()` — `:focus-visible` only
  matches a keyboard focus, so a scripted focus would report no ring on a control that has one.
  Every stop shows a 2 px cream outline.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, every element's transition and
  animation duration is 0.01 ms and no loop survives.
- **The board's documented deviation is mitigated, verified in the browser:** the 62-cell
  roving-tabindex grid (one tab stop, arrow keys move across the beds), the armed-band radio
  group, and a pad key for every outcome the board offers.

### The e2e gate

`e2e/visual-qc.spec.ts` is new: 9 tests, one per requirement, all passing. The existing
`e2e/game-center.spec.ts` needed **no** change — it already asserts the new rule sheet and the
new pad's accessible names (the task file's premise that it asserts the old gradient-card Game
Center is out of date; an earlier task in this plan had already rewritten it). The whole Playwright
suite: **38 passed, 7 skipped** (the pre-existing `test.skip`s).

### Gates

`npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build` are all green.
`npm run test`: **403 passed, 1 failed** — the failure is
`tests/integration/linkGuest.test.ts`, which needs PostgreSQL on `localhost:5432` and fails
identically before this task. No new failure.

### Two disagreements in the persisted documents

Both are recorded in `reports/design/04-implementation-qc.md` and neither is a defect in the build.

1. `DESIGN.md` §10.2 names a 520 px board at 1024; it measures **510 px**. The 16 px well padding
   the same paragraph specifies does not leave room for it beside the sheet column. The board
   yields rather than colliding, which is what its own caption promises.
2. `DESIGN.md` §10.2 says the sheet column is 420 px at 1024; `match.md` §8 says 400 px. The build
   follows the page override, 400 px.

### What was deliberately not done

The home route's *content* is out of this plan's scope ("only its presentation comes into the
system"), so it stays the entry point task 009 shipped, even though `home.md` §2.2 describes it as
carrying the Game Center's rule sheet. The fix, when the content is next in scope, is to extract
the sheet into a component both routes render — not to copy it.

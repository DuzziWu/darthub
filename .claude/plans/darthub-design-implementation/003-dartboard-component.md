# Task 003: Build the DartBoard SVG component

**Status**: completed
**Depends on**: 001, 002

**Files this task owns:** `src/components/board/**`. **Files this task does not touch:** `src/board/**` (task 002), `src/components/game/**` (task 007), the match views (tasks 005 and 008).
**Retry count**: 0

## Description
Render an authentic steel dartboard as an interactive React component. The SVG is authored in millimetres, so the picture and the scoring radii cannot drift apart, and a click on any bed resolves to the correct segment through the shared board module.

## Context
### Read first
- `design-system/darthub/board.md` — §2 (visual), §3 (colour system), §4 (geometry and the millimetre viewBox), §6 (interaction and highlighting), §8.3.2 (the target-size decision and its mitigation).
- `design-system/darthub/MASTER.md` §3.3 — the board material tokens.
- `DESIGN.md` §8.3 — the board component specification.

### Files
- `src/components/board/DartBoard.tsx` — new.
- `src/components/board/index.ts` — new barrel, matching `src/components/game/`'s pattern.
- `src/board/boardGeometry.ts` — the resolver from task 002. **Do not re-implement the geometry in the component.**

### The component's contract — tasks 005 and 008 depend on it
The board is a **pure presentational component**. It must not import the game engine, the camera layer or `next/*` — only `src/board/boardGeometry.ts` and React. Its props are the contract that tasks 005 and 008 build against, so they must be fixed here:

```ts
export type ArmedSegment = "single" | "double" | "triple";

export interface DartBoardProps {
  /** The armed band for the numeral route. Owned by the match view. */
  armedSegment: ArmedSegment;
  /** Fired with a resolved hit. `points` is 0 for a miss. */
  onThrow: (hit: { points: number; segment: ThrowSegment | null; label: string }) => void;
  /** Darts in the current visit, oldest first. Drives the hit markers. */
  markers?: ReadonlyArray<{ xMm: number; yMm: number; label: string }>;
  /** Read-only preview mode: no pointer input, no buttons, aria-hidden. */
  readOnly?: boolean;
}
```

**The board is a read-out of the armed band, not the control that sets it.** There is deliberately **no `onArmedSegmentChange` prop**: the pad's segment radio group is the only control that arms a band (`board.md` §6.5, settled during the design phase — the earlier draft specified the toggle in both columns and contradicted itself). The board *displays* the armed band outlined in brass; it does not host the segment keys. Task 007's pad spec must agree with this.

**The `--board-*` tokens are consumed by `var()` on the SVG nodes, not as utilities.** `--board-red`, `--board-green`, `--board-bull-inner`, `--board-bull-outer` and the rest are not a Tailwind namespace, so `fill-board-red` does not exist. Write `fill="var(--board-red)"` on the SVG elements (`MASTER.md` §3.3). Renaming them to `--color-board-*` would be wrong: they are the board's painted materials, not the interface's semantic colour roles.

Three consequences that follow from this and must hold:

1. **The armed segment is a single piece of state.** The pad arms it, the board's numeral route reads it, and the board outlines the armed band in brass. It lives in the match view and is passed down. If the board and the pad each hold their own copy they will disagree, and the two paths stop being "two views of one state" (`board.md` §6.5).
2. **`readOnly` is what makes the mobile preview honest.** Below 768 px the board is `readOnly` — `pointer-events: none`, no buttons, `aria-hidden="true"` — and the pad is the input. The component implements the mode; the match view chooses it.
3. **Markers are cleared when the turn ends**, not when the component unmounts (`board.md` §6.4: markers persist for the whole visit, up to three darts). The match view owns that lifecycle and passes the current visit's darts in.

### Rendering
- **`viewBox="-225.5 -225.5 451 451"`** — one user unit is one millimetre. The path coordinates *are* the scoring radii.
- **80 annular sector paths** — 20 sectors × 4 radial bands (inner single, treble, outer single, double). Each is an annular sector between the band radii, spanning 18° centred on its number.
- **20 radial steel spokes and 5 concentric rings** drawn as a dark groove with a lit edge — the wires are modelled metal, not hairline strokes. Ring radii: 15.9, 99, 107, 162, 170.
- **20 numerals** set radially in the number ring, centred at **r = 191 mm**, **28 mm** cap height, tops pointing **outward** (`board.md` §2.4: 20 at 12 o'clock is upright, 6 at 3 o'clock is rotated 90° clockwise, 3 at 6 o'clock is upside down).
- **Beds are inset.** `board.md` §4.2 requires a **0.6 mm radial inset** at every bed edge and a **0.6 mm arc inset** at each wedge edge, so the wire channel is a constant 1.2 mm. Without the inset the beds touch and the wires have nothing to sit in.
- **Materials, procedural and SVG-native — no bitmap assets and no third-party board artwork:**
  - sisal grain: `feTurbulence type="fractalNoise" baseFrequency="0.8 0.25" numOctaves="3"`, desaturated, composited `overlay` at **12–18 %**, masked to r ≤ 170;
  - brushed steel: anisotropic `feTurbulence baseFrequency="0.015 0.55"` at **8–12 %** over the number ring;
  - a warm key light (`#FFF3DC`, radial centred at **(-70, -90) mm**, 10 % at the source fading to 0 at 260 mm) and a **25 %** vignette;
  - a steel rim catching light on the upper left;
  - **no drop shadows** — the house system uses hairlines, not shadows.
- **Band colours alternate by sector position, not by band.** `board.md` §2.3: an **odd** position in the segment order gets a black single bed with **red** double and treble bands; an **even** position gets a light single bed with **green** double and treble bands. That is a real board's convention and it is what the design documents specify — a board where every treble is green and every double is red is not what `board.md` describes. The **semantic** tokens (`--color-treble`, `--color-double`) are a separate palette used by the score sheet, never by the painted beds.
- **Bull colours:** `--board-bull-inner` `#1B6B47` (inner bull, 50) and `--board-bull-outer` `#E4DAC4` (outer bull, 25) — DartHub inverts the physical convention deliberately (`board.md` §3.1) because red means a bust in this palette. **Apply both tokens together; a half-applied bull is a bug.**
- **Rendered size:** 600 px at 1440, **520 px** at 1024, 300 px at 390 (`board.md` §8.1–8.3). `pxPerMm = renderedSizePx / 451`. The 1024 figure is **520 px**, not 498 — `board.md` §8.2 specifies 520 px (1.153 px/mm) and §7.2's target-size measurements are computed from it.
- **The board sits inside a `bg-sunken` well** with a 1 px `rule` border (`board.md` §8.1): a lit object in a dark recess.

### Interaction
- A click resolves to board-plane millimetres via `toBoardMm` (negating y) and then through `resolveBoardHit`.
- **Hits are visually highlighted** — the struck bed is marked and a dart marker is left at the impact point.
- **Clicking a numeral throws the armed segment of that sector** (`board.md` §6.3). Arm `2×`, click the `13`, get D13. The number ring is not scorable as a bed — it is the sector selector. This is the same "armed band" state the pad uses, passed in as a prop.
- The board is a **pointer precision shortcut**. Its painted beds cannot meet a 44 × 44 px target (the treble band is 8 mm of a 451 mm board) and that is a documented deviation — see `board.md` §8.3.2. The mitigation must be implemented, not just cited:
  - the **armed-band + numeral** route — arm `1×` / `2×` / `3×`, then choose a number — which is the accessible equivalent and the keyboard path;
  - below 768 px the board is a **read-only preview** (`readOnly` prop: `pointer-events: none`, no buttons, `aria-hidden="true"`) and the dart pad is the input.
- The board is **one tab stop** containing a **roving-tabindex grid of 62 real `<button>`s** — 20 sectors × 3 beds (single, treble, double) plus the inner and outer bull (`board.md` §6.6). `Tab` enters at the current cell, `←`/`→` move a sector (wrapping 20 → 1 → 18 → …), `↑`/`↓` move a bed, `Enter`/`Space` throws the focused cell. Each button's accessible name is its outcome: `"Treble 20, 60 points"`, `"Outer bull, 25 points"`.
- **Focus on a thin bed needs two indicators** (`board.md` §6.6): a **2 px `--color-ink` outline directly on the bed** *and* a **1 px brass outline around the whole sector wedge** — the latter is at least 44 px across, so the focused cell is never ambiguous. A single outline on a 9 px band is not visible enough.
- The board announces the resolved throw to assistive technology. **The live region belongs to the match screen, not the board** — one `aria-live="polite"` region per match screen, announcing the phrase ("T20, 60 points. 140 remaining."), never the bare number (`board.md` §6.7, `DESIGN.md` §11).
- A click outside the playing surface is a **miss** (0 points), not a click that does nothing.

### Accessibility
- Every interactive element has an accessible name. Decorative elements are `aria-hidden`.
- The board is a `<div role="group" aria-label="Dartboard">` containing the 62 buttons (`board.md` §6.7).
- Focus rings are visible and are never removed. The house focus ring is 2 px `--color-ink` on the board's dark ground.
- `prefers-reduced-motion` is honoured — the marker and highlight transitions collapse, and the marker appears instantly with no pulse.

### Traps the design prototype actually hit — the tests must cover these
- The resolver's bearing was **180° out**, scoring T10 for T13.
- **360° ring paths degenerated**, so the outer bull and the armed-band outline did not render at all.
- The dart marker was **vertically mirrored** because board-plane y-up was used as SVG y-down.

## Requirements (Test Descriptions)
- [x] `it renders twenty sectors in the standard clockwise order from 20 at the top`
- [x] `it renders the treble and double bands alternating red and green by sector position`
- [x] `it renders alternating black and light single sectors`
- [x] `it renders the inner bull and the outer bull with their specified colours`
- [x] `it renders a visible number ring with twenty numerals at r = 191 mm`
- [x] `it renders a focusable roving-tabindex grid of 62 cells`
- [x] `it resolves a click on a treble bed to a triple throw`
- [x] `it resolves a click on the bull to a bull throw`
- [x] `it resolves a click outside the playing surface to a miss`
- [x] `it highlights the struck bed and marks the impact point`
- [x] `it offers an armed-band and numeral route as the keyboard equivalent`
- [x] `it renders the outer bull and the armed-band outline`
- [x] `it renders nothing interactive in read-only mode`

## Acceptance Criteria
- `src/components/board/DartBoard.tsx` exists and is the only place the board geometry is drawn.
- The SVG's `viewBox` is in millimetres and its paths use the radii from `BOARD_RADII_MM`.
- **The component imports only React and `src/board/boardGeometry.ts`** — no engine, no camera, no `next/*`. A grep for `game-engine` in `src/components/board/` returns nothing.
- The component contains **no bitmap assets** and no third-party board artwork.
- The rendered output is asserted in a jsdom test: the sector count, the band colours, the bulls and the numerals are checked, not just "it renders".
- The click resolution is asserted with a **specific** bed (T13 → triple, 39 points), not merely "a treble".
- The three prototype traps above have explicit tests.
- **The 62-cell roving grid is asserted**: 62 focusable cells exist, `←`/`→`/`↑`/`↓` move between them, and each cell's accessible name states its outcome.
- The component uses the token layer, not palette utilities.
- No file under `src/game-engine/` is modified.
- `npm run typecheck`, `npm run lint` and `npm run test` stay green (no new failures).

## Implementation Notes

### Files
- `src/components/board/DartBoard.tsx` — the component. Imports only `react` and
  `@/board/boardGeometry` (plus the `BoardSegment` type, re-exported as
  `ThrowSegment` from the same module). No engine, no camera, no `next/*`.
- `src/components/board/index.ts` — barrel exporting `DartBoard`, `ArmedSegment`,
  `DartBoardProps`.
- `tests/unit/board/dartBoard.test.tsx` — the jsdom test (named distinctly from
  task 002's `tests/unit/board/*.test.ts`).

`jsdom` was added as a devDependency: Vitest had no DOM environment and the
`@vitest-environment jsdom` docblock needs the package present.

### The shipped contract

```ts
export type ArmedSegment = "single" | "double" | "triple";

export interface DartBoardProps {
  armedSegment: ArmedSegment;
  onThrow: (hit: { points: number; segment: ThrowSegment | null; label: string }) => void;
  markers?: ReadonlyArray<{ xMm: number; yMm: number; label: string }>;
  readOnly?: boolean;
}
```

`ThrowSegment` is `BoardSegment` re-exported from `@/board/boardGeometry` — the
same alias `src/game-engine/types.ts` uses, so there is still exactly one
definition of the segment vocabulary. A miss is `{ points: 0, segment: null,
label: "MISS" }`.

### How the 80 annular sector paths are generated

`BANDS` is a four-entry table of the painted radial bands, radii read from
`BOARD_RADII_MM`: inner-single (15.9→99), treble (99→107), outer-single
(107→162), double (162→170). `BOARD_SEGMENT_ORDER.flatMap` walks the 20
sectors; for each, sector *i* is centred on bearing `i × 18°` clockwise from 12
o'clock, and `bedPath(r0, r1, bearing)` builds the annular sector:

- radial inset of 0.6 mm at both edges (`r0 + 0.6`, `r1 − 0.6`);
- angular inset of 0.6 mm of arc at each wedge edge, measured at the band's mean
  radius: `trimDeg = 0.6 / meanRadius` (radians → degrees), subtracted from the
  9° half-angle;
- the path is `M outer(a0) A r1 r1 0 0 1 outer(a1) L inner(a1) A r0 r0 0 0 0
  inner(a0) Z` — `sweep-flag 1` because increasing bearing is clockwise on
  screen, `sweep-flag 0` on the way back.

Fills alternate by **position**, not by band or by number: sector index *i*
even (odd 1-based position) → black bed + red treble/double; odd → light bed +
green treble/double. Bulls use `ring()` — the outer bull is an annulus
(6.95 → 15.3 mm) and the inner bull a disc (r = 5.75 mm), both painted with
their own token.

`ring(rOuter, rInner)` draws every full circle as **two half arcs**. This is
the fix for the prototype trap: a single 360° arc has coincident endpoints, is
dropped by the renderer, and the ring vanishes.

### The roving-tabindex grid

62 real `<button>`s live in an `sr-only` container inside the
`role="group" aria-label="Dartboard"` wrapper: 20 sectors × 3 beds (double,
treble, single — outermost row first) plus the inner and outer bull. Each
button's accessible name is its outcome ("Treble 20, 60 points", "Outer bull,
25 points").

`focusedCell` is the roving cursor. The cell that holds it has `tabIndex={0}`,
the other 61 have `tabIndex={-1}`, so the grid is **one tab stop** and `Tab`
enters at the current cell. Arrow keys are handled on the container's
`onKeyDown`: `←`/`→` move a sector within the row (wrapping 20 → 1 → 18 → …),
`↑`/`↓` move a band, and the bulls sit at the inner end of the column. The
target is focused programmatically via `querySelector('[data-cell="n"]')`.

Focus is drawn on the SVG in **two** indicators, because a 9 mm band cannot
carry one: a 2 px `--color-ink` outline directly on the bed, and a 1 px brass
outline around the whole sector wedge (≥ 44 px across). The focus group only
renders while the grid actually holds focus.

### Interaction

- Bed clicks: `getBoundingClientRect()` → `toBoardMm(dx, dy, pxPerMm)` →
  `resolveBoardHit`. The SVG's y grows downward and the board frame's y grows
  upward, so `toBoardMm` negates y — this is why the marker is placed with the
  y negated.
- Numeral clicks throw the **armed** segment of that sector (armed `2×`, click
  `13` → D13, 26 points) and stop propagation so the bed resolver does not also
  fire.
- A click outside the playing surface is a miss: `{ points: 0, segment: null,
  label: "MISS" }`.
- The struck bed is highlighted in brass and a dart marker is left at the
  impact point. The marker is a 2.4 mm disc, a 9 mm shaft and two 3.4 mm
  vanes. If the `markers` prop already carries a dart at that point the
  internal one is suppressed, so a dart is never drawn twice.
- `readOnly` renders no buttons, sets `aria-hidden="true"` and
  `pointer-events: none`, and the click handler returns early.

### Materials

All procedural and SVG-native: `feTurbulence` sisal grain (`0.8 0.25`,
3 octaves, 15 % overlay) masked to r ≤ 170, anisotropic brushed steel
(`0.015 0.55`, 10 % overlay) over the number ring, a `#FFF3DC` key light
centred at (−70, −90) mm fading out at 260 mm, a 25 % vignette, and a steel
rim catching the light on the upper left. No bitmap assets, no drop shadows.
`prefers-reduced-motion: reduce` collapses the marker pulse and the highlight
transition.

### Tests

14 tests in `tests/unit/board/dartBoard.test.tsx`, all asserting rendered
output rather than "it renders". The three prototype traps each have an
explicit test, and each was **verified by mutation** (breaking the
implementation and confirming the test fails):

| Trap | Test | Mutation that must fail |
| --- | --- | --- |
| Bearing 180° out | `resolves a click on a treble bed to a triple throw` (T13 → 39 pts) | negating the resolved x |
| 360° ring paths degenerated | `renders the outer bull and the armed-band outline` | dropping one half arc from `ring()` |
| Marker vertically mirrored | `highlights the struck bed and marks the impact point` | removing the y negation from the marker transform |

The degenerate-circle detector splits a path on `M` and asserts every
sub-path carries at least two `A` commands — counting arcs across the whole
path would not catch a single broken circle.

### Verification

- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `npm run format:check` → exit 0
- `npm run test` → 327 passed, 1 failed. The single failure is
  `tests/integration/linkGuest.test.ts`, which is **pre-existing and
  environmental** (it needs a PostgreSQL server on `localhost:5432`); it is the
  same failure the baseline reported before this task.
- `npm run build` → exit 0; the compiled CSS contains `.w-\[300px\]`,
  `.lg\:w-\[520px\]` and `.xl\:w-\[600px\]`, so the 300 / 520 / 600 px sizes
  ship.
- The board was rendered to static markup and screenshotted in Chromium to
  confirm the sector order, the alternating band colours, the bulls, the
  radially-set numerals, the brass armed-band outline and the dart marker.
  The screenshots were scratch artefacts and have been deleted.

### Not done (deliberately)

- No `onArmedSegmentChange` prop: the pad's segment radio group is the only
  control that arms a band. The board is a read-out.
- The live region belongs to the match screen, not the board, so none is
  rendered here.
- The board's 62 buttons are visually hidden (`sr-only`): the pointer path is
  the painted beds, and the buttons exist for keyboard and AT. The focus
  indicator is therefore drawn on the SVG, not by the browser on the button.

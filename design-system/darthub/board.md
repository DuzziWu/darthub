# DartHub — The Board

> **Component specification.** The dartboard, the shared board-geometry module, the
> segment-aware throw input, the three board source modes and the match layout.
> Overrides `design-system/darthub/MASTER.md` where stated. `DESIGN.md` §8.3 is the
> narrative reference; this file is the numbers an implementer codes against.

---

## 1. What this is

**A realistic steel dartboard, rendered as a real object, that is also the throw input.**

It is not a target disc and not a decorative circle graphic. It is a lit steel-and-sisal
object with authentic radial proportions, visible wire separators, alternating sisal
beds, painted scoring bands, a printed number ring, and procedural material texture.

**The board is the primary pointer path.** A mouse click on a painted bed scores exactly
that bed. **The Dart Pad is the keyboard, touch and screen-reader path.** Both are the
same model — _a segment and a sector_ — and both feed one `throw()` call that always
carries `segment`, which is what makes Double Out winnable.

---

## 2. Geometry — the numbers

Standard Winmau/PDC board. **451 mm overall diameter** (radius 225.5 mm), 340 mm playing
surface (radius 170 mm). Every radius below is in **millimetres, measured from the board
centre**.

| Feature                    | Inner r (mm) | Outer r (mm) |
| -------------------------- | ------------ | ------------ |
| Inner bull (50)            | 0            | 6.35         |
| Outer bull (25)            | 6.35         | 15.9         |
| Inner single bed (1×)      | 15.9         | 99           |
| Treble band (3×)           | 99           | 107          |
| Outer single bed (1×)      | 107          | 162          |
| Double band (2×)           | 162          | 170          |
| Number ring (not scorable) | 170          | 225.5        |

### 2.1 Segment order

**Clockwise from 20 at 12 o'clock:**
`20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5`

Each segment spans **18°**, centred on its number. Segment _i_ (0-based in the order above)
is centred at **α = i × 18° clockwise from 12 o'clock**; its wedge runs α ± 9°.

### 2.2 Radial resolution order

From the centre outward, the first band whose radius range contains the hit decides:

| Order | Band             | r (mm)      | Segment  | Points       |
| ----- | ---------------- | ----------- | -------- | ------------ |
| 1     | Inner bull       | 0 – 6.35    | `bull`   | 50           |
| 2     | Outer bull       | 6.35 – 15.9 | `bull`   | 25           |
| 3     | Inner single bed | 15.9 – 99   | `single` | n            |
| 4     | Treble band      | 99 – 107    | `triple` | 3n           |
| 5     | Outer single bed | 107 – 162   | `single` | n            |
| 6     | Double band      | 162 – 170   | `double` | 2n           |
| 7     | Number ring      | 170 – 225.5 | —        | **0 (miss)** |
| 8     | Off board        | > 225.5     | —        | **0 (miss)** |

Boundary values belong to the **inner** band of the pair (`r ≤ 6.35` is the inner bull;
`r ≤ 15.9` is the outer bull; `r ≤ 99` is the inner single bed, and so on).

### 2.3 Alternation is positional, not numeric

**Odd position** in the order above (1-based: 20, 18, 13, 10, 2, 3, 7, 8, 14, 12) →
**black single bed, red double and treble bands.**
**Even position** (1, 4, 6, 15, 17, 19, 16, 11, 9, 5) → **light single bed, green double
and treble bands.**

This is a real board's convention: the bed colour and the band colour are decided by where
the sector sits, not by whether its number happens to be odd.

### 2.4 Radial orientation of the numerals

The number ring is printed with **cream numerals whose tops point outward**: 20 at 12
o'clock is upright, 6 at 3 o'clock is rotated 90° clockwise, 3 at 6 o'clock is upside down.
Numerals are centred at **r = 191 mm** and set at **28 mm cap height**.

---

## 3. Colour and material

**The board is an object, not UI chrome.** Its colours are _paint and sisal_, drawn from a
separate `--board-*` token family, and they never double as UI state colours. This is the
one place where the system permits material colour, texture and gradient — the surface
rules in `MASTER.md` §7 (no shadows) and `DESIGN.md` §3.3 (no gradients) govern **UI
surfaces**, and the board is a rendered object with depth, not a surface.

| Token                 | Hex       | Material                       |
| --------------------- | --------- | ------------------------------ |
| `--board-sisal-dark`  | `#141416` | painted black sisal bed        |
| `--board-sisal-light` | `#D9CFBA` | natural sisal bed              |
| `--board-red`         | `#A32B22` | red double/treble band paint   |
| `--board-green`       | `#1B6B47` | green double/treble band paint |
| `--board-bull-inner`  | `#1B6B47` | inner bull (50)                |
| `--board-bull-outer`  | `#E4DAC4` | outer bull (25)                |
| `--board-ring`        | `#0E0E10` | number ring body               |
| `--board-numeral`     | `#E8E2D4` | printed numerals               |
| `--board-wire`        | `#7A7A82` | steel wire separators          |
| `--board-steel`       | `#33333A` | outer steel surround           |

### 3.1 Divergence from a physical Winmau board — deliberate, and reversible

A Winmau/PDC board has a **green outer bull and a red inner bull**. DartHub inverts this:
**inner bull green, outer bull cream.** Rationale: in DartHub's palette **red means a
bust** and green means a counted target, so a red bull would collide with bust semantics
the moment it is rendered next to the score sheet; cream keeps the centre from shouting.
This is a **two-token change** (`--board-bull-inner`, `--board-bull-outer`) if the
orchestrator prefers physical convention — and it must not be half-applied.

### 3.2 Texture and lighting model

Four material treatments, all procedural, all SVG-native (no bitmap assets, no
third-party board artwork):

| Treatment         | Technique                                                                                                                   | Strength                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Sisal grain**   | `feTurbulence type="fractalNoise" baseFrequency="0.8 0.25" numOctaves="3"`, desaturated, composited `overlay` over the beds | 12–18 % opacity, masked to the bed area (r ≤ 170) |
| **Brushed steel** | anisotropic `feTurbulence baseFrequency="0.015 0.55"` + a linear gradient, over the number ring                             | 8–12 % opacity                                    |
| **Key light**     | radial gradient, centre **(-70, -90) mm** (up and to the left), warm white `#FFF3DC`                                        | 10 % at the source, fading to 0 at 260 mm         |
| **Vignette**      | radial gradient, transparent at centre → **25 % black** at the rim                                                          | multiplies the whole face                         |

The face is therefore **lit from the upper left**, sitting in a dark room, with the
outside of the board falling away into shadow. A single additional specular highlight is
permitted on the outer steel edge, upper-left quadrant only.

**No drop shadows.** The board's depth comes from the vignette and the key light, not from
a cast shadow.

---

## 4. Rendering approach — SVG in millimetres

**The SVG's user unit IS one millimetre.**

```
<svg viewBox="-225.5 -225.5 451 451" ...>
```

The board centre is the SVG origin, `+x` is right, `+y` is **down** (SVG convention), and
the board's 12 o'clock direction is `-y`. Because the viewBox is in millimetres, **the
rendered path coordinates and the scoring resolver read the same constants** — the picture
and the rules cannot drift apart.

### 4.1 Layer order (bottom to top)

1. **Face disc** — `r = 225.5`, `--board-ring` fill.
2. **Beds** — 20 sectors × 4 radial bands (double, outer single, treble, inner single) = 80
   paths, each an annular sector.
3. **Bull** — outer bull annulus (6.35 → 15.9), inner bull disc (r = 6.35).
4. **Wire** — concentric rings at r = 15.9, 99, 107, 162, 170 and 20 radial spokes at
   every 9° boundary from r = 15.9 to r = 170, `--board-wire`, 0.5 mm wide, with a
   1-px lighter highlight above.
5. **Numerals** — 20 `<text>` elements, rotated so their tops point outward.
6. **Bull labels** — `50` on the inner bull, `25` on the outer bull, small, low contrast.
7. **Texture overlays** — sisal (masked to r ≤ 170), brushed steel (over the ring).
8. **Lighting** — key light and vignette, `mix-blend-mode: screen` / `multiply`.
9. **Hit markers** — one per dart in the current visit.

### 4.2 Sector path construction (implementable)

For sector _i_ and band `(r0, r1)`:

- Centre angle α = i × 18°, half-angle 9°.
- **Radial inset 0.6 mm** at every bed edge — the sisal beds do not touch; the wire
  channel between them is 1.2 mm wide and the steel wire sits in it.
- **Angular inset:** each wedge is trimmed by **0.6 mm of arc** at both edges, measured at
  the band's mean radius, so the gap is a constant 1.2 mm of arc all the way round rather
  than a widening wedge near the centre.
- The wedge is an SVG arc path: outer arc from α+9°−δ to α−9°+δ at radius `r1`, line in to
  `r0`, inner arc back, close.

### 4.3 Why this is not a "generic SVG circle graphic"

| Generic circle graphic                   | This board                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| One filled `<circle>` with stroked rings | 80 individually authored annular-sector paths                                 |
| Rings are decoration                     | Rings are the scoring bands, and their radii are the resolver's radii         |
| Uniform fill                             | Alternating painted-black and natural-sisal beds, alternating red/green bands |
| No boundary                              | 20 radial steel wires + 5 concentric wires, drawn as metal, not strokes       |
| Flat                                     | Procedural sisal grain, brushed steel, an off-centre key light, a vignette    |
| No numbers                               | 20 printed numerals, radially oriented                                        |
| Unrelated to the rules                   | Geometry and scoring read the **same constants**                              |

---

## 5. The shared board-geometry module

**One module. Two consumers. No third implementation.**

```
src/board/boardGeometry.ts
src/board/boardSource.ts
src/board/index.ts
```

**Why `src/board/`** — the repo uses **flat feature folders** under `src/`
(`ai, auth, camera, career, components, friends, game-engine, privacy, rating, realtime`).
There is no `src/domain/` and no `src/game/`; `.claude/architecture.md` lists both but that
document is aspirational and stale. The board is a **feature**, exactly like `camera/` and
`career/`, and it sits beside them.

It is deliberately **not** inside `src/game-engine/`, because the board is not a game rule,
and it is deliberately **not** inside `src/camera/`, because the camera is one consumer of
the board, not its owner. `src/board/boardSource.ts` holds the board-source vocabulary
(`BoardSourceId`, `BoardSource`, and the three source definitions) — the same reasoning
applies: a board source is board vocabulary, not a camera type and not a UI type.

**Constraints:** pure TypeScript. No DOM, no React, no Node built-ins, no filesystem.
Importable unchanged by the browser, the game server and the CV pipeline.

### 5.1 Public API

```ts
export const BOARD_DIAMETER_MM = 451;

export const BOARD_RADII_MM: Readonly<{
  innerBull: 6.35;
  outerBull: 15.9;
  innerSingleOuter: 99;
  trebleOuter: 107;
  outerSingleOuter: 162;
  doubleOuter: 170;
  numberRingOuter: 225.5;
}>;

export const BOARD_SEGMENT_ORDER: readonly number[]; // 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5

export type BoardSegment = "single" | "double" | "triple" | "bull";

export interface BoardHit {
  readonly segment: BoardSegment;
  readonly points: number; // 0..60, or 25 / 50 for the bulls
  readonly sector: number | null; // 1..20 for a sector, null for a bull
  readonly label: string; // "T20", "D16", "S7", "BULL 50", "BULL 25", "MISS"
}

export type BoardResolution =
  | { readonly hit: false; readonly points: 0; readonly label: "MISS" }
  | ({ readonly hit: true } & BoardHit);

/** Resolve a board-plane point, in millimetres, to a scored throw. */
export function resolveBoardHit(xMm: number, yMm: number): BoardResolution;

/** Convert a pixel offset from the board centre into board-plane millimetres. */
export function toBoardMm(
  dxPx: number,
  dyPx: number,
  pxPerMm: number,
): { xMm: number; yMm: number };
```

### 5.2 Units and coordinate frame — and camera compatibility

**Everything is millimetres in the board plane.** Origin at the **board centre**,
**x positive = right, y positive = above centre.**

This is _exactly_ the frame `CameraDTO` already uses (`src/camera/CameraDTO.ts`: "negative =
left of centre, positive = right of centre"; "negative = below centre, positive = above
centre") and _exactly_ the frame `Perspective.transform` already produces
(`src/camera/vision/Perspective.ts`: "board-plane millimetres relative to the centre of the
board (x positive = right, y positive = above centre)"). **No conversion, no adapter, no
new convention.**

| Consumer        | Path into the resolver                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI click        | SVG client point → pixels from centre → `toBoardMm(dx, dy, pxPerMm)` — **`dy` is negated**, because SVG's y grows downward while the board frame's y grows upward → `resolveBoardHit` |
| Camera (future) | `HitDetector.detect()` receives a `DetectedDartImpact { xMm, yMm }` → `resolveBoardHit(impact.xMm, impact.yMm)` → the `CameraDTO` it already returns                                  |

**The SVG's viewBox is in millimetres** (§4), so `pxPerMm` is a single number per render:
`renderedSizePx / 451`.

**`HitDetector`'s documented intent already names this algorithm** — _"radius rings
(double/triple/small-bull/bull) and the 20 angular wedges (20 at the top, clockwise 1, 18,
4, …)"_. The implementation replaces that prose with a call to `resolveBoardHit`. **The CV
pipeline must not re-implement the geometry.**

### 5.3 The segment must join the camera throw path

`CameraDTO` currently carries only `score`. **That is not enough, and it must change.**

A score alone is ambiguous about its band: **24 points is D12 or T8; 30 points is D15 or
T10; 40 points is D20 only.** A camera that reports `score: 24` cannot tell the engine
whether the dart was a double, so **Double Out would be unwinnable from a camera** even
after the UI is fixed.

**Therefore `CameraDTO` gains a `segment` field** (`"single" | "double" | "triple" | "bull"`),
populated by `resolveBoardHit` and populated by the same code path that fills `score`.
The camera and the virtual board then submit **identical** `ThrowInput` to the engine, and
the checkout rule behaves the same in both.

`CameraDTO.segment` is added as **optional** in the current build so existing stub
producers keep compiling; the CV phase makes it required.

### 5.4 The one true segment type

`src/game-engine/types.ts` already declares
`export type ThrowSegment = "single" | "double" | "triple" | "bull"`. That is identical to
the board's segment vocabulary. To avoid two definitions drifting apart:

- `src/board/boardGeometry.ts` owns `BoardSegment`.
- `src/game-engine/types.ts` re-exports it: `export type { BoardSegment as ThrowSegment } from "@/domain/board/boardGeometry";`

The existing `ThrowSegment` name and every current usage stay valid; there is exactly one
definition.

---

## 6. Interaction

### 6.1 Two ways to throw — one model

|                    | **Board (pointer)**                                 | **Dart Pad (keyboard / touch / AT)**  |
| ------------------ | --------------------------------------------------- | ------------------------------------- |
| Choose the segment | Click the painted bed (band determines the segment) | Armed-segment key: `1×` / `2×` / `3×` |
| Choose the sector  | The bed you clicked                                 | A number key 1–20                     |
| Bull               | Click the inner or outer bull                       | Key `50` / key `25`                   |
| Miss               | Click the number ring or off the board              | Key `MISS`                            |
| Result             | `{ points, segment }`                               | `{ points, segment }`                 |

**Both call the same `throw(points, segment)`. Neither path can produce a throw without a
segment.**

### 6.2 Board clicks

A click on the board resolves **literally**:

1. Convert the click to board-plane millimetres (§5.2).
2. `resolveBoardHit` decides band and sector.
3. Score it.

Consequences, all intended:

- Clicking the **treble band** of 13 → **T13, 39 points**.
- Clicking the **outer bull ring** → **25**, `segment: "bull"`.
- Clicking the **inner bull** → **50**, `segment: "bull"`.
- Clicking the **number ring** or outside the board → **miss (0)**. The number ring is not
  scorable, exactly as on a real board.

### 6.3 The number ring is the sector selector — and the armed segment

The number ring is **not scorable**, but it carries the 20 numerals and is the board's
**largest target**. So:

- **Clicking a numeral** throws the **armed segment** of that sector. Armed `2×` and click
  the `13` → **D13, 26 points**.
- The **armed segment** is a persistent control (the `1× / 2× / 3×` toggle, §6.5) and is
  **shown on the board**: the armed band is outlined in brass. So "armed = double" is
  visible on the board itself, not only in the control.
- The caption under the board states the rule in one line:
  _"Tap a bed to score it, or tap a number to score the armed band."_

This is what makes the board usable on a small screen and with a trackpad, where a 9-pixel
treble band is not a fair target.

### 6.4 Hit feedback

Every throw leaves a **dart marker** on the board at the exact resolved point:

- A 2.4 mm filled disc in `--board-numeral` with a 0.5 mm brass ring.
- A **shaft** drawn outward from the centre at the hit's angle, 9 mm long.
- A **flight** — two 3.4 mm vanes at the end of the shaft.

Markers **persist for the whole visit** (up to three darts) and are **cleared when the turn
ends**, so the board shows the player their own visit. The visit's darts are also named in
the throw strip along the top of the match view (`T20`, `D16`, `S7`, `BULL 50`, `MISS`).

Under `prefers-reduced-motion: reduce` the marker appears instantly, with no transition and
no pulse.

### 6.5 The Dart Pad — the keyboard, touch and screen-reader path

**The pad is redesigned.** The current `ThrowInputPad` offers 39 raw point values, which
(a) cannot express a segment, so it can never win a Double Out, and (b) splits into blue
and purple for no darts-related reason.

**New pad:**

| Group                                          | Keys                                           | Size                  |
| ---------------------------------------------- | ---------------------------------------------- | --------------------- |
| **Segment** (radio group, `role="radiogroup"`) | `1× Single` · `2× Double` · `3× Treble`        | ≥ 44×44               |
| **Sector**                                     | `1` … `20`                                     | ≥ 44×44, ≥ 8 px apart |
| **Bull / miss**                                | `50` (inner bull) · `25` (outer bull) · `MISS` | ≥ 44×44               |

- Every key's **visible label** is its value; its **accessible name** states the outcome:
  the `20` key is `"20"` visually and `"Treble 20, 60 points"` when Treble is armed. The
  armed segment is **announced** by the group label, which reads e.g. `SEGMENT: TREBLE ×3`.
- `MISS` is a first-class key, distinct from `0`.
- The bull keys `50` and `25` are separate: they are different segments of the board and
  Double Out treats a bull differently from a double.
- Layout: 4 columns × 5 rows of sector keys (20 keys), segment row above, bull/miss row
  below.

**Relationship to the board:** the pad is not a fallback for a broken board. It is the same
model expressed as discrete, conformant controls. The **armed segment is shared** — arming
`3×` in the pad changes what the board's numerals score _and_ is shown on the board as the
brass band outline. The two surfaces stay in sync; they are two views of one state.

### 6.6 Keyboard path on the board itself

The board is **one tab stop** with a **roving-tabindex grid** of 62 real `<button>`s
(20 sectors × 3 beds, plus inner bull and outer bull):

- **Tab** enters the board at the current cursor cell; **Shift+Tab** leaves.
- **← / →** move one sector (wrapping 20 → 1 → 18 → …), **↑ / ↓** move one band
  (outer single → treble → inner single, and the bulls sit at the inner end).
- **Enter / Space** throws the focused cell.
- Every cell's accessible name is its outcome: `"Treble 20, 60 points"`,
  `"Outer bull, 25 points"`, `"Inner bull, 50 points"`.

**Focus indication on a 9-pixel bed.** A focus ring on a treble band would be invisible, so
the focused cell gets **two** indicators:

1. a **2 px cream outline directly on the bed**, and
2. a **1 px brass outline around the whole sector wedge** (or around the bull zone) — an
   indicator that is at least 44 px across, so the focused cell is unmistakable at any
   viewport.

This satisfies SC 2.4.7 Focus Visible (AA) with room to spare, and it satisfies SC 2.4.11
Focus Appearance (2.2, AA) for the 2 px indicator.

### 6.7 Screen reader

- The board is a `<div role="group" aria-label="Dartboard">` containing the 62 buttons.
  Each button's accessible name is the outcome it would score.
- A **single `aria-live="polite"` region** for the whole match screen announces the throw
  and the new remaining score: _"Treble 20, 60 points. 140 remaining."_ — the phrase, never
  the bare number.
- The pad is a normal set of buttons; the radio group uses `aria-checked` on the armed
  segment, and the armed segment is also in the group's visible label.
- Nothing about the board depends on colour: bed colour is redundant with band position,
  and every state carries a word.

### 6.8 Wiring into the engine

```ts
// every scoring throw, from every source
engine.recordThrow({ playerId, points, segment });

// a miss — the segment is omitted, not null
engine.recordThrow({ playerId, points: 0 });
```

The `segment` field on `ThrowInput` already exists and `GameEngine.validateThrowInput`
already validates it via `isValidSegmentScore` — it was simply never sent.
`ThrowInputPad`'s `onThrow` prop changes from `(points: number) => void` to
`(throw: { points: number; segment?: ThrowSegment }) => void`.

**The one exception is a miss.** `isValidSegmentScore` returns `false` for any
`points <= 0`, so a miss submitted with a segment is a **validation error**, not a
zero-scoring throw. The miss is `{ points: 0 }` with the `segment` field **omitted**.

#### 6.8.1 The bust is a thrown error — the UI computes it

`StandardMode.applyThrow` **throws** `GameEngineStateError("Bust: …")` when a dart busts,
and `GameEngine.recordThrow` propagates it. **A bust never reaches the UI as a state** —
the engine leaves the match state untouched.

So the board and pad views must compute the bust themselves, before submitting:

1. The UI knows the out rule in force, the player's remaining score, and the dart's
   `{ points, segment }`. That is enough to determine that the dart busts.
2. It must **not** infer a bust from the absence of a state change, and it must **not**
   string-match the error message — "not your turn" is also a `GameEngineStateError`, and
   a string match would report a bust for it.
3. A bust **does not consume a dart** (the engine leaves `throwsInCurrentTurn` untouched) and
   **does not end the turn** (the engine keeps the same `currentPlayerId`). The BUST chip
   is therefore UI-local state for the current visit.

The visit strip is assembled from **two** sources: the engine's returned state for the
counted darts, and a small UI-local record for the busted dart.

#### 6.8.2 The non-x01 modes do not read `segment`

**Cricket, Around The Clock and Shanghai derive everything from `points` and ignore
`segment` entirely.** For those three modes the board's segment is a **UI label only** — it
is displayed in the visit badge (`T20`, `D16`, `S7`) but it is not what the mode scores
against.

- **Do not derive the point value from the segment.** A triple and a single of the same
  number are different marks, and the modes distinguish them by `points` alone
  (`2 × target` vs `3 × target`). The board's `points` already carries that distinction.
- **In cricket the two bulls are not interchangeable.** `CricketMode.toSegmentHit(points)`
  maps `25` → bull for **one** mark and `50` → bull for **two** marks. The board's inner
  bull (50) counts as two marks; its outer bull (25) counts as one. This is exactly why the
  board has two bull regions and the pad has two bull keys.

---

## 7. Target size — the accessibility decision

### 7.1 Which criterion governs

**WCAG 2.2 SC 2.5.8 _Target Size (Minimum)_, Level AA — 24 × 24 CSS px**, with its
exceptions (spacing, inline, user-agent control, essential).

SC 2.5.5 _Target Size (Enhanced)_ (44 × 44, Level AAA) is the **house floor for controls**,
adopted in `DESIGN.md` §11, and it is applied to every control in DartHub — the pad keys,
the segment toggle, the buttons, the nav.

**The 44 px house floor is a control floor, not a board floor.** The board is not a set of
buttons with 44 px boxes; it is a picture whose regions happen to be targets.

### 7.2 The measured problem

On a **600 px** board (1.330 px/mm), measured as the **clickable** dimension — the thickness
of a band, not the bounding box of a curved wedge:

| Target              | Clickable size                       | 2.5.8 (24 px)         | 2.5.5 (44 px)   |
| ------------------- | ------------------------------------ | --------------------- | --------------- |
| Treble band cell    | **43 × 10.6 px** (arc × thickness)   | **FAIL**              | **FAIL**        |
| Double band cell    | **69 × 10.6 px**                     | **FAIL**              | **FAIL**        |
| Inner bull          | **16.9 px** across                   | **FAIL**              | **FAIL**        |
| Outer bull          | 42 px across, **12.7 px** ring width | **FAIL** (ring width) | **FAIL**        |
| Single bed cell     | 56 × 110 px                          | PASS                  | PASS (one axis) |
| Number-ring numeral | 82 × 74 px cell (glyph ~19 × 29)     | PASS (cell)           | PASS (cell)     |

**The spacing exception in 2.5.8 does not rescue them**: the beds are separated by a
1.2 mm wire channel, so a 24 px circle centred on a treble cell intersects its neighbours.
And the **"essential" exception does not apply either**, because the _function_ — throwing a
treble — is available through other, conformant targets. Claiming it would be dishonest.

**And it cannot be fixed by making the board bigger.** For the treble band to be 24 px
tall, the board would have to be **1,353 px** across, and for 44 px, **2,480 px** — larger
than any viewport, and larger than the board is on a real wall. **The treble band is 8 mm
of a 451 mm board. That ratio is the sport.**

### 7.3 The decision

> **The painted beds are a precision shortcut for pointer users. They are not the only way
> to throw anything, and every throw they offer is also offered by controls that meet the
> 44 px house floor. The board's sub-24 px targets are a documented deviation, disclosed
> here rather than papered over.**

**What makes it conformant in practice:**

1. **Complete duplication.** Every outcome reachable by clicking a bed is reachable
   through the **armed-segment + numeral** route (§6.3) and through the **pad** (§6.5),
   whose targets are ≥ 44 × 44. There is no dart that can only be scored by a 10-pixel
   target.
2. **The board makes the conformant route obvious.** The armed band is outlined in brass
   _on the board_; the caption states the rule in one line.
3. **Keyboard parity.** The board's roving-tabindex grid (§6.6) exposes all 62 outcomes as
   real buttons with real names, and keyboard operation is not constrained by pointer
   target size at all. The focus indicator on a thin bed is a full-sector brass outline, so
   it is never ambiguous.
4. **Touch is not offered a 10-pixel target.** At < 768 px the board is a **read-only
   preview** showing the last dart's landing (§8.3) and the pad is the input. A finger is
   ~40 px wide; a 10-pixel band would be a lie.

**The honest trade-off, stated once:** a player with a mouse can score a treble on the board
in one click, and a player with a finger or a keyboard cannot do it in one click — they arm
`3×` and then tap the number. The board is faster for the mouse; the pad is universal.
**We are not claiming SC 2.5.8 conformance for the painted-bed targets, and we are not
claiming we could.**

### 7.4 What supersedes

`DESIGN.md` §8.3.1 (previous round) derived a 512 px board from a **44 px square sector
button** on a number ring, with the sectors _outside_ the double ring. That derivation is
**withdrawn**. It described a different, simpler object. The geometry in §2 above is the
real board, and the 44 px floor now binds the pad and the controls.

---

## 8. Layout

### 8.1 1440

```
┌────────────────────────────────────────────────────────────────────┐
│ 501  DOUBLE OUT                    T20  T20  D16        [UNDO] [⋯] │ ← throw strip, 56 px
├──────────────────────────────────────┬─────────────────────────────┤
│                                      │  PLAYERS                    │
│            ╭───────────────╮        │  ┃ Dave    140  T20 T20 D16  │
│            │               │        │    Sam    132  S7  T19 T13  │
│            │   THE BOARD   │  600px │  ┃ Priya  168  BUST          │
│            │   (in a well)│        │  ─────────────────────────── │
│            ╰───────────────╯        │  SEGMENT  [1×][2×][3×]       │
│   (armed band outlined in brass)     │  DART PAD (1–20, 50, 25,    │
│                                      │            MISS)            │
└──────────────────────────────────────┴─────────────────────────────┘
```

- **Throw strip across the top, full width, 56 px.** Mode name, checkout badge, the
  current visit's darts as segment chips, and the two actions.
- **Left column:** the board, 600 px, centred in a `bg-sunken` well with a 1 px `rule`
  border — the board is a lit object in a dark recess, which is the "board, after dark"
  direction made literal. The board **shows** the armed band as a brass outline; it does
  not host the segment control.
- **Right column, 480 px:** the score sheet (ruled rows, per `DESIGN.md` §8.3), then the
  **dart pad** — whose first group is the **segment radio group** (`1×` / `2×` / `3×`),
  followed by the 20 sector keys, `50`, `25` and `MISS`.
- **There is exactly one armed-segment control, and it is the pad's segment radio group**
  (board.md §6.5). The board receives the armed segment as a prop and **displays** it —
  the brass band outline — but offers no second set of segment keys. The `DartBoard`
  component contract has no armed-segment change handler, which is what makes this
  unambiguous: the board cannot be the control's owner.

  > The earlier draft of this section drew the segment toggle in **both** columns and
  > carried an unresolved note about which one was correct. That is settled: the control
  > is the pad's radio group; the board's brass outline is the read-out.

### 8.2 1024

- Content width 960 px.
- **Board 520 px** (1.153 px/mm; treble band 9.2 px tall — still a shortcut, still
  duplicated), well padding reduced to 8 px. The thinner well padding is what buys the
  520 px board beside a 400 px score column in a 960 px content width; at 1440 the
  padding returns to 16 px.
- **Right column 400 px:** score sheet rows compress to `name · score · last visit`;
  the pad stays 4 columns wide.
- The throw strip loses the mode name's subtitle and keeps the badges.

### 8.3 390

**A board that cannot shrink without destroying the target floors must not be shrunk
into a lie. At 390 the board stops being an input.**

- **Single column, in this order:** throw strip (compact, 48 px) → the active player's
  score card (promoted) → the other players' rows → the **pad** (the input: 3 segment
  keys, 20 sector keys in 4 columns, `50`, `25`, `MISS`) → the **board preview**.
- **The board preview is 300 px, read-only, and labelled "LAST DART".** It shows the last
  resolved dart marker on a scaled board so the player can see _where_ it landed. It is not
  a target: `pointer-events: none`, no buttons, `aria-hidden="true"`, and the live region
  carries the same information for AT.
- **Why.** At 300 px the treble band would be 5.3 px tall and the inner bull 8.5 px
  across. A finger is ~40 px. Offering those as targets would be a false affordance; the
  honest mobile input is the pad, whose keys are 44 px.
- **No page-level horizontal scroll** — the preview is `max-width: 100%` and scales.

### 8.4 What is on the surface

**Throw strip:** mode name · checkout badge (`DOUBLE OUT`) · visit chips (`T20`, `D16`,
`BULL 50`, `MISS`) · undo · menu.
**Score sheet:** per `DESIGN.md` §8.3 — brass rail + "ON TURN" caption, tabular remaining
score in a fixed column, last visit chips, throw tally dots.
**Not on the surface:** no chat, no emoji, no confetti, no avatar pile.

---

## 9. Board source modes

### 9.1 The abstraction

A **board source** supplies the _image_ of the board and the _points_ that come off it.
DartHub has three, and they differ only in where the image comes from and where the hit
coordinates come from.

```ts
export type BoardSourceId = "virtual" | "camera" | "smart";

export interface BoardSource {
  readonly id: BoardSourceId;
  readonly label: string; // "Virtual Board", "Camera Board", "Smart Dart"
  readonly available: boolean;
  readonly note?: string; // why it is unavailable, shown to the user
}
```

**Every source produces the same thing: a board-plane point in millimetres.** That is the
whole contract. The resolver, the scoring and the engine never learn which source was
used.

| Source            | Image                                        | Where the hit comes from                                                 | Status              |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------ | ------------------- |
| **Virtual Board** | The rendered SVG board                       | A click, converted to board mm                                           | **Implemented**     |
| **Camera Board**  | A live camera feed of a real board           | The CV pipeline: segmentation → `Perspective` → `HitDetector` → board mm | **Not implemented** |
| **Smart Dart**    | A live camera feed (or a static board image) | The dart's own onboard sensor reports its landing point in board mm      | **Not implemented** |

### 9.2 Presenting the unavailable modes

**Never render an empty board, a broken board, or a black rectangle.** An unavailable mode
is presented as an **explicitly labelled, non-selectable option** in the source selector.

The selector is a radio group at match setup:

```
BOARD SOURCE
(•) Virtual Board      Ready — play on the built-in board
( ) Camera Board       Planned — needs a camera and the computer-vision pipeline
( ) Smart Dart         Planned — needs smart-dart hardware and its app
```

- The two planned options use `aria-disabled="true"` **and stay focusable**, so a screen
  reader user can reach them and hear _why_ they cannot be chosen. They are never the
  `disabled` attribute, which removes them from the tab order and hides the explanation.
- The reason is **visible text**, not a tooltip and not a colour. It is also the option's
  accessible description (`aria-describedby`).
- **Selecting a planned mode is impossible**, and the UI never falls back to it silently.
  If a mode is unavailable, the option is inert — there is no "click and see".
- The **mode is chosen at match setup**, before the match starts, and the chosen source is
  shown in the match header as a small label (`VIRTUAL BOARD`). There is no mid-match
  source switch: changing where your darts come from mid-leg would change the rules of
  the leg in progress.

### 9.3 Swapping later

When the camera pipeline lands, `BoardSource` gains a real implementation and the radio
group's third option becomes selectable. **No change to the resolver, the scoring, the
engine wiring, the pad, or the layout.** The camera path additionally carries `segment`
into `CameraDTO` (§5.3), which is the only change the camera needs beyond the CV work.

---

## 10. Checkout rule — the decision

### 10.1 The rule

**The checkout rule is chosen by the player, at match setup, and it is stated in the UI
where the match starts.** The engine already supports all three (`OutRuleId = "double" |
"master" | "straight"`).

**Default: Double Out** for 501 and 301. Rationale:

- It is the sport's standard and the rule the Game Center copy already advertises.
- It is the only rule that makes the `segment` field _mean_ something, so shipping it by
  default proves the segment plumbing end to end.
- Master Out is a genuine house variant and is offered; Straight Out is offered for
  practice and for players who do not want to bust.

**The mode registry, not the copy, is the source of truth.** `Standard501Mode` and
`Standard301Mode` must therefore be constructed with `outRule: "double"` — today
`StandardMode` defaults to `"straight"` and no UI passes `outRule` at all, which is why
the copy lies. The fix has two halves and **both** are required:

1. the mode's default becomes `"double"` for the two x01 wrappers, and
2. the setup surface passes the player's choice through `MatchConfig.outRule` to
   `eng.startMatch({ playerIds, outRule })`.

**The Game Center rule sheet is generated from the registry** (already required by
`design-system/darthub/pages/game-center.md` §2.3), so it can never again disagree with
the engine.

### 10.2 The corrected Game Center copy

| Mode             | Win condition (as shipped)      | Checkout column |
| ---------------- | ------------------------------- | --------------- |
| 501              | Reach exactly 0                 | **Double out**  |
| 301              | Reach exactly 0                 | **Double out**  |
| Cricket          | Close 3 marks to score          | —               |
| Around The Clock | Hit every target in order       | —               |
| Shanghai         | Hit all 3 segments in one round | —               |

And one line under the table, in the same place the copy is generated from the registry:

> **Checkout rule is chosen when the match starts: Double out, Master out or Straight out.
> 501 and 301 start on Double out.**

And in the match setup surface, the checkout control reads:

> **CHECKOUT** · `Double out` — _finish on a double_ (default) · `Master out` — _finish on a double or the inner bull_ (50) · `Straight out` — _any finish counts_

**"Master out" means the inner bull, and the copy must say so.** `MasterOutRule.isCheckout`
accepts `segment === "bull"` **only when `points === 50`** — the inner bull. The outer bull
(25) does **not** finish a leg under Master Out, so the rule text must not say "or the
bull".

### 10.3 What is fixed by this

| Was                                                                          | Now                                                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `new StandardMode({ startScore: 501 })` → `outRule` defaults to `"straight"` | `Standard501Mode` → `outRule: "double"`; the player's choice overrides via `MatchConfig.outRule` |
| `eng.startMatch({ playerIds })` — no `outRule`                               | `eng.startMatch({ playerIds, outRule })`                                                         |
| `engine.recordThrow({ playerId, points })` — no segment                      | `engine.recordThrow({ playerId, points, segment })` — **always**                                 |
| Hub copy says "finish on a double"; the engine runs straight-out             | Copy is generated from the registry, and the engine's default is now double-out                  |

---

## 11. Implementation checklist

- [ ] `src/board/boardGeometry.ts` + `index.ts` — constants, `resolveBoardHit`,
      `toBoardMm`, `BoardSegment`.
- [ ] `src/game-engine/types.ts` re-exports `BoardSegment` as `ThrowSegment`.
- [ ] `Standard501Mode` / `Standard301Mode` default to `outRule: "double"`.
- [ ] `MatchConfig.outRule` is threaded from the setup surface into `startMatch`.
- [ ] `ThrowInputPad` → segment × sector redesign; `onThrow` carries `segment`.
- [ ] `CameraDTO` gains `segment?: BoardSegment` (optional now, required in the CV phase).
- [ ] The board component: SVG in millimetres, 80 sector paths, wires, numerals, textures,
      key light, vignette.
- [ ] Roving-tabindex grid over 62 board cells; sector-outline focus indicator.
- [ ] One `aria-live="polite"` region per match screen.
- [ ] `BoardSource` type + the setup-time source selector with two `aria-disabled`
      planned options.
- [ ] Board preview is read-only below 768 px.

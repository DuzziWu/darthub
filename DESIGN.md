# DartHub — Design Reference

> **Status:** authoritative design specification.
> **Direction:** "The board, after dark."
> **Token source of truth:** `design-system/darthub/MASTER.md`
> **Research:** `reports/design/02-direction-decision.md` · **Analysis:** `reports/design/01-platform-analysis.md`

This document is written so an implementer can build a new DartHub surface from it **without asking a question**. Where a token is referenced, it is defined in `design-system/darthub/MASTER.md`. Where a number appears here (a size, a ratio, a duration), it is a requirement, not a suggestion.

---

## 1. Art direction

### 1.1 One-line identity

> **A warm-black instrument surface where the board's own colours carry game meaning, the score is a ruled sheet read at a glance, and the only warm thing on screen is the lit board.**

### 1.2 What that means in practice

DartHub looks like **a score sheet in a dark club at ten o'clock, lit by one board**.

Three concrete commitments:

1. **The surface is the board's sisal, warm-black — not blue-black, not white.** `#0C0C0E`, with `#16161A` and `#1E1E23` as its raised parts. Separation between surfaces is a lightness step plus a 1px rule. There are no shadows.
2. **The colour on screen means something.** Treble green = a visit that counted. Double red = a bust. Brass = the live thing — the active turn, the primary action, the bull. Nothing else is coloured. There is exactly one accent and it is warm.
3. **The score is a sheet, not a set of cards.** Ruled rows, a fixed-width tabular numeral, the player's last visit spelled out dart by dart. This is the artifact the sport has always used, rendered as an instrument.

### 1.3 Who it is for

Club and league players — people who score on paper, play in bad lighting, and care about a three-dart average. The register is **serious, not clinical**: an instrument, not a dashboard, not a party game.

### 1.4 What it is explicitly not

Not a broadcast graphic (those are read from a sofa at three metres; this is read at arm's length). Not a neon arcade HUD. Not a SaaS admin panel. Not a paper-themed novelty.

---

## 2. Principles

Seven rules. They resolve every future argument, so they are listed before any component.

1. **Colour is data.** Every colour on screen encodes a game fact or an action. If a colour is not carrying information, it is not there. One accent; two semantic colours; the rest is a neutral ramp.
2. **Colour is never the only channel.** Every state is legible in greyscale, because treble-green and double-red are only 1.4:1 apart in luminance. Colour is a redundant channel; text, icon, position and shape are the primary ones.
3. **A number that changes never reflows.** Tabular figures, fixed column widths, no animation on values. The score must be readable mid-throw without the eye re-finding it.
4. **Density wins on the play surface.** The match view is read standing up, in bad light, mid-turn. Whitespace is for the hub and the informational pages; the match surface is tight, ruled and tabular.
5. **Every distinction carries information.** Two things that look the same must mean the same thing. Two things that mean different things must look different — **by their rules, not their hue**. This is why the five game modes differ by rule content and never by card colour.
6. **The board is the interface.** Where the domain has a physical shape — the board, the bull, the rings — the UI uses that shape. The dartboard is not an illustration; it is the throw input.
7. **State lives in the engine.** The UI renders what the engine says. When the engine has no data, the UI says so honestly. It never invents a statistic, an average, a player count, or a chart.

---

## 3. Colour

### 3.1 The ramp

| Token        | Hex       | Role                                         | Verified contrast        |
| ------------ | --------- | -------------------------------------------- | ------------------------ |
| `board`      | `#0C0C0E` | page ground — warm black sisal               | —                        |
| `surface`    | `#16161A` | sheet, panel, card                           | —                        |
| `raised`     | `#1E1E23` | control, input, hover row                    | —                        |
| `sunken`     | `#08080A` | recessed well — board bed, code block        | —                        |
| `rule`       | `#2A2A31` | decorative hairline **only**                 | 1.17–1.40:1 (decorative) |
| `edge`       | `#6B6B78` | interactive boundary                         | **3.16–3.81:1** ✅       |
| `ink`        | `#F2EDE4` | primary text — bull cream                    | **14.23–17.16:1** ✅     |
| `ink-muted`  | `#B9B2A6` | secondary text                               | **7.89–9.51:1** ✅       |
| `ink-faint`  | `#8C857A` | tertiary text, labels                        | **4.55–5.48:1** ✅       |
| `brass`      | `#E3A64F` | the accent — live turn, primary action, bull | **7.77–9.37:1** ✅       |
| `brass-deep` | `#8A6220` | brass border on dark (never body text)       | 3.04–3.67:1 (non-text)   |
| `treble`     | `#59D6AE` | a visit that counted                         | **9.21–11.11:1** ✅      |
| `double`     | `#E85C4A` | a bust                                       | **4.79–5.78:1** ✅       |

### 3.2 The three semantic colours

```
TREBLE GREEN  #59D6AE   a visit that counted        → check icon + "+N"
DOUBLE RED    #E85C4A   a bust                      → cross icon + "BUST"
BRASS         #E3A64F   the live thing              → active rail + "TURN" / primary fill
```

- Treble green and double red are **taken from the board** — the treble ring is green and the double ring is red on every real dartboard. Here they carry _match_ meaning instead of _board_ meaning, which is the category's unclaimed opportunity.
- **Green is never the brand colour and red is never the brand colour.** Spending them on branding would destroy their only job.
- Brass appears on: the primary action, the active player's rail and label, the bull, the active-turn dot. **Nowhere else.** It is the light on the board — one source.

### 3.3 Hard colour rules

- One accent. No second hue.
- No per-mode colour. The five modes are distinguished by their rules.
- `rule` never indicates a control boundary; `edge` does.
- `brass-deep` is never used for text smaller than 20px.
- On-accent text is always `text-board`.
- No gradients anywhere. No glow. No neon.

---

## 4. Typography

### 4.1 The three roles

| Role        | Family                         | Why this one                                                                                                                                                                                                                                               |
| ----------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display** | **Barlow Condensed** 600/700   | The dataset's own "Sports/Fitness" pairing — "athletic, energetic, condensed, action… Best For: Sports… competition". Condensed athletic caps read as broadcast darts without being a broadcast graphic, and they are compact enough for the sheet header. |
| **Body**    | **Barlow** 400/500/600         | The body half of the same dataset pairing. A low-contrast humanist grotesque with generous x-height — legible at 13px in bad light, which is the actual reading condition.                                                                                 |
| **Numeric** | **JetBrains Mono** 400/500/700 | The dataset's "Inter Poster" note: _"JetBrains Mono for labels and stats."_ Monospaced, so figures are **tabular by construction** — no reliance on an OpenType feature being present.                                                                     |

### 4.2 Type scale

| Token      | Size / line-height | Family        | Use                                             |
| ---------- | ------------------ | ------------- | ----------------------------------------------- |
| `display`  | 32 / 36            | Condensed 700 | Mode name, sheet title, result headline         |
| `title`    | 24 / 30            | Condensed 600 | Section heading                                 |
| `heading`  | 18 / 24            | Condensed 600 | Row-group label, card heading                   |
| `body`     | 15 / 22.5          | Sans 400      | Descriptions, rule text, empty states           |
| `label`    | 13 / 16            | Sans 500      | Button labels, field labels, chips              |
| `caption`  | 12 / 14            | Sans 500      | Metadata; uppercase + `0.04em` for column heads |
| `score-xl` | 48 / 48            | Mono 700      | The remaining score on the sheet                |
| `score-lg` | 32 / 36            | Mono 700      | Score in a result banner, points per visit      |
| `score-md` | 24 / 30            | Mono 500      | Secondary score figures, dart counts            |
| `score-sm` | 18 / 22            | Mono 500      | Inline numerals, marks, table cells             |

### 4.3 Tabular figures

```css
.score-figure {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings:
    "tnum" 1,
    "zero" 1;
  min-width: 3ch;
  text-align: right;
}
```

- Any value that changes **must** be in the mono family.
- The score column has a fixed width so `140 → 40 → 9` never shifts the row.
- Barlow Condensed's figures are proportional — **never** use them for a changing number.

### 4.4 Loading

`next/font/google` with `display: "swap"`, self-hosted, subset `latin`. Three families at 8 weights total; only load a weight that is used.

---

## 5. Spacing, radius, elevation

**Spacing** — 4pt grid: `xs 2px · sm 4px · md 8px · lg 12px · xl 16px · 2xl 24px · 3xl 32px · 4xl 48px`.

- `md 8px` is the **minimum gap between interactive targets**.
- The match surface uses `md`/`lg` only. The hub uses `2xl`/`3xl`.

**Radius** — `xs 2px` (chips) · `sm 3px` (buttons, keys) · `md 4px` (panels — **maximum on any rectangle**) · `full` (only genuinely circular things: the bull, the turn dot, an avatar).
**Pills are banned.**

**Elevation** — **no shadows.** Depth = surface lightness step + 1px rule.
`e0 board` → `e1 surface + rule` → `e2 raised + edge` → `e3 raised + edge + 1px board outline`.
One exception: overlays get `--shadow-overlay: 0 16px 40px -12px rgb(0 0 0 / 0.7)` to separate from a scrim.

---

## 6. Motion

`instant 80ms` (press) · `fast 120ms` (hover/focus) · `base 200ms` (panel).
`ease-out cubic-bezier(0.2,0,0,1)` entering · `ease-in cubic-bezier(0.4,0,1,1)` leaving.

- Animate `opacity` and `transform` only.
- **No layout-shifting hover.** No `scale`, ever.
- **No scroll-reveal, no parallax, no looping animation.**
- **A changing number does not animate.** It changes instantly.
- `prefers-reduced-motion: reduce` → all durations to `0.01ms`, all loops to 1. Mandatory; no such rule exists in the codebase today.

---

## 7. Icons

**Lucide.** 24×24 grid, 2px stroke, round caps and joins.

Sizes: `xs 14px` · `sm 16px` · `md 20px` (default — buttons, nav) · `lg 24px` · `xl 32px` (empty states).

1. One family. **No emoji** — there are 15 in the codebase and all must go.
2. Decorative icon beside visible text → `aria-hidden="true"`.
3. Icon-only control → `aria-label` + `aria-pressed`/`aria-expanded` where applicable.
4. Meaningful standalone icon → adjacent text or a visually-hidden label.
5. Never the sole carrier of a state that matters.

---

## 8. Component specifications

Every surface DartHub has, with its interaction states.

### 8.1 App shell

**Structure**

```
┌────────────────────────────────────────────────────────────┐
│ DARTHUB        Game Center   Lobby   Career   Dashboard   │  ← header, 56px
├────────────────────────────────────────────────────────────┤
│ <a class="skip-link">Skip to main content</a>             │
│                                                            │
│   <main id="main">                                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

| Element   | Spec                                                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header    | 56px tall, `bg-board`, `border-b border-rule`, sticky. Wordmark left, nav right.                                                                                                                                                   |
| Wordmark  | `font-display` 700, `text-ink`, letter-spacing `0.08em`, uppercase. The **"D" is brass**.                                                                                                                                          |
| Nav link  | `font-label`, `text-ink-muted`, 44px min target. Active: `text-ink` + a 2px brass underline on the bottom edge.                                                                                                                    |
| Skip link | Visually hidden until focused; on focus it becomes a visible `bg-brass text-board` bar at the top-left, `z-60`.                                                                                                                    |
| `<main>`  | `id="main"`, `tabIndex={-1}`, `max-w-[1440px]`, `mx-auto`, `px-4 md:px-8`.                                                                                                                                                         |
| Mobile    | At <768px the nav collapses to a **bottom tab bar** (5 destinations max, per the tool's nav rules) with icon + label, `bg-board`, `border-t border-rule`, 64px tall + safe-area inset. The header collapses to the wordmark alone. |

**States.** Nav link: default `text-ink-muted` → hover `text-ink` at 120ms → focus-visible 2px cream ring with 2px offset → active `text-ink` + brass underline. Bottom tab: same, with the active icon filled brass.

**Accessibility.** `aria-current="page"` on the active nav item. The bottom tab bar is a `<nav aria-label="Primary">` with a `<ul>`. The header is `<header>`, the sheet `<main>`.

### 8.2 Game Center — the rule sheet

**This is not a card grid.** It is a ruled list of rules. The five modes differ by _what the rules are_, never by colour.

```
DART HUB — GAME CENTER                         [ How scoring works ]

MODE            START   WIN CONDITION              TARGETS        TURNS
──────────────────────────────────────────────────────────────────────────────
501             501     Reach exactly 0           —               3 darts
301             301     Reach exactly 0           —               3 darts
Cricket         —       Close 3 marks to score     20-15 + Bull    3 darts
Around The      —       Hit every target in order  1-20, then Bull 3 darts
Clock
Shanghai        —       Hit all 3 segments in      1-7             3 darts
                      one round
```

**Structure**

- Header: `font-display` `text-display` — "GAME CENTER", with a one-line `text-body text-ink-muted` explanation.
- The sheet is a **table** (`<table>` with `<caption class="sr-only">`), not a grid of divs. On mobile it reflows to a **stacked definition list** per mode — the mode name as a heading, then its rules as label/value pairs.
- Column heads: `font-caption`, uppercase, `0.04em`, `text-ink-faint`.
- Row separators: 1px `rule`. **No card fill, no border, no radius.**
- Each row's mode name is `font-display`, `text-ink`, and is the row's link target. It is the **loudest element in the row** — `text-title` (24 px) in the table, `text-heading` (18 px) in the mobile stack — because the mode is what the player came to choose. The numbers beside it (the start score, the target set) are supporting data and sit one step down at `text-score-sm`.
- "Darts per turn" is identical across all modes, so it appears once in the header context, not as a per-row differentiator.
- The rule values are **generated from the mode registry** (`src/game-engine/modes/*`), never hand-written prose. This is a correctness requirement: the current hub claims 501 and 301 "finish on a double" while the engine runs `outRule: "straight"` by default.
- The sheet is **one shared component**, `src/components/game/RuleSheet.tsx`. The Game Center and the home route render the same component at different measures, so the rules on the two pages can never disagree with each other or with the engine.

**States.** Row: default no fill → hover `bg-surface` (full-bleed, edge to edge, 120ms) → focus-visible 2px cream ring, 2px inset → the mode-name link itself `text-ink` → hover `text-brass`.

**Accessibility.** `<table>` semantics survive the mobile reflow via a real `<dl>` alternative at <768px. The mode name is the only link per row, and it names its destination ("Play 501").

### 8.3 Match view — the score sheet

**Structure**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 501  DOUBLE OUT            T20  T20  D16              [UNDO] [MENU]  │ ← throw strip
├──────────────────────────────────────┬───────────────────────────────┤
│                                      │  PLAYERS                      │
│            ╭───────────────╮        │  ┃ Dave   140  T20 T20 D16    │
│            │               │        │    Sam   132  S7 T19 T13     │
│            │   THE BOARD   │ 600px │  ┃ Priya 168  BUST            │
│            │   (in a well) │        │  ──────────────────────────── │
│            ╰───────────────╯        │  SEGMENT  [1×][2×][3×]        │
│   (armed band outlined in brass)     │  DART PAD (1–20, 50, 25,    │
│                                      │             MISS)            │
└──────────────────────────────────────┴───────────────────────────────┘
```

**There is exactly one armed-segment control: the pad's segment radio group.** The board
_displays_ the armed band as a brass outline but hosts no segment keys of its own — the
`DartBoard` component takes `armedSegment` as a prop and has no change handler, so it
cannot be the control's owner. One state, one control, two read-outs (the board's band
outline and the pad's group label).

**The board is the central element.** It sits in a `bg-sunken` well with a 1 px `rule` border — a lit object in a dark recess, which is the "board, after dark" direction made literal. The score sheet is **beside** it, not above it; the throw strip runs along the top.

**The score sheet.** One row per player, in stable seating order.

| Element           | Spec                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row               | 56px desktop / 64px mobile, `border-b border-rule`. No fill, no radius, no card.                                                                                                                  |
| Active marker     | 2px brass left rail (`border-l-2 border-brass`) + `text-ink` vs `text-ink-muted` + a visible **"ON TURN"** caption.                                                                               |
| Name              | `font-label`, `text-ink`, max 16ch, truncate with a `title` attribute.                                                                                                                            |
| Score figure      | `font-mono` 700, `text-score-xl`, `tabular-nums`, right-aligned, `min-w-[3ch]`. **Fixed column width — the column does not move when the score changes.**                                         |
| Last visit        | Up to three segment badges, `font-mono` 500, `text-caption`: `T20`, `D16`, `S7`, `BULL`. A bust replaces the visit with a `bg-double text-board` chip showing a cross icon and the word **BUST**. |
| Throw tally       | Three dots — filled brass for darts thrown, `border-edge` outline for remaining. Always three, never a number.                                                                                    |
| "ON TURN" caption | `font-caption` uppercase, `text-brass`. This is what makes the brass rail accessible without colour.                                                                                              |

**The board input.** A **realistic steel dartboard** — 20 sectors in standard clockwise order (20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5), rendered in millimetre-accurate geometry with real materials, and it is the primary pointer path for throwing.

> **The full board specification — geometry, colour, materials, lighting, the shared domain module, the interaction model, the target-size decision, the source modes and the layout — is `design-system/darthub/board.md`.** This section is the summary; that file is the numbers.

| Element         | Spec                                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Face            | 451 mm diameter, rendered as SVG in **millimetres** (`viewBox="-225.5 -225.5 451 451"`), 600 px at 1440, 520 px at 1024, 300 px preview at 390.                                                    |
| Beds            | 20 sectors × 4 radial bands = 80 annular-sector paths. Alternating **black** (`#141416`) and **light** (`#D9CFBA`) sisal.                                                                          |
| Scoring bands   | **Red** (`#A32B22`) and **green** (`#1B6B47`) painted rings, alternating by **position** — odd positions red, even positions green.                                                                |
| Bulls           | Inner bull (50) green `#1B6B47`, outer bull (25) cream `#E4DAC4`.                                                                                                                                  |
| Number ring     | Black `#0E0E10` with cream `#E8E2D4` numerals, **radially oriented** (tops pointing outward), 20 of them.                                                                                          |
| Wire            | 20 radial steel spokes + 6 concentric rings, drawn as a dark groove with a lit edge — the wires are the bed boundaries.                                                                            |
| Material        | Procedural sisal grain (`feTurbulence`), brushed steel on the number ring, an off-centre key light at 30 % and a 42 % vignette. No drop shadows.                                                   |
| Hit marker      | A **dart** is left at the resolved point — a 2.4 mm disc, a 9 mm shaft and a brass flight — for the whole visit, cleared when the turn ends.                                                       |
| Segment control | The **armed segment** (`1× / 2× / 3×`) is the pad's segment radio group, and the armed band is **outlined in brass on the board itself**. Clicking a numeral scores the armed band of that sector. |
| Submit          | Every **scoring** throw submits `{points, segment}` to the engine — always, from every path. A **miss** submits `{points: 0}` with the segment **omitted**.                                        |

**Interaction states.** Bed: default → hover a 16 % white wash + a 0.8 mm cream edge → focus-visible (see §8.3.1) → the hit dart. Armed-segment button: default `bg-raised text-ink` → selected `bg-brass text-board`.

**Three rules the throw pipeline must not get wrong.** These are engine behaviours the UI
cannot infer from the returned state — full detail in `MASTER.md` §10.2.1–§10.2.3 and
`board.md` §6.8.

1. **A bust is a thrown error, not a returned state.** `StandardMode.applyThrow` throws
   `GameEngineStateError("Bust: …")` and the engine leaves the state untouched. **The UI
   computes the bust itself** from the out rule in force, the remaining score and the dart.
   It must not infer a bust from an unchanged score, and it must not string-match the
   error message — "not your turn" is the same error class. A bust **does not consume a
   dart** and **does not end the turn**, so the BUST chip is UI-local state for the visit.
2. **A miss carries no segment.** `isValidSegmentScore` returns `false` for `points <= 0`,
   so `{points: 0, segment: "single"}` is a validation error, not a zero-scoring throw.
3. **The three non-x01 modes ignore `segment` entirely.** Cricket, Around The Clock and
   Shanghai derive everything from `points`; the segment is a UI label there. In cricket
   the inner bull (50) counts as **two** marks and the outer bull (25) as **one** — the two
   bulls are not interchangeable.

**Accessibility.** The board is a `<div role="group" aria-label="Dartboard">`. Its pointer targets are the painted beds; a **roving-tabindex grid** of 62 real `<button>`s (20 sectors × 3 beds, plus both bulls) gives the same capability by keyboard, each named by its outcome ("Treble 20, 60 points"). A `sr-only` live region announces "T20, 60 points. 80 remaining."

**Not on this surface.** No chat, no emoji, no confetti, no avatar pile, no "invite friends". A 180 is acknowledged by the score sheet itself.

#### 8.3.1 Board geometry — the real numbers

**Standard Winmau/PDC board. 451 mm overall diameter.** Every radius is in millimetres from the board centre.

| Feature                    | Inner r (mm) | Outer r (mm) |
| -------------------------- | ------------ | ------------ |
| Inner bull (50)            | 0            | 6.35         |
| Outer bull (25)            | 6.35         | 15.9         |
| Inner single bed (1×)      | 15.9         | 99           |
| Treble band (3×)           | 99           | 107          |
| Outer single bed (1×)      | 107          | 162          |
| Double band (2×)           | 162          | 170          |
| Number ring (not scorable) | 170          | 225.5        |

Each segment spans **18°**, centred on its number, so segment _i_ (0-based in the order above) is centred at **i × 18° clockwise from 12 o'clock**. Boundary values belong to the **inner** band of the pair. Anything beyond r = 170 is a **miss** — the number ring is not scorable, exactly as on a real board.

**Alternation is positional.** Odd position (20, 18, 13, 10, 2, 3, 7, 8, 14, 12) → **black bed, red bands**. Even position (1, 4, 6, 15, 17, 19, 16, 11, 9, 5) → **light bed, green bands**. It is decided by where the sector sits, not by the parity of its number.

**The SVG's user unit is one millimetre.** The viewBox is `-225.5 -225.5 451 451`, so the path coordinates _are_ the scoring radii — the picture and the rules cannot drift apart.

**The shared board-geometry module.** One pure-TypeScript module, no DOM and no UI imports, at `src/board/boardGeometry.ts`:

```ts
export const BOARD_RADII_MM: Readonly<{ innerBull: 6.35; outerBull: 15.9 /* … */ }>;
export const BOARD_SEGMENT_ORDER: readonly number[];
export type BoardSegment = "single" | "double" | "triple" | "bull";
export function resolveBoardHit(xMm: number, yMm: number): BoardResolution;
export function toBoardMm(
  dxPx: number,
  dyPx: number,
  pxPerMm: number,
): { xMm: number; yMm: number };
```

**Units: millimetres, board plane, origin at the board centre, x positive right, y positive above centre.** That is _exactly_ the frame `CameraDTO` and `Perspective.transform` already use, so the camera path needs **no adapter**: `HitDetector.detect()` calls the same `resolveBoardHit` the UI click handler calls. The UI converts a click through `toBoardMm` — **negating y**, because SVG's y grows downward while the board frame's y grows upward.

**`ThrowSegment` and `BoardSegment` are the same type.** `src/game-engine/types.ts` re-exports the board's type rather than declaring a second copy:

```ts
export type { BoardSegment as ThrowSegment } from "@/domain/board/boardGeometry";
```

**The camera path must carry the segment too.** `CameraDTO` currently carries only `score`, and a score alone is ambiguous about its band — **24 points is D12 or T8; 30 points is D15 or T10.** A camera reporting `score: 24` cannot tell the engine it was a double, so Double Out would be unwinnable from a camera even after the UI is fixed. `CameraDTO` therefore gains a `segment` field, populated by `resolveBoardHit`, so the virtual board and the camera submit **identical** `ThrowInput` to the engine.

#### 8.3.2 Target size — the decision

**The criterion that governs is WCAG 2.2 SC 2.5.8 _Target Size (Minimum)_, Level AA — 24 × 24 CSS px**, with its exceptions (spacing, inline, user-agent control, essential). **SC 2.5.5 _Target Size (Enhanced)_ (44 × 44, Level AAA)** is the house floor for **controls** — every button, key and link in DartHub.

**The board is not a set of controls; it is a picture whose regions happen to be targets.** Measured on a 600 px board (1.330 px/mm), using the **clickable** dimension — the thickness of a band, not the bounding box of a curved wedge:

| Target              | Clickable size                       | 24 px (2.5.8) | 44 px (2.5.5) |
| ------------------- | ------------------------------------ | ------------- | ------------- |
| Treble band cell    | **43 × 10.6 px** (arc × thickness)   | **FAIL**      | **FAIL**      |
| Double band cell    | **69 × 10.6 px**                     | **FAIL**      | **FAIL**      |
| Inner bull          | **16.9 px** across                   | **FAIL**      | **FAIL**      |
| Outer bull          | 42 px across, **12.7 px** ring width | **FAIL**      | **FAIL**      |
| Single bed cell     | 56 × 110 px                          | PASS          | PASS          |
| Number-ring numeral | 82 × 74 px cell (glyph ~19 × 29)     | PASS (cell)   | PASS (cell)   |

**Neither 2.5.8 exception rescues them.** The beds are separated by a 1.2 mm wire channel, so a 24 px circle centred on a treble cell intersects its neighbours — the spacing exception fails. The "essential" exception fails too, because the _function_ is available through other, conformant targets. Claiming either would be dishonest.

**And it cannot be fixed by making the board bigger.** For the treble band to be 24 px tall the board would have to be **1,353 px** across; for 44 px, **2,480 px** — larger than any viewport. **The treble band is 8 mm of a 451 mm board. That ratio is the sport.**

> **The decision.** The painted beds are a **precision shortcut for pointer users**. They are not the only way to throw anything, and every throw they offer is also offered by controls that meet the 44 px house floor. The sub-24 px targets on the painted beds are a **documented deviation**, disclosed rather than papered over.

What makes that decision honest rather than a dodge:

1. **Complete duplication.** Every outcome reachable by clicking a bed is reachable through the **armed segment + numeral** route and through the **dart pad** (§8.4), whose targets are ≥ 44 × 44. There is no dart that can only be scored by a 10-pixel target.
2. **The board makes the conformant route obvious.** The armed band is outlined in brass _on the board_, and the caption under it states the rule in one line.
3. **Keyboard parity.** The board's roving-tabindex grid exposes all 62 outcomes as real buttons with real names, and keyboard operation is not constrained by pointer target size at all.
4. **Touch is never offered a 10-pixel target.** Below 768 px the board is a **read-only preview** and the pad is the input. A finger is ~40 px wide; a 12-pixel band would be a lie.

**The honest trade-off, stated once:** a player with a mouse scores a treble on the board in one click; a player with a finger or a keyboard takes two actions — arm `3×`, then tap the number. The board is faster for the mouse, the pad is universal. **We are not claiming SC 2.5.8 conformance for the painted-bed targets, and we are not claiming we could.**

**What supersedes.** The previous round's §8.3.1 derived a 512 px board from a **44 px square sector button** on a number ring, with the sectors _outside_ the double ring. That derivation is **withdrawn** — it described a different, simpler object. The 44 px floor now binds the pad and the controls, and the board is a real board.

### 8.4 The Dart Pad — the keyboard, touch and screen-reader path

**The board is the pointer path; the pad is the universal one.** They are not a fallback for a broken board — they are the same model (_a segment and a sector_) expressed as discrete, conformant controls, and they feed one `throw(points, segment)` call.

The existing `ThrowInputPad` is **redesigned**, not kept:

- The 39 raw point values are replaced by a **segment selector** (`1× Single` · `2× Double` · `3× Treble`, a radio group) plus **20 sector keys** (`1`…`20`) plus **`50`**, **`25`** and **`MISS`**.
- **Every key is ≥ 44 × 44 px with ≥ 8 px gaps** (currently 43 × 36 px at 4 px gaps — a measured failure).
- The arbitrary blue/purple split is removed. Blue encodes nothing: 25 is blue and 60 is purple, which is not a darts distinction.
- `MISS` is a first-class key, distinct from `0`. It submits `{ points: 0 }` with the **segment omitted** — a miss with a segment is a validation error, because `isValidSegmentScore` rejects `points <= 0`.
- The bull keys `50` and `25` are **separate**, because they are different board regions and Double Out treats a bull differently from a double. In cricket they are different again: 50 is **two** marks, 25 is **one**.
- Each key's **visible label** is its value; its **accessible name** states the outcome — the `20` key is _"Treble 20, 60 points"_ when Treble is armed. The armed segment is named in the visible group label too, so the state never depends on colour.

**The armed segment is shared state.** Arming `3×` changes what the board's numerals score _and_ is outlined in brass on the board. One state, two views. **The pad's segment radio group is the only control** — the board displays the armed band but hosts no segment keys of its own.

**`ThrowInputPad`'s `onThrow` prop changes** from `(points: number) => void` to `(throw: { points: number; segment?: ThrowSegment }) => void`. The `segment` is optional because a miss omits it.

### 8.5 Player setup

| Element      | Spec                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Container    | `bg-surface`, `border border-rule`, `rounded-md`, `p-2xl`. Max-width 420px, centred.                                                           |
| Mode heading | `font-display` `text-title`, `text-ink`. **No emoji** — the current `modeIcon="🎯"` is removed and replaced by a small Lucide icon in `brass`. |
| Description  | `font-body` `text-body`, `text-ink-muted`. States the real rules.                                                                              |
| Field label  | `font-label` `text-label`, `text-ink-muted`, always visible above the input (never placeholder-only).                                          |
| Input        | `bg-sunken`, `border border-edge`, `rounded-sm`, `h-11` (44px), `text-ink`, `font-body`. Focus: `border-brass` + 2px cream ring.               |
| Error        | `text-double`, `text-label`, with a warning icon and `aria-live="polite"`. Never colour alone.                                                 |
| Start button | `primary` — `bg-brass text-board`, 44px+, full width. **The only `primary` on the surface.**                                                   |

The mode heading's icon is decorative (it sits beside a visible heading) → `aria-hidden="true"`.

### 8.6 Board source modes

The UI must distinguish three board sources, and the two that are not built must never look broken.

**A "board source" supplies the image of the board and the points that come off it.** All three differ only in _where the image comes from_ and _where the hit coordinates come from_ — and every one of them ends in the same board-plane millimetre point, resolved by the same `resolveBoardHit`.

| Source            | Image                               | Where the hit comes from                                                 | Status              |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------ | ------------------- |
| **Virtual Board** | The rendered SVG board              | A click, converted to board mm                                           | **Implemented**     |
| **Camera Board**  | A live camera feed of a real board  | The CV pipeline: segmentation → `Perspective` → `HitDetector` → board mm | **Not implemented** |
| **Smart Dart**    | A live feed or a static board image | The dart's own onboard sensor reports its landing point in board mm      | **Not implemented** |

**How the unimplemented modes are presented.** A radio group at match setup:

```
BOARD SOURCE
(•) Virtual Board      Ready — play on the built-in board.
( ) Camera Board       Planned — needs a camera and the computer-vision pipeline.   [PLANNED]
( ) Smart Dart         Planned — needs smart-dart hardware and its app.            [PLANNED]
```

- The two planned options use `aria-disabled="true"` **and stay focusable**, so a screen-reader user can reach them and hear _why_ they cannot be chosen. They are never the `disabled` attribute, which removes them from the tab order and hides the explanation.
- The reason is **visible text**, not a tooltip and not a colour.
- **Selecting a planned mode is impossible.** There is no "click and see" and no silent fallback.
- **The source is chosen at match setup**, before the match starts, and the chosen source is shown in the match header as a small label. There is no mid-match switch: changing where your darts come from mid-leg would change the rules of the leg in progress.

**Swapping later** changes nothing but the source implementation — the resolver, the scoring, the engine wiring, the pad and the layout are untouched. The camera path additionally carries `segment` into `CameraDTO` (§8.3.1).

### 8.7 Game result banner

| Element               | Spec                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container             | `bg-surface`, `border border-rule`, `rounded-md`, `p-2xl`.                                                                                                                                                                                                |
| Headline              | `font-display` `text-display`, `text-ink`: "Dave takes leg 2".                                                                                                                                                                                            |
| **No `🏆`, no `👑`.** | The current 5xl trophy emoji and the crown emoji are removed. If a trophy is wanted at all it is a Lucide `Trophy` at `icon-xl` in `brass`, `aria-hidden="true"`, beside the headline — never instead of it.                                              |
| Final scores          | A mini score sheet: one row per player, `font-mono` figures, tabular, fixed width. The winner's row carries the brass rail and the word **WIN**; everyone else carries **2ND**/**3RD** or their remaining score. Colour is never the sole differentiator. |
| Margin line           | `font-body` `text-body` `text-ink-muted`, stating the real margin computed from engine state: "won by 32 points", "3–1 on legs". **Never an invented statistic.**                                                                                         |
| Actions               | `Play again` = `primary` (`bg-brass text-board`). `Game Center` = `secondary`. Both 44px+.                                                                                                                                                                |

### 8.8 Other surfaces

**Dashboard.** Currently four `--` KPI cards. Redesign as a **profile sheet**: rating, level, XP and friends count as a ruled list with tabular figures — and, where a value does not exist yet, an explicit empty state ("No completed matches yet"), never a `--` placeholder and never a fake chart. No charts until there is real data to chart.

**Lobby.** A room list, one row per room: room name, host, player count, mode, and a Join button. Rooms are real server state; the empty state explains how to open one. The `Find Match` / `Create Room` buttons are `primary` and `secondary` respectively, side by side, not in separate panels.

**Career.** A quest sheet: current quest name, `font-body` description, a **progress bar** whose fill is `brass` on a `bg-sunken` track with `border-edge` (the current `rounded-full` blue bar is replaced — a pill is banned and blue is not in the palette), and a list of training lessons. Progress percentage comes from the quest data, never a hard-coded `0%`.

**Home.** The `app/page.tsx` stub becomes the **session surface**: the active or resumable match if there is one, otherwise a compact entry point with the same rule-sheet component the Game Center uses. No hero image, no marketing gradient.

---

## 9. Interaction states — reference

Every interactive element implements all six. States are distinguished by **more than one channel**.

| State                | Treatment                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default**          | `bg-raised`, `text-ink`, `border-edge`                                                                                                         |
| **Hover**            | `bg-board` or a 1-step lightness lift, `border-brass-deep`, 120ms `ease-out`. **Never `scale`.**                                               |
| **Focus-visible**    | `outline: 2px solid var(--color-ink); outline-offset: 2px`. Cream, never brass (brass-on-brass is 1.0:1 and invisible). Never `outline: none`. |
| **Active / pressed** | 80ms, one step darker, `transform: translateY(1px)` at most — no scale.                                                                        |
| **Disabled**         | `opacity: 0.45`, `cursor-not-allowed`, `aria-disabled` or the native `disabled` attribute. Never a disabled look that still looks clickable.   |
| **Error**            | `border-double`, `text-double` message with an icon, `aria-describedby` pointing at it.                                                        |

**Game-specific states**

| State             | Expression                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **Active turn**   | 2px brass left rail + `text-ink` + the caption **"ON TURN"** + filled brass tally dots.            |
| **Counted visit** | `treble` colour + a check icon + the value in `font-mono`.                                         |
| **Bust**          | `bg-double text-board` chip + cross icon + the word **BUST**.                                      |
| **Checkout**      | The brass rail on the finishing player's row plus a **"CHECKOUT"** caption. Never colour alone.    |
| **Leg / set won** | A brass rule across the sheet + the sheet header updates to `LEG 2/5`.                             |
| **Match point**   | The word **MATCH POINT** in `text-brass` `font-caption` uppercase in the header. Text, not a glow. |

---

## 10. Responsive behaviour

Three reference viewports. The rule sheet and the match view have different priorities at each size.

### 10.1 Game Center

| Viewport | Layout                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1440** | Sheet is a 5-column table, full content width (max 1200px), generous `2xl`/`3xl` section rhythm. Header `text-display` 32px.                                                                                        |
| **1024** | Same table, `text-display` reduced to 24px, content padded `px-8`. Column gaps tighten to `xl`.                                                                                                                     |
| **390**  | Table reflows to a **stacked `<dl>`** per mode: mode name as an 18px condensed heading, then each rule as a label/value pair stacked with `space-y-md`. Full-width rows, `px-4`. Row separators stay as 1px `rule`. |

### 10.2 Match view

| Viewport | Layout                                                                                                                                                                                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1440** | **Throw strip across the top, full width, 56 px.** Below it, two columns: the **board 600 px** in a sunken well on the left, with the armed-segment toggle beneath it; the **score sheet** (480 px column) and the **dart pad** on the right.                                                                                            |
| **1024** | Same two-column arrangement. Board **520 px**, well padding 8 px, right column **400 px** — the figure from the page override in `pages/match.md` §8, which is the narrower of the two this document used to carry; the score sheet rows compress to name · visit · score · turn.                                                        |
| **390**  | **Single column, in this order:** throw strip (compact) → the score sheet → the status line → the dart pad (whose armed-segment radio group is its first group) → **the board preview, last**. The strip's two text actions do not fit beside the mode name at this width, so it wraps to a second row: the strip is **~85 px**, not 48. |

**What the 390 layout does with a board that cannot shrink.** The board's treble band is 8 mm of a 451 mm board. At 300 px it is **5.3 px** tall and the inner bull is **8.5 px** across, while a finger is ~40 px. **Shrinking it would be a false affordance**, so at 390 the board stops being an input:

- It renders as a **300 px read-only preview**, labelled **"LAST DART"**, showing where the last dart landed. It is `pointer-events: none`, `aria-hidden="true"`, and it carries no buttons.
- The **pad is the input**, and it comes **before** the board in the reading order, so the player scores without scrolling.
- The live region and the throw strip carry the same information for assistive technology.

**No page-level horizontal scroll, ever** — verified by measurement at all three viewports. The fixed bottom tab bar has its height reserved as `main` bottom padding so it never covers the last row of content.

**Specificity trap.** The `main` element also carries the `.wrap` container class. `.wrap` has class specificity (0,1,0) and `main` has element specificity (0,0,1), so a bare `main { padding: … }` is **overridden by `.wrap`**. Use `main.wrap` — or a higher-specificity selector — for any rule that sets padding on the page container.

### 10.3 Touch targets

Every interactive target is **≥ 44×44px** with **≥ 8px** separation. This is a hard constraint, checked by measurement at every viewport. The current build fails this on all 39 pad keys (43×36px, 4px gaps) and on two buttons (81×20px, 358×40px).

---

## 11. Accessibility floor — measurable criteria

These are the acceptance thresholds. Each is checkable by measurement.

| #   | Criterion                                            | Threshold                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Body text contrast                                   | **≥ 4.5:1** against its actual surface. Verified values in §3.1 — the lowest is `ink-faint` on `raised` at **4.55:1**.                                                                                                                             |
| 2   | Large text (≥24px, or ≥18.66px bold) and non-text UI | **≥ 3:1**. `edge` measures **3.16–3.81:1**.                                                                                                                                                                                                        |
| 3   | Focus ring                                           | 2px solid `ink` + 2px offset, **never removed**, **≥ 3:1** against every surface (it is 14.23–17.16:1).                                                                                                                                            |
| 4   | Interactive target size                              | **≥ 44×44px**, with **≥ 8px** gap between adjacent targets — **for controls**. The dartboard's painted beds are a documented exception: see §8.3.2.                                                                                                |
| 5   | Colour independence                                  | Every state readable with colour removed. Treble/double also carry an icon **and** a word.                                                                                                                                                         |
| 6   | Keyboard operation                                   | Every control reachable and operable by keyboard. The board is a **roving-tabindex grid** of 62 named buttons; the pad is a plain set of buttons. Visible focus at every stop.                                                                     |
| 7   | Focus order                                          | Matches visual order. Focus is never obscured by a sticky header, bottom tab bar or overlay (the score sheet's sticky header is `h-14` and content gets `scroll-margin-top` to match).                                                             |
| 8   | Focus management on route change                     | Focus moves to `<main>` on navigation.                                                                                                                                                                                                             |
| 9   | Skip link                                            | Present, visually hidden until focused, then a visible brass bar.                                                                                                                                                                                  |
| 10  | Landmarks                                            | `<header>`, `<nav aria-label="Primary">`, `<main id="main">`, `<footer>`. One `<h1>` per page, no level skips.                                                                                                                                     |
| 11  | Labels                                               | Every input has a visible `<label for>`. Errors are adjacent to their field and wired with `aria-describedby`.                                                                                                                                     |
| 12  | Icon semantics                                       | Decorative → `aria-hidden="true"`; icon-only → `aria-label`; meaningful standalone → text alternative.                                                                                                                                             |
| 13  | Status announcements                                 | One `aria-live="polite"` region per screen for score and turn changes. Announce the phrase ("Dave, 140 remaining"), not the raw number.                                                                                                            |
| 14  | Reduced motion                                       | `prefers-reduced-motion: reduce` collapses all durations to 0.01ms and removes loops. Currently absent from the codebase entirely.                                                                                                                 |
| 15  | No horizontal scroll                                 | `document.scrollWidth ≤ window.innerWidth` at 390px.                                                                                                                                                                                               |
| 16  | Colour scheme                                        | `color-scheme: dark` — already correct.                                                                                                                                                                                                            |
| 17  | Language                                             | `<html lang="en">` — already correct.                                                                                                                                                                                                              |
| 18  | Target size (WCAG 2.2)                               | Interactive targets **≥ 24×24 CSS px** even where 44px is impractical (WCAG 2.2 §2.5.8). **The dartboard's treble/double beds and bulls fall below this** — an unavoidable consequence of the sport's geometry, disclosed and mitigated in §8.3.2. |

---

## 12. Do / Don't

Mapped directly onto the binding quality rules. Each _don't_ names the current violation.

### Do

- Use a ruled sheet with tabular figures for anything a player reads mid-turn.
- Give every colour a job, and a second channel to back it up.
- Use the board, the bull, the rings — the real shapes of the sport.
- Differentiate modes by their **rules**.
- Keep the play surface dense; keep the hub readable.
- Let the score change instantly and never move.
- Say "BUST" and show a cross, not just a red box.
- Show an honest empty state when there is no data.
- Use one SVG icon family, sized by token.
- Verify contrast and target size by measurement.

### Don't

| Don't                                                          | Why                                                                          | Currently violated at                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Don't use gradients to differentiate game modes                | The rule bans interchangeable gradient cards; gradients carry no information | `app/game-center/page.tsx` — 5 `bg-linear-to-br` cards                                        |
| Don't use a card grid where a list belongs                     | A bento grid without functional reason                                       | `app/dashboard/page.tsx` — 4-up KPI grid of `--`                                              |
| Don't use emoji as icons                                       | One SVG family, sized by token                                               | 15 occurrences across `app/` and `src/components/`                                            |
| Don't use a second accent colour                               | The palette has exactly one accent                                           | `bg-blue-800` / `bg-purple-800` in `ThrowInputPad.tsx`, `bg-blue-600` in `app/lobby/page.tsx` |
| Don't invent statistics                                        | No fake averages, counts or charts                                           | The dashboard's four `--` tiles are one step from invented data                               |
| Don't write marketing copy the engine doesn't implement        | State the real rule                                                          | Hub says 501/301 "finish on a double"; the engine runs `outRule: "straight"`                  |
| Don't use pills or excessive rounding                          | Instrument surfaces, not pills                                               | `rounded-xl`/`rounded-lg` everywhere; `rounded-full` progress bar in `app/career/page.tsx`    |
| Don't remove focus rings                                       | 2px cream ring, always                                                       | `focus:outline-none` in `PlayerSetup.tsx:57`                                                  |
| Don't use layout-shifting hover                                | No `scale`                                                                   | `hover:scale-[1.02]` in `app/game-center/page.tsx`                                            |
| Don't animate a changing number                                | It changes instantly                                                         | —                                                                                             |
| Don't use `font-mono` from the default stack for scores        | Set the stack deliberately; use tabular figures                              | `font-mono` used without a family decision                                                    |
| Don't let a score column resize                                | Fixed width, tabular figures                                                 | No `tabular-nums` anywhere                                                                    |
| Don't build five match UIs                                     | One shell, five modes                                                        | Cricket / ATC / Shanghai each have a private UI                                               |
| Don't add a dependency for a visual flourish                   | No GSAP for scroll-reveal                                                    | The persisted tool suggested GSAP; it is not a dependency and must not be added               |
| Don't ship a control below 44×44px                             | Minimum target                                                               | All 39 pad keys at 43×36px                                                                    |
| Don't draw a simplified target disc                            | The board is a real board                                                    | The previous round's 512px ring of 44px squares                                               |
| Don't re-implement the board geometry                          | One resolver, three sources                                                  | The camera's `HitDetector` prose algorithm                                                    |
| Don't send a scoring throw without its segment                 | Double Out is unwinnable without it                                          | `engine.recordThrow({ playerId, points })` in `app/game/page.tsx`                             |
| Don't send a segment with a miss                               | `isValidSegmentScore` rejects `points <= 0`                                  | A validation error, not a zero-scoring throw                                                  |
| Don't read a bust from the engine's returned state             | The bust is a thrown error                                                   | The UI computes it, or the chip never appears                                                 |
| Don't offer a 12-pixel target to a finger                      | A false affordance                                                           | The board as an input at 390 px                                                               |
| Don't write a bare `space-N` class                             | Tailwind v4 has no axis-less `space-*` utility                               | Use `space-y-N` / `space-x-N` / `gap-N`                                                       |
| Don't name a `next/font` variable the same as a `@theme` token | One silently overwrites the other                                            | `--font-display` used for both                                                                |

---

## 13. What an implementer still needs to confirm

Recorded so nothing is silently assumed.

1. **The checkout rule must be chosen at match setup, and the copy must follow the engine.** The engine supports `OutRuleId = "double" | "master" | "straight"` and `MatchConfig.outRule`, but no UI passes it, so the mode falls back to `"straight"` while the hub advertises a double. **The decision: the player chooses at match setup, and the default for 501 and 301 is Double Out** — the sport's standard, and the only rule that makes the `segment` field mean something. The fix has **two** halves and both are required:
   - `Standard501Mode` and `Standard301Mode` are constructed with `outRule: "double"`, so the advertised rule is the default rule; **and**
   - the setup surface passes the player's choice through `MatchConfig.outRule` to `eng.startMatch({ playerIds, outRule })`.
   - **The Game Center rule sheet is generated from the mode registry**, so it can never again disagree with the engine. The corrected copy: a **Checkout** column reading `Double out` for 501 and 301 and `—` for the other three, and the footnote _"Checkout rule is chosen when the match starts: Double out, Master out or Straight out. 501 and 301 start on Double out."_
2. **`segment` must be sent on every scoring throw.** `ThrowInput.segment` exists and `GameEngine.validateThrowInput` already validates it via `isValidSegmentScore`. Without it, Double Out cannot be won and the semantic green/red has no data source. The board's `resolveBoardHit` and the pad's segment-labelled keys both produce it. **The exception is a miss**, which omits the segment entirely (`MASTER.md` §10.2.2).
3. **`CameraDTO` must carry the segment.** A score alone cannot say whether 24 points was a double or a treble, so a camera-only Double Out would be unwinnable. `CameraDTO` gains `segment`, populated by the shared `resolveBoardHit`.
4. **Leg/set data is optional.** `LegSetManager` only runs when `legs`/`sets` are configured. The sheet header must render `LEG 2/5` only when the data exists, and show nothing — not "1/1" — when it does not.
5. **`totalPoints` means different things per mode** (remaining in x01, targets hit in Around The Clock, marks in Shanghai). The score sheet's caption must be mode-aware: "REMAINING" for x01, "HIT" for Around The Clock, "MARKS" for Shanghai. The number treatment is identical; the label is not. **Cricket has no score column at all** — in cricket the targets _are_ the score, and the mode's own surface carries them.
6. **The three non-x01 modes are on the shared shell.** They share the strip, the dart pad, the status line and the score sheet with the x01 modes; only cricket's score surface is its own, because its score is a set of marks on targets rather than a number. What is still missing is a **second player**: all three are solo today, so the sheet's multi-player behaviour is untested.
7. **`ThrowSegment` must not be declared twice.** `src/game-engine/types.ts` re-exports `BoardSegment` from the board module rather than declaring its own copy.
8. **The bust is computed by the UI, not returned by the engine.** `StandardMode.applyThrow` throws `GameEngineStateError("Bust: …")` and leaves the state untouched, so a bust never arrives as a state. The UI determines it from the out rule, the remaining score and the dart — and must not string-match the error message, because "not your turn" is the same error class. A bust consumes no dart and ends no turn, so the BUST chip is UI-local visit state. Full detail in `MASTER.md` §10.2.1 and `board.md` §6.8.1.
9. **The non-x01 modes never read `segment`.** Cricket, Around The Clock and Shanghai derive their result from `points` alone; the board's segment is a UI label on those views. In cricket the inner bull (50) is **two** marks and the outer bull (25) is **one** — the bulls are not interchangeable. `MASTER.md` §10.2.3, `board.md` §6.8.2.
10. **The board module lives at `src/board/`, not `src/domain/board/`.** The repo uses flat feature folders under `src/`; there is no `src/domain/` and no `src/game/`. `.claude/architecture.md` lists both but that document is aspirational and stale. `board.md` §5 states the reasoning.

---

## 14. Where the documents live

| File                                          | Contents                                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DESIGN.md`                                   | This document — the central reference.                                                                                                                                               |
| `design-system/darthub/MASTER.md`             | Tokens, the persisted base verbatim, and the DartHub extension.                                                                                                                      |
| `design-system/darthub/board.md`              | **The dartboard specification** — geometry, colour, materials, lighting, the shared domain module, the interaction model, the target-size decision, the source modes and the layout. |
| `design-system/darthub/pages/game-center.md`  | Hub-specific overrides.                                                                                                                                                              |
| `design-system/darthub/pages/match.md`        | Match-view overrides — the shell, the score sheet, the pad, the board placement.                                                                                                     |
| `design-system/darthub/pages/shell.md`        | App-shell overrides — navigation, skip link, landmarks, the mobile tab bar.                                                                                                          |
| `design-system/darthub/pages/dashboard.md`    | Dashboard overrides — the profile sheet and its empty states.                                                                                                                        |
| `design-system/darthub/pages/lobby.md`        | Lobby overrides — the room list and its empty states.                                                                                                                                |
| `design-system/darthub/pages/career.md`       | Career overrides — the quest sheet and its progress bar.                                                                                                                             |
| `design-system/darthub/pages/home.md`         | Home overrides — the session surface.                                                                                                                                                |
| `reports/design/grounding/tw-verification.md` | Measured Tailwind v4 utility-generation findings behind the token decisions.                                                                                                         |
| `reports/design/01-platform-analysis.md`      | Platform audit + competitor analysis + opportunities.                                                                                                                                |
| `reports/design/02-direction-decision.md`     | The three directions, the rejections, the decision.                                                                                                                                  |
| `reports/design/03-visual-qc.md`              | Viewport-by-viewport QC pass.                                                                                                                                                        |

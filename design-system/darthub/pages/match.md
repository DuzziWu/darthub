# Match — Page Overrides

> **PROJECT:** DartHub
> **Page type:** Live match surface (five modes share one shell)
> **Overrides Master where stated.** For everything else, `design-system/darthub/MASTER.md` applies.
>
> **The board's own specification is `design-system/darthub/board.md`** — geometry, colour,
> materials, the resolver API, the interaction model, the target-size decision and the
> source modes. This file covers the _page_: the shell, the score sheet, the pad, the
> throw strip and the responsive behaviour.

---

## 1. What this page is

**One match-view shell, five modes.** 501, 301, Cricket, Around The Clock and Shanghai
are the _same surface_ with different mode data. They do not get private UIs. The three
non-x01 modes differ from the x01 modes in **what the score column means** (§5) — never in
the layout, the controls or the token layer.

The whole surface is tuned for one reading condition: **a player standing up, in bad
light, mid-turn.** Density beats whitespace here, and it beats it everywhere on this page.

---

## 2. The page shell

```
┌──────────────────────────────────────────────────────────────────────┐
│ DARTHUB   Game Center  Lobby  Career  Dashboard        [profile]    │ ← app shell (task 004)
├──────────────────────────────────────────────────────────────────────┤
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

**The shell owns the `<main>`.** `app/layout.tsx` renders `<main id="main" tabIndex={-1}>`.
**No match view renders its own `<main>`** — exactly one main landmark per route.

**The board is the central element.** It sits in a `bg-sunken` well with a 1 px `rule`
border — a lit object in a dark recess, which is the "board, after dark" direction made
literal. The score sheet is **beside** it, not above it; the throw strip runs along the
top.

**There is exactly one armed-segment control: the pad's segment radio group.** The board
_displays_ the armed band as a brass outline but hosts no segment keys of its own — the
`DartBoard` component takes `armedSegment` as a prop and has no change handler, so it
cannot be the control's owner. One state, one control, two read-outs.

---

## 3. The throw strip

56 px, full width, `bg-surface`, `border-b border-rule`, sticky below the app header.

| Slot     | Content                                                  | Type                                                         |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Mode     | "501", "Cricket" …                                       | `font-display` `text-heading` `text-ink`                     |
| Checkout | "DOUBLE OUT" — the rule in force, not the mode's default | `font-caption` uppercase, `border border-edge`, `rounded-xs` |
| Visit    | Up to three segment chips: `T20`, `T20`, `D16`           | `font-mono` `text-caption`, with a check or a cross          |
| Actions  | `UNDO`, `MENU` — 44 px targets                           | `secondary` / `ghost`                                        |

**All five modes carry the same four slots.** The strip is one component, so the
mode name, the badge, the visit chips and the actions are the same shape in every
mode — only the badge's words and the visit's contents change. The chips are the
shared `VisitChips` component, so the strip and the score sheet cannot drift apart.

**The checkout badge shows the rule actually in force** — the value passed to
`MatchConfig.outRule` — not the mode's default. If the player chose Master Out, the badge
reads `MASTER OUT` even though the mode's default is Double Out.

**The visit chips are assembled from two sources** (§6).

**Undo is out of scope for this plan.** The engine has no undo, so the button must not be
rendered as a live control until the engine supports it. If it is shown at all it is
`disabled` with an explanatory title — never a live button that does nothing.

---

## 4. The score sheet

One row per player, **in stable seating order** — players do not reorder as scores change.

| Element           | Spec                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row               | 56 px desktop / 64 px mobile, `border-b border-rule`. No fill, no radius, no card.                                                                   |
| Active marker     | 2 px brass left rail (`border-l-2 border-brass`) + `text-ink` vs `text-ink-muted` + a visible **"ON TURN"** caption.                                 |
| Name              | `font-label` `text-label`, `text-ink`, max 16ch, truncate with a `title` attribute.                                                                  |
| Score figure      | `font-mono` `text-score-xl`, `tabular-nums`, right-aligned, `min-w-[3ch]`. **Fixed column width — the column does not move when the score changes.** |
| Last visit        | Up to three segment badges, `font-mono` `text-caption`: `T20`, `D16`, `S7`, `BULL`.                                                                  |
| Throw tally       | Three dots — filled brass for darts thrown, `border-edge` outline for remaining. Always three, never a number.                                       |
| "ON TURN" caption | `font-caption` uppercase `text-brass`. This is what makes the brass rail accessible without colour.                                                  |

**No cards. No rounded boxes. No colour wash per player.** The sheet is ruled rows on the
page ground, separated by 1 px `rule` hairlines.

**The sheet's own surface.** The sheet is a raised surface — `bg-surface`,
`border border-rule`, `rounded-md` — like the dart pad beside it and like the three
non-x01 modes' score surfaces, so that all four read as one family. What the sheet
does _not_ have is a card per player: a row is a row, with a 1 px `rule` hairline under
it and no fill, no radius and no colour wash.

**Leg/set progress** (`LEG 2/5`, `SET 1/3`) renders in the sheet header **only when the
data exists** — `LegSetManager` only runs when `legs`/`sets` are configured. When it does
not, the header shows nothing — not "1/1".

---

## 5. The score column is mode-aware

`totalPoints` means different things per mode. The **number treatment is identical**; the
**label is not**.

| Mode             | Caption     | The number is                              |
| ---------------- | ----------- | ------------------------------------------ |
| 501 / 301        | `REMAINING` | points left to reach exactly 0             |
| Around The Clock | `HIT`       | targets hit so far                         |
| Shanghai         | `MARKS`     | marks scored across the match              |
| Cricket          | —           | no score column: the targets are the score |

The caption is `font-caption` uppercase `text-ink-faint`, in the sheet header, and its
right edge is the score's right edge — the width of the tally dots is reserved beside
it, so the caption always sits over the number it describes. This is the one place a
mode is allowed to differ in wording.

**Around The Clock's caption is `HIT`, not `TARGET`.** The target in play is the mode's
own panel, in brass, above the sheet; the sheet's number counts the targets hit so far.
The two are different facts and the caption says which one the number is.

---

## 6. The throw pipeline — four rules that are easy to get wrong

These are engine behaviours the UI cannot infer from the returned state. Full detail in
`MASTER.md` §10.2.1–§10.2.3 and `board.md` §6.8.

1. **Every scoring throw carries a segment.** `engine.recordThrow({ playerId, points, segment })`.
   Both the board click and the pad key produce `{ points, segment }`. Without the segment,
   Double Out is unwinnable.
2. **A miss carries no segment.** `isValidSegmentScore` rejects `points <= 0`, so a miss
   is `{ points: 0 }` with the field **omitted**. A miss with a segment is a validation
   error, not a zero-scoring throw.
3. **A bust is a thrown error, not a returned state.** `StandardMode.applyThrow` throws
   `GameEngineStateError("Bust: …")` and leaves the state untouched. **The UI computes the
   bust itself** from the out rule in force, the remaining score and the dart. It must not
   infer a bust from an unchanged score, and it must not string-match the error message —
   "not your turn" is the same error class. A bust **consumes no dart** and **ends no
   turn**, so the BUST chip is UI-local visit state.
4. **The three non-x01 modes never read `segment`.** Cricket, Around The Clock and
   Shanghai derive their result from `points` alone; the segment is a **UI label** on those
   views. In cricket the inner bull (50) is **two** marks and the outer bull (25) is
   **one** — the two bulls are not interchangeable.

**So the visit strip is assembled from two sources:** the engine's returned state for the
counted darts, and a small UI-local record for the busted dart. Both are needed for the
green-counted / red-bust chips.

**The turn indicator follows the engine's `currentPlayerId`**, never the UI's own notion of
whose turn it is.

---

## 7. The dart pad

The board is the pointer path; the pad is the universal one. Same model — _a segment and a
sector_ — expressed as discrete, conformant controls. Both feed one `throw(points, segment)`.

| Group                             | Keys                                           | Size                  |
| --------------------------------- | ---------------------------------------------- | --------------------- |
| **Segment** (`role="radiogroup"`) | `1× Single` · `2× Double` · `3× Treble`        | ≥ 44×44               |
| **Sector**                        | `1` … `20`                                     | ≥ 44×44, ≥ 8 px apart |
| **Bull / miss**                   | `50` (inner bull) · `25` (outer bull) · `MISS` | ≥ 44×44               |

- Every key's **visible label** is its value; its **accessible name** states the outcome —
  the `20` key is _"Treble 20, 60 points"_ when Treble is armed. The armed segment is named
  in the visible group label too, so the state never depends on colour.
- `MISS` is a first-class key, distinct from `0`, and it sends `{ points: 0 }` with no
  segment.
- The bull keys `50` and `25` are separate — different board regions, and in cricket
  different marks.
- Layout: 4 columns × 5 rows of sector keys, segment row above, bull/miss row below.
- **The armed segment is shared state**, owned by the match view and passed to both the pad
  and the board. Neither component holds its own copy.

---

## 8. Responsive

| Viewport | Layout                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1440** | Throw strip full width, 56 px. Two columns: the **board 600 px** in a sunken well on the left; the **score sheet + pad** (480 px column) on the right.                                                                                                                                                                                |
| **1024** | Same two-column arrangement. Board **520 px**, well padding 8 px, right column 400 px. Score sheet rows compress to `name · score · last visit`.                                                                                                                                                                                      |
| **390**  | **Single column, in this order:** throw strip (compact) → the active player's score card (promoted) → the other players' rows → the status line → the **pad** → the **board preview**. The strip's two text actions do not fit beside the mode name at this width, so the strip wraps to a second row: it is **~85 px** tall, not 48. |

**What the 390 layout does with a board that cannot shrink.** The treble band is 8 mm of a
451 mm board. At 300 px it is 5.3 px tall and the inner bull is 8.5 px across, while a
finger is ~40 px. **Shrinking it would be a false affordance**, so at 390 the board stops
being an input:

- It renders as a **300 px read-only preview**, labelled **"LAST DART"**, showing where the
  last dart landed. `pointer-events: none`, `aria-hidden="true"`, and it carries no buttons.
- The **pad is the input**, and it comes **before** the board in the reading order, so the
  player scores without scrolling.
- The live region and the throw strip carry the same information for assistive technology.

**No page-level horizontal scroll, ever** — verified by measurement at all three
viewports. The mobile bottom tab bar's height is reserved as the shell's `<main>` bottom
padding, so it never covers the last row.

---

## 9. Interaction states

| Element                | Default                              | Hover                                   | Focus-visible                                                                        | Active                 | Disabled                           |
| ---------------------- | ------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------- |
| Board bed              | —                                    | 16 % white wash + 0.8 mm cream edge     | 2 px cream outline **on the bed** + 1 px brass outline around the whole sector wedge | —                      | —                                  |
| Pad key                | `bg-raised` `text-ink` `border-edge` | `bg-board`, `border-brass-deep`, 120 ms | 2 px cream ring, 2 px offset                                                         | one step darker, 80 ms | `opacity-45`, `cursor-not-allowed` |
| Segment key (selected) | `bg-brass` `text-board`              | —                                       | 2 px cream ring                                                                      | —                      | —                                  |
| Mode-name / row link   | `text-ink`                           | `text-brass`                            | 2 px cream ring, 2 px offset                                                         | —                      | —                                  |

**A focus ring on a 9 px bed would be invisible**, so the focused board cell gets **two**
indicators: a 2 px cream outline on the bed itself, and a 1 px brass outline around the
whole sector wedge — an indicator at least 44 px across. This satisfies SC 2.4.7 (Focus
Visible, AA) and SC 2.4.11 (Focus Appearance, 2.2 AA).

**No layout-shifting hover. No `scale`, ever.** No shadow anywhere on this page.

---

## 10. Accessibility

- One `<main id="main">` from the shell. One `<h1>` per route, no level skips.
- The board is a `<div role="group" aria-label="Dartboard">` containing **62 real
  `<button>`s** in a **roving-tabindex grid** — 20 sectors × 3 beds plus both bulls. Each
  is named by its outcome ("Treble 20, 60 points"). `Tab` enters at the current cell,
  `←`/`→` move a sector, `↑`/`↓` move a band, `Enter`/`Space` throws.
- **One `aria-live="polite"` region per match screen** — it belongs to the screen, not to
  the board. It announces the phrase ("T20, 60 points. 140 remaining."), never the bare
  number.
- The pad is a normal set of buttons; the segment radio group uses `aria-checked` and
  names the armed state in its visible label.
- **Nothing about the board depends on colour.** Bed colour is redundant with band
  position; every state carries a word.
- `prefers-reduced-motion` removes the hit animation. The dart marker and the visit log
  still carry the state — **no state depends on an animation ending to become correct.**
- **The board's painted beds are a documented deviation** from WCAG 2.2 SC 2.5.8 (24×24 px).
  They cannot meet it — the treble band is 8 mm of a 451 mm board, and making it meet it
  would require a 1,353 px board. The mitigation is **implemented, not just cited**: the
  armed-band + numeral route, the pad, and the 62-cell keyboard grid all expose every
  outcome through conformant targets. **Do not claim SC 2.5.8 conformance for the beds.**
  See `board.md` §7.

---

## 11. Anti-patterns for this page

- ❌ A private match UI per mode — five layouts, five styles
- ❌ Emoji mode icons (`🎯`)
- ❌ A score that reflows as it falls — no tabular figures, no fixed column
- ❌ Inferring a bust from the absence of a state change
- ❌ Sending a segment with a miss
- ❌ Deriving a non-x01 mode's result from the segment instead of the points
- ❌ Collapsing cricket's two bulls into one
- ❌ Interchangeable gradient cards on the setup screen
- ❌ A `scale` hover, a glow, a confetti burst, a 180 animation
- ❌ A live `UNDO` button with no engine support behind it

# Home — Page Overrides

> **PROJECT:** DartHub
> **Page type:** Session surface
> **Overrides Master where stated.** For everything else, `design-system/darthub/MASTER.md` applies.

---

## 1. What this page is

**The session surface.** The player's next action, and nothing else.

The current `/` route renders a bare `<main><h1>DartHub</h1><p>Modular,
server-authoritative multiplayer dart game.</p></main>` — a heading and a sentence with no
type classes, inside a `<main>` that the shell will own.

This page is **not a landing page**. The design system rejects the "hero + features +
CTA" pattern outright — that pattern is what the persisted tool output suggested, and
`reports/design/02-direction-decision.md` records the rejection.

**What it is instead:** if the player has a match in progress or resumable, that match is
the page. If they do not, the page is a compact entry point into the Game Center.

---

## 2. Structure

**Two states, and only two.**

### 2.1 With a resumable match

```
┌──────────────────────────────────────────────────────────────┐
│ DARTHUB                                        [profile]     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ IN PROGRESS                                                   │
│ ──────────────────────────────────────────────────────────── │
│ 501 · Leg 2 of 5          Dave 140 · Sam 132                 │
│                                                              │
│                        [Resume match]                        │
│                                                              │
│ Your last result                                              │
│ ──────────────────────────────────────────────────────────── │
│ Tuesday · 501    won 3–1     +18 rating                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- The **mode name** is `font-display` `text-title` `text-ink`.
- The **scores** are `font-mono` `text-score-md`, tabular.
- **`Resume match`** is the page's one `primary` button — `bg-brass text-board`, 44 px+.
- The **last result** row is real data from the rating/result services: the date, the
  mode, the score line, and the rating change. **If there is no result, that section is
  not rendered.**

### 2.2 With nothing in progress

```
┌──────────────────────────────────────────────────────────────┐
│ DARTHUB                                        [profile]     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ DartHub                                                       │
│ Server-authoritative multiplayer darts.                       │
│                                                              │
│ MODE       START   WIN CONDITION       CHECKOUT   TARGETS     │
│ 501        501     Reach exactly 0      Double out  —          │
│ 301        301     Reach exactly 0      Double out  —          │
│ Cricket    —       Close 3 marks to score   —      20-15+Bull │
│ Around The Clock — Hit every target in order —      1-20,Bull │
│ Shanghai   —       Hit all 3 segments      —         1-7      │
│                                                              │
│ 3 darts per turn · Checkout rule is chosen when the match …   │
└──────────────────────────────────────────────────────────────┘
```

**The compact rule sheet.** This is the **same rule-sheet component** the Game Center
uses — `src/components/game/RuleSheet.tsx`, the one from
`design-system/darthub/pages/game-center.md` — rendered at a smaller measure. It is not
a second implementation: it is the shared component, and the home route's measure is
**720 px** against the Game Center's 900/1200 px.

**Reusing the Game Center's rule sheet is the point.** It means the rules on the home
page can never disagree with the rules on the hub, because they are the same component
reading the same mode registry. The earlier sketch of this page — a three-column list
with a `Play` button per row — was rejected: it would have been a second, differently
styled copy of the sheet, which §6 forbids.

**The page's own description line** is `font-body` `text-body` `text-ink-muted` — one
sentence, no marketing adjectives, no feature list, no pricing, no testimonials.

---

## 3. Interaction states

| Element                 | Default                                  | Hover                                   | Focus-visible                | Active                 |
| ----------------------- | ---------------------------------------- | --------------------------------------- | ---------------------------- | ---------------------- |
| `Resume match` / `Play` | `bg-brass` `text-board`                  | `bg-brass-deep` with a `text-ink` label | 2 px cream ring, 2 px offset | one step darker, 80 ms |
| Mode name link          | `font-display` `text-heading` `text-ink` | `text-brass`                            | 2 px cream ring, 2 px offset | —                      |
| Result row              | no fill, `border-b border-rule`          | `bg-surface`, 120 ms                    | n/a                          | —                      |

**Exactly one `primary` per screen.** On the resume state that is `Resume match`. On the
empty state it is the first `Play` — no, the `Play` actions are `secondary`; **the empty
state has no `primary` button at all**, because the sheet's rows _are_ the actions and a
primary button would compete with them. (If a primary is later required, it is a single
`Play 501` at the top.)

**This is the one documented exception to `MASTER.md` §10.1's "exactly one primary per
surface",** and it is deliberate. A brass `Play 501` would also make 501 the
favourite mode, which the system refuses to do: the modes are chosen by their rules,
not by their prominence. The empty home route therefore carries **no** primary action,
and the hub's other pages keep theirs.

---

## 4. Responsive

| Viewport | Layout                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1440** | The sheet, max-width 720 px, `px-8`, left-aligned.                                                                                                                        |
| **1024** | The sheet, 720 px, `px-8`.                                                                                                                                                |
| **390**  | The sheet, `px-4`. The compact rule sheet drops to its stacked definition-list form, exactly as the Game Center does at this width — the same component, the same reflow. |

**No horizontal scroll at 390 px.** The compact sheet's mode descriptions wrap; they are
never truncated with an ellipsis.

**The sheet is narrower here than on the hub, but it is not a different sheet.** The
columns are the same five, in the same order, from the same registry; only the measure
changes. The mode name still leads each row — `text-heading` in the mobile stack — and
the numbers beside it are still one step down.

---

## 5. Accessibility

- One `<h1>` — "DartHub". The section labels (`IN PROGRESS`, `Your last result`) are
  `font-caption` uppercase `text-ink-faint`.
- The rule sheet is a real `<table>` with a `<caption class="sr-only">` on desktop and the
  same `<dl>` reflow on mobile, as the Game Center specifies.
- The scores are `font-mono` with `tabular-nums`, so a three-digit score does not shift
  the row when it falls to two digits.
- Every interactive target ≥ 44×44 px with ≥ 8 px separation.
- **The empty state is stated, not implied** — the sheet shows the modes that are
  available rather than a blank space.

---

## 6. Anti-patterns for this page

- ❌ A hero image, a gradient background, or a marketing headline
- ❌ A features grid, a testimonial, or a pricing table
- ❌ A second, differently-styled copy of the rule sheet
- ❌ Hardcoded scores or a fabricated "your last match" row
- ❌ A `<main>` on the page — the shell owns it
- ❌ A second `primary` action competing with the sheet
- ❌ An emoji dartboard, target or trophy

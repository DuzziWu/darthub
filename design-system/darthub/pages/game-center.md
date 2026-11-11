# Game Center — Page Overrides

> **PROJECT:** DartHub
> **Page type:** Rule sheet / mode index
> **Persisted via:** UI/UX Pro Max `--page "game-center"`; the tool's generic output is retained in the appendix and **overridden** by the rules below.
> **Overrides Master where stated.** For everything else, `design-system/darthub/MASTER.md` applies.

---

## 1. What this page is

**A ruled sheet of game rules — not a grid of cards.**

The five game modes differ in _how they are played_, so the page shows _how they are played_. The modes are differentiated by their **rule content**, never by their colour. There is no per-mode hue anywhere on this page.

The tool's generic output for this page described a "Dashboard / Data View" with a "12-column grid for data flexibility", "Hover tooltips, chart zoom on click", "Allow multi-select and bulk edit" and "chart config". **None of that applies** — there is nothing to bulk-edit, nothing to zoom, and no charts on this page. Those suggestions are rejected in the appendix.

---

## 2. Structure

### 2.1 Header

- `font-display` / `text-display` (32px at 1440, 24px at 1024) / `text-ink` — **"GAME CENTER"**
- One line `font-body` / `text-body` / `text-ink-muted` beneath it. It explains what the page is, in one sentence. It is not marketing copy.
- A single `secondary` link at the right: **"How scoring works"** — a help affordance, not a CTA. There is **no `primary` button on this page**; choosing a mode is the primary action and it is the rows themselves.

### 2.2 The sheet

A real `<table>` with a `<caption class="sr-only">`:

| Column        | Content                                 | Type                                                        |
| ------------- | --------------------------------------- | ----------------------------------------------------------- |
| Mode          | The mode name                           | `font-display` / `text-title` / `text-ink` — the row's link |
| Start         | Starting score, or `—`                  | `font-mono` / `text-score-sm` / tabular                     |
| Win condition | How the mode ends                       | `font-body` / `text-body` / `text-ink-muted`                |
| Checkout      | The mode's **default** out rule, or `—` | `font-body` / `text-body` / `text-ink-muted`                |
| Targets       | The target set                          | `font-mono` / `text-score-sm` / tabular                     |

**Five columns.** "Darts per turn" is identical for every mode, so it is **not** a sixth
column — it appears once, in the generated footnote under the table (§2.6).

**The mode name leads the row; the numbers follow it.** The mode is what the player came
to choose, so its name is the largest thing in the row — `text-title` (24 px) in the
table, `text-heading` (18 px) in the mobile stack, where it is a heading and leads by
position. The start score and the target set are supporting data: mono and tabular, but
one step down at `text-score-sm` (18 px), so the eye lands on the mode and not on a
number beside it.

**One component, two routes.** The sheet is `src/components/game/RuleSheet.tsx`. The Game
Center renders it at its own measure (900 px, 1200 px above 1280); the home route
renders the same component at 720 px. It is never a second implementation — the rules on
the two pages are the same rules, read from the same registry.

- Row separator: `1px solid var(--color-rule)`. **No card fill, no border, no radius, no hover scale.**
- Hover: full-bleed `bg-surface` at 120ms `ease-out`.
- The mode name is the **only** link in the row. It names its destination: "Play 501".
- Column heads: `font-caption`, uppercase, `0.04em` tracking, `text-ink-faint`.

### 2.3 The rule content is generated, not written

**Requirement.** Every rule value on this page is read from the mode registry in `src/game-engine/modes/`, not typed as prose in the page file.

| Mode             | Source of truth                     | Values shown                                            |
| ---------------- | ----------------------------------- | ------------------------------------------------------- |
| 501              | `Standard501Mode`                   | Start **501** · Reach exactly 0 · **Double out** · —    |
| 301              | `Standard301Mode`                   | Start **301** · Reach exactly 0 · **Double out** · —    |
| Cricket          | `CRICKET_TARGETS`, `MARKS_TO_CLOSE` | — · Close **3** marks to score · — · **20-15 + Bull**   |
| Around The Clock | `AROUND_THE_CLOCK_TARGETS`          | — · Hit every target in order · — · **1-20, then Bull** |
| Shanghai         | `SHANGHAI_ROUNDS`, `roundTarget()`  | — · Hit all 3 segments in one round · — · **1-7**       |

**Why this is a hard requirement, not a nicety.** The current implementation hardcodes `"Classic x01 countdown — start at 501, finish on a double"` in `app/game-center/page.tsx`. The engine defaults to `outRule: "straight"` (`getOutRule(config.outRule ?? "straight")` in `StandardMode.ts`) and no UI passes `outRule` — so the page currently states a rule the product does not implement. Generating the sheet from the registry makes that class of drift impossible.

**The corrected copy.** The Checkout column reads the mode's **default** out rule, and the table carries one generated footnote:

> **Checkout rule is chosen when the match starts: Double out, Master out or Straight out. 501 and 301 start on Double out.**

**Two halves, both required.** The copy only becomes true when **both** of these land:

1. `Standard501Mode` and `Standard301Mode` are constructed with `outRule: "double"` — the advertised rule is the default rule; **and**
2. the match setup surface passes the player's choice through `MatchConfig.outRule` to `eng.startMatch({ playerIds, outRule })`.

**Also required:** the checkout rule must be shown as it is actually configured, and the setup surface must offer the choice the engine already supports (`double` / `master` / `straight`), with its plain-language rule beside each option:

| Option           | Rule                                           |
| ---------------- | ---------------------------------------------- |
| **Double out**   | _finish on a double_ (default for 501 and 301) |
| **Master out**   | _finish on a double or the inner bull_ (50)    |
| **Straight out** | _any finish counts_                            |

**"Master out" means the inner bull, and the copy must say so.** `MasterOutRule.isCheckout`
accepts `segment === "bull"` **only when `points === 50`** — the inner bull. The outer bull
(25) does **not** finish a leg under Master Out. The rule text therefore reads _"finish on a
double or the inner bull"_, not _"…or the bull"_, which would be wrong for a player who
aims at the outer 25.

### 2.4 The registry's contract

The registry lives at `src/game-engine/modes/registry.ts`, beside the modes it describes,
and exports one entry per mode:

```ts
export interface ModeRuleEntry {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly start: string | null; // "501" | null
  readonly winCondition: string;
  readonly checkout: string | null; // "Double out" | null
  readonly targets: string | null;
}
export const MODE_RULES: readonly ModeRuleEntry[];
```

**Display strings stay out of the registry; facts go in.** `winCondition`, `checkout` and
`targets` are facts about the mode. The registry is the one place that maps a mode to the
words the page shows, so a change to a mode's rules cannot silently leave the page
describing the old rules.

**Each entry's values are derived from the mode's own exported constants**, so they cannot
drift:

| Mode             | Values come from                                                               |
| ---------------- | ------------------------------------------------------------------------------ |
| 501              | `Standard501Mode` — start score 501; checkout from the mode's default out rule |
| 301              | `Standard301Mode` — start score 301; checkout from the mode's default out rule |
| Cricket          | `CRICKET_TARGETS` (20–15 + 25) and `MARKS_TO_CLOSE` (3)                        |
| Around The Clock | `AROUND_THE_CLOCK_TARGETS` (1–20, then 25)                                     |
| Shanghai         | `SHANGHAI_ROUNDS` (7) and `roundTarget()` (1–7)                                |

**The checkout column reads the mode's actual default, not a literal.** `StandardMode`
derives its `id` from the out rule (`describeOutRule`), so the default is observable — but
a literal `"Double out"` in the registry would drift the moment the mode default changed.
The registry reads the default out rule **from the mode instance** and formats it.

> **Ordering constraint.** The registry is created by the Game Center task; the mode
> defaults change in the x01 match task. **The sheet shows what the engine actually does,
> whatever that is at the time it renders.** If the mode default has not yet changed to
> `"double"`, the sheet says `Straight out` — it never claims a rule the engine is not
> enforcing.

**A test asserts the sheet's cell values equal the registry's entries**, so a change to the
registry changes the page. **No rule value is a literal in `app/game-center/page.tsx`.**

### 2.5 The mode name is the link, and it names its destination

The mode name is the row's **only** link, and its accessible name states the destination:
the `501` row's link reads _"Play 501"_. The `href` comes from the registry's `href`
field, so a mode's destination is a fact in one place rather than a string in the page.

### 2.6 Darts per turn is a constant, not a column

All five modes use `DARTS_PER_TURN` (3) from `@/game-engine`. It is therefore **not** a
per-row column — it is one generated footnote line under the table:

> **3 darts per turn · Checkout rule is chosen when the match starts: Double out, Master
> out or Straight out. 501 and 301 start on Double out.**

The first clause is a constant; the rest is generated from the registry.

### 2.7 The Board Source selector

The board source is chosen **at match setup**, not on this page — but the selector
component (`src/components/game/BoardSourceSelector.tsx`) is specified here, because it is
the same vocabulary everywhere it appears.

```
BOARD SOURCE
(•) Virtual Board      Ready — play on the built-in board.
( ) Camera Board       Planned — needs a camera and the computer-vision pipeline.   [PLANNED]
( ) Smart Dart         Planned — needs smart-dart hardware and its app.            [PLANNED]
```

| Rule                                                     | Detail                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Three options exactly**                                | `Virtual Board`, `Camera Board`, `Smart Dart`                                                                                                                |
| **The two planned options carry `aria-disabled="true"`** | **and stay focusable** — never the `disabled` attribute, which removes them from the tab order and hides the explanation                                     |
| **The reason is visible text**                           | Not a tooltip, not a colour. It is also the option's `aria-describedby` target.                                                                              |
| **Selecting a planned mode is impossible**               | The radio group's value is controlled by React state and the change handler **ignores** a selection of an unavailable option, keeping the current selection. |
| **No silent fallback**                                   | There is no "click and see", no empty board, no black rectangle.                                                                                             |

**`aria-disabled` alone does not prevent selection.** A radio with `aria-disabled="true"`
is still changeable by click and by keyboard — `aria-disabled` is a _semantic_ hint to
assistive technology, not a behavioural lock. Without the behavioural guard, a mouse click
on "Camera Board" silently selects it and the match starts with no board, which is exactly
the failure `board.md` §9.2 forbids.

The `BoardSource` type and the three source definitions live in the board module
(`src/board/boardSource.ts`), re-exported from `src/board/index.ts`. The **type is the
vocabulary**; the **component is the view**. The component takes `value` and `onChange` as
props and holds no state of its own beyond the guard above.

**The chosen source is shown in the match header** as a small label (`VIRTUAL BOARD`).
There is no mid-match switch: changing where your darts come from mid-leg would change
the rules of the leg in progress.

---

## 3. Responsive

| Viewport | Layout                                                                                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1440** | Full table, content max-width **1200px**, centred. Section rhythm `space-y-3xl` / `space-y-2xl`. Column heads visible.                                                                                               |
| **1024** | Same table, content max-width 900px. `text-display` → 24px. Column gap tightens to `gap-xl`.                                                                                                                         |
| **390**  | The table reflows to a **stacked definition list** per mode: mode name as an 18px condensed heading, then each rule as a `label / value` pair on its own line, `space-y-md` apart. Row separators remain 1px `rule`. |

**Implementation note for the mobile reflow.** A `<table>` cannot reflow to a `<dl>` in CSS. Either render two structures and toggle them, or use a single list of `<div>` rows with grid-template on desktop and stacked flow on mobile. Whichever is chosen, the **desktop version must use real `<table>` semantics** for screen-reader navigation, and the mobile version must expose the same label/value pairs.

**The footer.** The current page has no footer, and the plan's "keep the current navigation
and the mode count" instruction refers to something that does not exist. The shell owns
the `<footer>` landmark (see `pages/shell.md` §7), so **this page does not render one** —
the mode count appears in the generated footnote (§2.6) where it belongs, next to the
rules it describes.

---

## 4. Interaction states

| Element        | Default    | Hover                          | Focus-visible              | Active      |
| -------------- | ---------- | ------------------------------ | -------------------------- | ----------- |
| Row            | no fill    | `bg-surface` full-bleed, 120ms | 2px cream ring, 2px inset  | `bg-raised` |
| Mode-name link | `text-ink` | `text-brass`                   | 2px cream ring, 2px offset | —           |

No layout-shifting hover. No `scale`.

---

## 5. Accessibility

- One `<h1>` — "GAME CENTER".
- The sheet is a table on desktop with a `<caption class="sr-only">` naming the columns.
- The mode link's accessible name states the destination: "Play 501".
- "How scoring works" is a `<button>` opening a dialog, or a link to a route — either is fine; it must have an accessible name.
- Row hover is decorative; the link itself carries keyboard focus and the full accessible name.
- No colour-only distinction between modes — there is no per-mode colour at all.

---

## 6. Anti-patterns for this page

- ❌ Gradient cards, one per mode
- ❌ A per-mode accent colour or icon colour
- ❌ A "12-column grid for data flexibility"
- ❌ Charts, sparklines, or tooltips on a mode list
- ❌ Bulk-select / bulk-edit affordances
- ❌ A hero section, a marketing headline, or a CTA banner
- ❌ Hardcoded rule prose that can drift from the engine
- ❌ A hero image or illustration of a dartboard that carries no information
- ❌ Emoji mode icons (`🎯` is currently used on the game pages)

---

## Appendix — the tool's generic page output, and what was rejected

The UI/UX Pro Max `--page "game-center"` output produced:

- Page Type: "Dashboard / Data View"
- Layout: "Max Width: 1400px or full-width", "Grid: 12-column grid for data flexibility"
- Spacing: "Content Density: High — optimize for information display"
- Components: "Avoid: Single row actions only", "Avoid: Reject linear easing even for steady rotation or progress", "Avoid: Auto-play high-resolution loops without pause or captions"
- Recommendations: "Effects: Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, data loading spinners", "Data Entry: Allow multi-select and bulk edit", "Animation: Use deceleration when arriving acceleration when leaving and linear for constant-rate progress", "Sustainability: Prefer click-to-play; provide pause and captions; stop off-screen and honor reduced motion"

**Kept:** "row highlighting on hover" (as `bg-surface`, not a colour wash), "Use deceleration when arriving" (→ `--ease-out`), and "honor reduced motion".

**Rejected:** the 12-column data-flexibility grid (this page has one table, not a data canvas); "1400px or full-width" (a rule sheet needs a readable measure — 1200px max); hover tooltips and chart zoom (no charts here); multi-select and bulk edit (there is nothing to bulk-edit); spinners (the mode list is static, and the tool's own anti-pattern list bans "instant state changes" but the sheet renders instantly); auto-play media (there is no media).

**Why the whole "Dashboard / Data View" framing is wrong here.** A mode index is a _reference_, not a dashboard. Framing it as a data view is what produced the "12-column grid" and "chart zoom" suggestions in the first place. The page is a table of rules, and it should look like one.

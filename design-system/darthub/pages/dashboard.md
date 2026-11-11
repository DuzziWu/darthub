# Dashboard — Page Overrides

> **PROJECT:** DartHub
> **Page type:** Player profile sheet
> **Overrides Master where stated.** For everything else, `design-system/darthub/MASTER.md` applies.

---

## 1. What this page is

**A ruled sheet of what the player has actually done.** Not a KPI dashboard.

The current page renders four tiles whose value is the literal string `--`. That is the
anti-pattern this page replaces: a placeholder where a number should be, in a card grid
with no functional reason to be a grid.

**The rule that governs this page: never show a number that is not real.** There is no
fake average, no fake player count, no filler chart. Where the data does not exist, the
page says so honestly.

---

## 2. Structure

A single ruled sheet, max-width 720 px, one row per figure:

```
┌────────────────────────────────────────────────────────┐
│ DASHBOARD                                             │
│                                                        │
│ RATING          1420                X01 · Elo         │  ← ruled row
│ ────────────────────────────────────────────────────── │
│ LEVEL           7                                     │  ← ruled row
│ ────────────────────────────────────────────────────── │
│ XP              340 / 500 to level 8                   │  ← ruled row
│ ────────────────────────────────────────────────────── │
│ FRIENDS         3                                     │  ← ruled row
│ ────────────────────────────────────────────────────── │
│ MATCHES         12 played · 3,180 points · 9 checkouts │  ← ruled row
└────────────────────────────────────────────────────────┘
```

Each row is a **ruled row on the page ground**, not a card: a label column on the left in
`font-caption` uppercase `text-ink-faint`, the value on the right in `font-mono`
`text-score-md`, separated by a 1 px `rule` hairline. No fill, no radius, no card.

**The values are real and they come from the services that already exist:**

| Row       | Source                                                      | Notes                                                                                                             |
| --------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `RATING`  | `ratingService.getRatingProfile` → `RatingProfile`          | The Elo rating, with the mode it belongs to (`X01` by default) as a caption.                                      |
| `LEVEL`   | `career/progressionService` — the player's level            | Real career level, if the player has career progress.                                                             |
| `XP`      | `xpRequiredForNextLevel(currentLevel)`                      | **Both numbers are real**: XP earned, and XP required for the next level. The denominator is never a round guess. |
| `FRIENDS` | `friendService.listFriends`                                 | A real count of real friends.                                                                                     |
| `MATCHES` | `ratingRepository.getGameStatsSummary` → `GameStatsSummary` | `gamesPlayed`, `points`, `checkouts` are real fields on that type.                                                |

**No invented statistics.** If a service returns nothing, the row shows its empty state
rather than a zero.

---

## 3. Empty states

The dashboard's honest empty state, preserved verbatim from the current page:

> **No completed matches yet.**
> Finish a leg to see your rating, average and checkout rate here.

The page renders the sheet **with the rows in place and the empty state in the value
column** — so the player learns what the page will show them, without a fake value.

**Never `--`, never `0`, never a placeholder number.** A `0` is a claim that the number is
zero, which is a different statement from "we do not know yet". Where the service returns
`null`, the value cell shows the empty state's short form — e.g. `No matches yet` in
`font-body` `text-ink-muted`, not a number.

**One empty state covers the whole page** when there is nothing at all — the rows are not
rendered at all in that case, because a sheet of empty rows is noise.

---

## 4. Interaction states

This page is mostly read-only.

| Element                           | Default    | Hover                           | Focus-visible                |
| --------------------------------- | ---------- | ------------------------------- | ---------------------------- |
| Row                               | no fill    | `bg-surface` full-bleed, 120 ms | n/a — not interactive        |
| Value link (e.g. a mode's rating) | `text-ink` | `text-brass`                    | 2 px cream ring, 2 px offset |

The only interactive elements are links to a mode's own detail and to the Lobby/Career
pages. Everything else is static text.

**There is no `primary` button on this page.** A dashboard is a reading surface. If a
"Play a match" action is added, it is the one `primary` and it is the only one.

---

## 5. Responsive

| Viewport | Layout                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **1440** | The sheet, 720 px, left-aligned in the page's 1440 px container with `px-8`. Not centred — a reading sheet reads better at a stable left edge. |
| **1024** | Same sheet, 720 px, `px-8`.                                                                                                                    |
| **390**  | Same sheet, `px-4`. The label column shrinks to its content width; the value column is right-aligned and never wraps mid-number.               |

**No horizontal scroll at 390 px.** The value column is `text-right` and the numbers are
`font-mono`, so a long value wraps rather than overflowing.

---

## 6. Accessibility

- One `<h1>` — "Dashboard". Section labels are `font-caption` uppercase in `text-ink-faint`,
  which is ≥ 4.5:1 on the page ground.
- The sheet is a `<dl>` — `<dt>` for the label, `<dd>` for the value. A definition list is
  the correct structure for label/value pairs, and it is what the screen reader reads.
- Every number is `font-mono` with `tabular-nums` and a fixed width, so a rating changing
  from 3 to 4 digits does not shift the column.
- **Colour never carries meaning here.** The sheet is a neutral ramp; there is no
  "good rating" green and no "bad rating" red.

---

## 7. Anti-patterns for this page

- ❌ A KPI card grid — four tiles in a 2×2 layout with no functional reason
- ❌ `--` as a value
- ❌ A `0` standing in for "unknown"
- ❌ An average, a trend, or a chart that is not backed by real data
- ❌ A "recent activity" feed with invented entries
- ❌ Per-mode colour coding
- ❌ An emoji trophy, crown or medal

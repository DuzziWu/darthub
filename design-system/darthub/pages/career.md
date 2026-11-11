# Career — Page Overrides

> **PROJECT:** DartHub
> **Page type:** Quest sheet
> **Overrides Master where stated.** For everything else, `design-system/darthub/MASTER.md` applies.

---

## 1. What this page is

**A quest sheet.** The player reads the current quest, sees real progress, and picks up
the next training lesson.

**The quest content is real and already exists.** `src/career/quests/*.json` holds six
quest definitions — `intro`, `sample`, `training-aiming-fundamentals`,
`training-checkout-practice`, `training-double-out`, `rivalry-prodigy` — read and
validated through `createQuestLoaderService()`. The page shows **those** quests, with
**their** names and descriptions.

**Do not reconstruct the catalogue from the filenames.** The filenames are implementation
detail; the quest's `name` and `description` in the JSON are the content. A quest called
`intro.json` is named _"First Flight"_.

---

## 2. Structure

```
┌──────────────────────────────────────────────────────────────┐
│ CAREER MODE                                                   │
│                                                              │
│ CURRENT QUEST                                                 │
│ ──────────────────────────────────────────────────────────── │
│ First Flight                                                  │
│ Meet Coach 'The Veteran' and learn the basics of dart        │
│ throwing. Throw 3 practice darts to prove you're ready.      │
│                                                              │
│ PROGRESS                                                      │
│ ████████████████░░░░░░░░░░░░░░░░░░░░  2 / 3 objectives     │
│                                                              │
│ TRAINING                                                      │
│ ──────────────────────────────────────────────────────────── │
│ Checkout Practice        Level 2            Throw a double    │
│ Double Out               Level 3            Finish on a D16  │
└──────────────────────────────────────────────────────────────┘
```

**Three sections, ruled, on the page ground** — not three rounded panels. The current
page renders exactly this content as three `bg-slate-800 rounded-lg` boxes with a
`rounded-full` blue progress bar; that is what this page replaces.

| Section         | Content                                                           | Source                                                                 |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `CURRENT QUEST` | The active quest's `name` and `description`                       | `questLoader.getNextQuest(playerLevel, completedQuestIds)`             |
| `PROGRESS`      | Completed objectives vs total, for the active quest               | The quest's `stages[].objectives[]` against `careerProgressRepository` |
| `TRAINING`      | The quests available next, with their real names and descriptions | `questLoader.getQuests()`                                              |

**The quest name** is `font-display` `text-title` `text-ink`. **The description** is
`font-body` `text-body` `text-ink-muted`, max 70ch — a quest description is read, not
scanned, so it gets a comfortable measure.

---

## 3. The progress bar

The current bar is `w-full bg-slate-700 rounded-full h-3` with a `bg-blue-600` fill at a
hardcoded `0%`. **All three of those are wrong**: the pill shape is banned, the blue is not
in the palette, and the `0%` is fabricated.

| Part   | Spec                                                                                         |
| ------ | -------------------------------------------------------------------------------------------- |
| Track  | `bg-sunken`, `border border-edge`, `rounded-sm` (3 px — **not** `rounded-full`), height 8 px |
| Fill   | `bg-brass`, `rounded-sm`, width = the real percentage                                        |
| Figure | `font-mono` `text-score-sm` `text-ink` — e.g. `2 / 3 objectives`                             |

**The percentage comes from the quest data** — completed objectives divided by total
objectives — and the **figure is shown as a ratio, not only as a percentage.** `2 / 3
objectives` tells the player what is left; `66%` alone does not. The ratio is also
**wider and taller than the bar**, so the number is legible at a glance rather than
requiring a close read of a thin fill.

**When there is no active quest, the progress section is not rendered.** A bar at 0% with
no quest is a meaningless graphic.

---

## 4. Empty states

**No active quest.** The current page's "No active quest" is already honest and stays:

> **No active quest.**
> Finish a match to unlock your first training quest.

**No training available.** "No training available" is the honest string, and it stays
when the loader genuinely returns no unlocked quests.

**Progress unavailable.** If the progress repository is empty or unreachable, the
`PROGRESS` section shows:

> **No progress yet.**
> Complete a training lesson to see your progress here.

**Never a fabricated percentage, and never a `0%` bar standing in for "unknown".**

---

## 5. Interaction states

| Element                            | Default                         | Hover                | Focus-visible                | Active |
| ---------------------------------- | ------------------------------- | -------------------- | ---------------------------- | ------ |
| Training row                       | no fill, `border-b border-rule` | `bg-surface`, 120 ms | n/a                          | —      |
| Training row link (the quest name) | `text-ink`                      | `text-brass`         | 2 px cream ring, 2 px offset | —      |

Training rows are links to the quest. There is no `primary` button on this page — the
section is a list, and the rows are the actions.

---

## 6. Responsive

| Viewport | Layout                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **1440** | The sheet, max-width 720 px, `px-8`.                                                                                                        |
| **1024** | Same sheet, 720 px.                                                                                                                         |
| **390**  | Same sheet, `px-4`. The training row's name and its level wrap onto two lines; the description stays at `text-body` and is never truncated. |

**No horizontal scroll at 390 px.**

---

## 7. Accessibility

- One `<h1>` — "Career Mode". The three section labels are `font-caption` uppercase
  `text-ink-faint`.
- **The progress bar is not a bare `<div>` with a width.** It carries
  `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax` set to
  the objective total, and `aria-valuetext` reading e.g. "2 of 3 objectives completed".
  A screen reader must be able to read the progress, not see a coloured rectangle.
- The figure beside the bar (`2 / 3 objectives`) is real text, so the information is
  available without the ARIA at all.
- **Contrast:** the `brass` fill on the `sunken` track is 7.77:1 — well above the 3:1
  non-text minimum. The `edge` border is the track's own boundary at 3.16:1.
- Every interactive target ≥ 44×44 px.

---

## 8. Anti-patterns for this page

- ❌ A `rounded-full` progress bar — a pill is banned
- ❌ A blue progress fill — the palette has one accent, and it is brass
- ❌ A hardcoded `width: "0%"` standing in for progress
- ❌ A percentage with no count — "66%" does not say "2 of 3"
- ❌ A quest catalogue reconstructed from filenames
- ❌ A progress bar with no accessible value
- ❌ A quest list with invented names or descriptions

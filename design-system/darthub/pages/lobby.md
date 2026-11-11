# Lobby — Page Overrides

> **PROJECT:** DartHub
> **Page type:** Multiplayer entry point
> **Overrides Master where stated.** For everything else, `design-system/darthub/MASTER.md` applies.

---

## 1. What this page is

**The multiplayer entry point.** The current page is three stacked panels — Matchmaking,
Public Rooms, Private Room — each a rounded slate box, with a blue "Find Match" button and
a green "Create Room" button. That is the generic layout.

This page is a **room list**. A room list is a list.

**The multiplayer backend is not part of this plan.** The page states what it is and what
it needs; it does not pretend to have rooms it does not have.

---

## 2. Structure

```
┌──────────────────────────────────────────────────────────────┐
│ LOBBY                                       [Find Match]     │
│                                                              │
│ PUBLIC ROOMS                                                  │
│ ──────────────────────────────────────────────────────────── │
│ Tuesday Club          Hosted by Sam      501      3/4  [Join]│
│ ──────────────────────────────────────────────────────────── │
│ Practice Room         Hosted by Alex     Cricket   2/2  [Join]│
│                                                              │
│ PRIVATE ROOM                                    [Create Room]│
└──────────────────────────────────────────────────────────────┘
```

**One `<table>` for the room list**, with a `<caption class="sr-only">` naming the columns.
Same reflow rule as the Game Center sheet: at 390 px it becomes a stacked definition list
per room.

| Column  | Content                   | Type                                     |
| ------- | ------------------------- | ---------------------------------------- |
| Room    | The room's name           | `font-display` `text-heading` `text-ink` |
| Host    | Who created it            | `font-body` `text-body` `text-ink-muted` |
| Mode    | Which game the room plays | `font-mono` `text-score-sm`              |
| Players | Real count, e.g. "3/4"    | `font-mono` `text-score-sm`              |
| Action  | A `Join` button           | `secondary`, 44 px                       |

**Row separator:** 1 px `rule` hairline. **No card fill, no border, no radius, no hover
scale.** Hover is `bg-surface`, full-bleed, 120 ms.

---

## 3. The two actions

**`Find Match`** and **`Create Room`** are the page's two actions. Per `DESIGN.md` §8.1
they sit side by side, **not** in separate panels.

| Action        | Variant                                        | Placement                     |
| ------------- | ---------------------------------------------- | ----------------------------- |
| `Find Match`  | `primary` — `bg-brass text-board`              | Top right of the header row   |
| `Create Room` | `secondary` — `bg-raised text-ink border-edge` | The Private Room row's action |

**Exactly one `primary` per surface.** `Find Match` is it — it is the action a player
arrives intending to take.

---

## 4. Empty and error states

**No public rooms.** The table is replaced by one honest empty state:

> **No public rooms right now.**
> Start a private room and invite someone, or find a match.

Both are real actions that exist on this page.

**Matchmaking is unavailable.** If the matchmaking service is not running, `Find Match` is
`disabled` with a visible reason beside it — _"Matchmaking is offline"_ — and the page
does not show a spinner that never resolves.

**A failed join.** The error appears inline on the row that failed, in `text-double` with
a warning icon and `aria-live="polite"`. **Never colour alone.**

---

## 5. Interaction states

| Element      | Default                              | Hover                                   | Focus-visible                | Active                 | Disabled                           |
| ------------ | ------------------------------------ | --------------------------------------- | ---------------------------- | ---------------------- | ---------------------------------- |
| Row          | no fill                              | `bg-surface`, 120 ms                    | n/a                          | —                      | —                                  |
| Join button  | `bg-raised` `text-ink` `border-edge` | `bg-board`, `border-brass-deep`         | 2 px cream ring, 2 px offset | one step darker, 80 ms | `opacity-45`, `cursor-not-allowed` |
| `Find Match` | `bg-brass` `text-board`              | `bg-brass-deep` with a `text-ink` label | 2 px cream ring, 2 px offset | one step darker, 80 ms | `opacity-45`                       |

**No layout-shifting hover. No `scale`.**

---

## 6. Responsive

| Viewport | Layout                                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1440** | The room table, max-width 900 px. The header row carries the h1 on the left and `Find Match` on the right.                                                                                                        |
| **1024** | Same table, 900 px, `px-8`.                                                                                                                                                                                       |
| **390**  | Stacked definition list per room: the room name as an 18 px condensed heading, then host / mode / players as `label / value` pairs, `space-y-md` apart. The `Join` button is full width below each room's values. |

**No horizontal scroll at 390 px.**

---

## 7. Accessibility

- One `<h1>` — "Lobby". Section headings are `font-caption` uppercase `text-ink-faint`.
- The room list is a real `<table>` with a `<caption class="sr-only">` on desktop and a
  `<dl>` with the same label/value pairs on mobile.
- **Every `Join` button states which room it joins** — its accessible name is "Join
  Tuesday Club", not a bare "Join". A list of identical buttons is a screen-reader wall.
- The `Join` button is 44 px tall. The player count uses `font-mono` so it does not shift
  as it changes.
- Every interactive target ≥ 44×44 px with ≥ 8 px separation.

---

## 8. Anti-patterns for this page

- ❌ Three separate rounded panels, one per concern
- ❌ A blue `Find Match` and a green `Create Room` — the palette has one accent
- ❌ Fake rooms to fill the table
- ❌ A player count that is a guess
- ❌ A spinner that never resolves when matchmaking is offline
- ❌ Identical "Join" buttons with no accessible name distinguishing them
- ❌ A per-room colour

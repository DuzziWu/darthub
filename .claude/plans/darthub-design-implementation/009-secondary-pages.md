# Task 009: Bring dashboard, lobby, career and the home route into the system

**Status**: completed
**Depends on**: 001, 004

**Files this task owns:** `app/page.tsx`, `app/dashboard/page.tsx`, `app/lobby/page.tsx`, `app/career/page.tsx`, and the updates to `tests/unit/ui/*.test.tsx` + their snapshots and `tests/integration/ui-skeletons.test.tsx`. **Files this task does not touch:** the five match views (tasks 005 and 008), `app/game-center/page.tsx` (task 006), `src/components/**` (task 007).
**Retry count**: 0

## Description
The remaining four routes are bare stubs with no theme classes of their own. Give them the design system's shell and token layer so the application is coherent end to end, without inventing content for them.

## Context
### Read first
- `DESIGN.md` — §8 for the component specs, §10 for the responsive behaviour, §12 for the do/don't list.
- `design-system/darthub/MASTER.md` Part III.

### Files
- `app/page.tsx` — the home route. It currently renders a bare `<main><h1>DartHub</h1><p>…</p></main>` with no theme classes.
- `app/dashboard/page.tsx` — the dashboard.
- `app/lobby/page.tsx` — the lobby.
- `app/career/page.tsx` — the career page.

**These four pages currently render their own `<main>` elements** (as do all the other routes). Task 004 converted them to `<div>`; this task must not reintroduce a `<main>`. Each page renders inside the shell's `<main id="main">`.

### The constraint that matters most
**No invented data.** The dashboard stub already has an empty state — "No completed matches yet / Finish a leg to see your rating, average and checkout rate here." That empty state is honest and must stay honest. The career page must not show quest progress that does not exist, and the lobby must not show players who are not there.

If a page has no real data to show, it shows its **empty state** — a helpful message and the action that would fill it. That is the design system's answer, and it is explicitly allowed by the rules ("no invented statistics or data").

### What already exists — check these before designing anything
The career page is not a bare stub. These exist today and are the real sources:

| What | Where |
|---|---|
| Quest definitions | `src/career/quests/*.json` — 6 files (`intro`, `sample`, `training-aiming-fundamentals`, `training-checkout-practice`, `training-double-out`, `rivalry-prodigy`) |
| Quest loader | `src/career/questLoader.ts` — `createQuestLoaderService()` reads and validates them |
| Quest schema | `src/career/questSchema.ts` |
| Player progress | `src/career/careerProgressRepository.ts` — `CareerProgressRepository`, with an in-memory implementation |
| Progress API | `app/api/career/progress/route.ts` |
| Quest API | `app/api/career/quest/route.ts` |
| Complete-quest API | `app/api/career/complete/route.ts` |
| XP and level maths | `src/career/progressionService.ts` — `calculateXpForLevel`, `xpRequiredForNextLevel`, `getUnlockablesForLevel` |

**The quest list is real, known content.** The career page may show the quests that exist, with their real names and descriptions, read from the loader. What it may **not** show is progress the player has not made — no XP number, no completion percentage, no "unlocked" state that is not backed by the repository. If progress is unavailable or empty, the progress section shows its empty state.

**Do not fabricate a quest catalogue from the JSON filenames.** Read the quest objects through the loader so the names and descriptions shown are the ones in the files.

### What each page becomes
- **Home (`/`)** — the entry point: what DartHub is, and the one primary action into the Game Center. It is **not** a hero-and-features landing page — the design system rejects that pattern outright. Read `DESIGN.md` for what it specifies.
- **Dashboard** — the player's own match history, ratings and career progress. With no completed matches, that is the empty state.
- **Lobby** — the multiplayer entry point. The multiplayer backend is not part of this plan, so the lobby states what it is and what it needs rather than pretending to have rooms.
- **Career** — the career-mode quest surface: the real quests from the loader, plus the player's real progress where it exists and the empty state where it does not.

### Rules
- Token layer only — no palette utilities.
- The app shell from task 004 wraps all four.
- Every page keeps its existing route and its existing content intent. **Only the presentation changes** — plus the empty-state treatment, which is a presentation concern.
- **One primary action per screen.** Secondary actions are visually subordinate.
- The hierarchy is clear: size, spacing and contrast, not colour alone.
- No decorative elements without a purpose. No filler charts, no placeholder statistics.
- Responsive per `DESIGN.md` §10; no horizontal scroll at 390 px.

## Requirements (Test Descriptions)
- [x] `it renders every route inside the app shell`
- [x] `it uses only semantic tokens and no palette utilities`
- [x] `it shows an empty state instead of invented data when there is no data`
- [x] `it offers one primary action per screen`
- [x] `it renders without a horizontal scrollbar at 390 pixels`

## Acceptance Criteria
- All four routes render inside the shell with the token layer, and inside the shell's `<main>` — no page-level `<main>`.
- **No invented data anywhere.** Every number, name, quest or player shown traces to something real. The dashboard's honest empty state is preserved.
- The career page shows only quest data that exists in `src/career/quests/` and progress from the repository or the progress API — **read through `createQuestLoaderService()`, not reconstructed from filenames**. With no progress, the progress section shows its empty state.
- Exactly one primary action per screen, per the design system.
- No horizontal scrollbar at 390 px; the responsive behaviour follows `DESIGN.md` §10.
- `npm run typecheck`, `npm run lint` and `npm run test` stay green (no new failures).

### The three UI unit tests that will break
`tests/unit/ui/dashboard.test.tsx`, `lobby.test.tsx` and `career.test.tsx` assert on the **old markup** — specific Tailwind classes (`min-h-screen`, `grid-cols-1`, `md:p-8`, `bg-slate-700`, `bg-blue-600`), specific placeholder strings, and **stored snapshots** (`tests/unit/ui/__snapshots__/*.snap`).

The class-name assertions fail the moment the pages move to the token layer, and the snapshots fail on any markup change. These tests must be **updated to assert the new design's contract** — the semantic content ("Career Mode", "Current Quest", "Progress", "Training", "No active quest", the lobby's sections) and the token classes — not deleted. A snapshot that is simply re-recorded with `--update` proves nothing; the semantic assertions are the ones that carry value.

`tests/integration/ui-skeletons.test.tsx` asserts the same three pages render without crashing and mentions "Rating", "Level", "Friends" for the dashboard and "Quest"/"Progress"/"Training" for the career page — check each against the new content and update what genuinely changed. The dashboard's four `--` placeholder tiles are called out in `DESIGN.md` §12 as *"one step from invented data"* — replacing them with the honest empty state is the intended change, and the test's expectation follows.

## Implementation Notes

All four routes are now on the token layer, render inside the shell's `<main>`, and
show honest empty states instead of invented data.

### What each page became

- **Home (`/`)** — the entry point: the wordmark's title, one line of copy, and the
  one primary action, "Open the Game Center", into the hub. `home.md` also describes a
  compact rule sheet on the home route, but that sheet is the Game Center's component
  (task 006) and reusing it here would mean editing `app/game-center/page.tsx`, which
  this task does not own. A link into the hub avoids a second, differently-styled copy
  of the rule sheet — the anti-pattern `home.md` §7 lists explicitly — so the home
  route carries no mode list of its own.
- **Dashboard** — the four `--` tiles are gone. `dashboard.md` §2 specifies a ruled
  profile sheet (RATING, LEVEL, XP, FRIENDS, MATCHES) whose values come from
  `RatingProfile`, `GameStatsSummary` and `listFriends`; with no signed-in player
  behind the route there are no values to read, so the sheet would be five rows of
  nothing. `dashboard.md` §3 covers this case: *"One empty state covers the whole page
  when there is nothing at all — the rows are not rendered at all in that case."* The
  page therefore shows the page-level empty state ("No completed matches yet." /
  "Finish a leg to see your rating, average and checkout rate here.") plus one primary
  action, "Play a match", into the Game Center.
- **Lobby** — the multiplayer backend is not part of this plan, so the room list is
  empty and the page says so: "No public rooms right now." / "Start a private room and
  invite someone, or find a match." `Find Match` is the primary action and
  `Create Room` the secondary, as `lobby.md` §3 specifies.
- **Career** — the quest catalogue is real content and is read through
  `createQuestLoaderService()` at module scope, so the names and descriptions on the
  page are the ones in the JSON files and a malformed quest file fails the page rather
  than rendering a broken list. No player progress is available behind this route, so
  CURRENT QUEST shows "No active quest." and PROGRESS shows "No progress yet." — the
  empty states `career.md` §4 gives — rather than a hard-coded `0%` bar.

### Design decisions worth recording

- **Left-aligned, not centred.** `dashboard.md` §5 and `home.md` §4 both say the sheet
  is *"left-aligned in the page's 1440 px container ... Not centred — a reading sheet
  reads better at a stable left edge."* The pages therefore use `max-w-[720px]`
  (`max-w-[900px]` for the lobby) without `mx-auto`.
- **No page-level `<header>`.** `DESIGN.md` §11 criterion 10 lists `<header>` as a
  landmark the shell owns, so a page-level `<header>` would have produced two header
  landmarks in the document. The pages use a `<div>` for their title block; the shell's
  sticky `<header>` is the only one.
- **Primary action treatment.** `bg-brass` with a `text-board` label, 44 px tall
  (`min-h-11`), `rounded-sm`, `font-label`, a `bg-brass-deep`/`text-ink` hover and the
  cream `focus-visible` ring, per `MASTER.md` §10.1 and `DESIGN.md` §9. The lobby's
  `Create Room` is the `bg-raised` + `border-edge` secondary.
- **Career page loading.** The loader is async, so the page module uses a top-level
  `await` — the page is a server component, and Next.js prerenders it statically with
  the validated catalogue baked in (verified: `.next/server/app/career.html` contains
  the quest names).

### Tests

- New `tests/unit/ui/secondaryPages.test.tsx` carries the five requirement tests across
  all four routes. The palette-utility check scans the page sources and was verified
  to fail when a `bg-slate-900` is reintroduced.
- `tests/unit/ui/{dashboard,lobby,career}.test.tsx` now assert the new contract —
  headings, empty states, token classes, one primary action, no landmark of the
  page's own — rather than the old class names and placeholder strings.
- The three stored snapshots asserted the old markup and proved nothing beyond it, so
  they were pruned (`vitest -u`) in favour of the semantic assertions.
- `tests/integration/ui-skeletons.test.tsx` now expects the dashboard's empty state
  instead of the "Rating"/"Level"/"Friends" tiles, and the career page's quest names.
- New `e2e/hub-pages.spec.ts` measures the four routes in Chromium: one `<main>` /
  `<header>` / `<footer>` per document, the heading inside `main#main`, and
  `scrollWidth <= clientWidth` at 390 px.

### Measured 390 px behaviour

`document.documentElement.scrollWidth` vs `clientWidth`, Chromium at 390×844:

| Route | scrollWidth | clientWidth |
| ----- | ----------- | ----------- |
| `/` | 390 | 390 |
| `/dashboard` | 390 | 390 |
| `/lobby` | 390 | 390 |
| `/career` | 390 | 390 |

No horizontal overflow on any route. At 1440 px all four measure 1440/1440.

### Gates

`npm run typecheck`, `npm run lint` and `npm run format:check` exit 0. `npm run test`:
383 passed, 1 failed — `tests/integration/linkGuest.test.ts`, the pre-existing failure
that needs a PostgreSQL server on `localhost:5432`. `npm run build` succeeds.
`npx playwright test e2e/hub-pages.spec.ts`: 11 passed. The two failures in
`e2e/game-center.spec.ts` ("full match journey", "new game button returns to start
screen") are pre-existing and outside this task: task 007 rebuilt `PlayerSetup` with a
visible label and `placeholder="Name"`, while task 006's untracked spec still looks for
`getByPlaceholder("Player 1 name")`. Neither file is owned by this task.

### Not done

The pages show empty states rather than live data because there is no authenticated
player behind any of them — the rating, friends and career-progress services are all
keyed by a user id that a route cannot obtain yet. Wiring the session into these pages
is a separate task.

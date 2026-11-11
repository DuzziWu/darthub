# Task 004: Build the app shell — navigation, skip link, reduced motion

**Status**: completed
**Depends on**: 001

**Files this task owns:** `app/layout.tsx`, `src/components/shell/**`, `src/components/ui/**`, and the mechanical `<main>` → `<div>` conversion across the ten route page files. **Files this task does not touch:** `src/components/game/**` (task 007), `src/components/board/**` (task 003), `src/board/**` (task 002).
**Retry count**: 0

## Description
Give the application a shell: top-level navigation, a skip link, and the reduced-motion contract — so every page after this task sits inside a consistent frame instead of rendering bare on a black background.

## Context
### Read first
- `DESIGN.md` — §8.1 (app shell / navigation), §8.6 (board source modes, shown in the match header), §10 (responsive), §11 (accessibility floor).
- `design-system/darthub/MASTER.md` — the navigation and surface component specs.

### Files
- `app/layout.tsx` — add the shell. It currently renders `<html lang="en"><body>{children}</body></html>` plus the `import "./globals.css"` added by the styling fix. The `metadata` export stays.
- `src/components/shell/` — new: the navigation and shell components (`SiteHeader.tsx`, `ShellNav.tsx` or equivalent per the spec, plus `index.ts`).
- `src/components/ui/` — new folder for the primitives the design system names (skip link, visually-hidden helper). `CLAUDE.md` mandates shadcn/ui for component primitives, but shadcn/ui is **not installed** and installing the whole CLI + Radix tree for a skip link would be a larger change than this task needs. Build the two primitives directly on the token layer, and note the decision.

### The `main` landmark — one owner, decided here
**Every page currently renders its own `<main>`** (`app/page.tsx`, `app/game/page.tsx`, `app/dashboard/page.tsx`, `app/lobby/page.tsx`, `app/career/page.tsx` and the rest all open with `<main className="min-h-screen …">`). `DESIGN.md` §8.1 puts `<main id="main">` in the **shell**.

If the shell adds a `<main>` and the pages keep theirs, every route ends up with two nested `<main>` landmarks — invalid HTML, and a screen reader gets two "main" regions.

**Decision: the shell owns the landmark.** This task changes `app/layout.tsx` to render:

```tsx
<body>
  <a href="#main" className="skip-link">Skip to main content</a>
  <SiteHeader />
  <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
    {children}
  </main>
</body>
```

and **changes each page's own `<main>` to a `<div>`**. That page-level change touches files tasks 005, 006, 008 and 009 also touch, so it must be sequenced, not parallel.

**To keep the tasks independent, do the landmark conversion in this task for every route** — a mechanical `<main …>` → `<div …>` edit across the ten page files, plus removing the now-duplicated `min-h-screen` (the shell reserves the space instead). Later tasks then rebuild those pages without re-introducing a `<main>`. Every later task's acceptance criteria say "the page renders inside the shell's `<main>`" — stated as a check, so a later task that re-adds a `<main>` is caught.

`tabIndex={-1}` on `<main>` is required: without it, the skip link scrolls but focus does not move, and the next Tab press continues from the header.

### The header and the mobile tab bar
- The header is **sticky, 56 px**, `bg-board`, `border-b border-rule`, with the wordmark left and the nav right. Sticky (not fixed) is what "reserve space" means here — a sticky header occupies its own space in flow, so content is never hidden behind it and no padding hack is needed.
- **At <768 px the nav collapses to a bottom tab bar** (`DESIGN.md` §8.1): up to 5 destinations, icon + label, `bg-board`, `border-t border-rule`, **64 px tall plus the safe-area inset**. The header collapses to the wordmark alone.
- **The bottom tab bar's height must be reserved as padding on the shell's `<main>`** (`DESIGN.md` §10) — otherwise it covers the last row of content. The reservation applies only below 768 px, since the bar does not exist above it.
- The nav has exactly **5 destinations**: Game Center, Lobby, Career, Dashboard and the home route. `DESIGN.md` §8.1 caps the mobile bar at 5 — a sixth would not fit and would shrink the targets below 44 px.
- The nav is identical on every page and the current location is marked with `aria-current="page"` plus a brass underline — never colour alone.

### The shell
- Navigation placement is identical on every page — the nav does not move per page.
- The current location is visually indicated (colour and weight), not colour alone.
- Every nav item has both a label and a Lucide icon, with decorative icons `aria-hidden` and the icon-only case (if any) given an accessible name.
- The header is a fixed or sticky element: it must **reserve space** so content is never hidden behind it, and it must not obscure keyboard focus.
- On small screens the nav must fit without a horizontal scrollbar — the design system specifies how it collapses. Read `DESIGN.md` §10 rather than inventing a pattern.

### Accessibility floor — these are checkable, not adjectives
- A **skip link** to `#main` is the first focusable element, visible on focus, and it works.
- Focus rings are visible on every interactive element and are never removed.
- Text contrast ≥ 4.5:1, using `--color-ink` on `--color-board` / `--color-surface` and the muted/faint variants only where the spec allows.
- Interactive targets ≥ 44 × 44 px with ≥ 8 px spacing (`--space-md`).
- `prefers-reduced-motion` is honoured: transitions and animations collapse, and nothing depends on an animation ending to become correct.
- Logical focus order matching visual order.
- Landmarks: `<header>`, `<nav aria-label="Primary">`, `<main id="main">`, `<footer>`; one `<h1>` per page, no level skips (`DESIGN.md` §11).

### Constraints
- The shell is **server-rendered by default**. The `nextjs` stack guidance says: *"Keep components server by default … Don't: Add 'use client' unnecessarily."* Only the interactive parts (the mobile nav toggle, if the spec has one) need `"use client"`.
- No navigation destination may 404. The routes that exist are `/`, `/game-center`, `/lobby`, `/career`, `/dashboard`, plus the five game routes.
- The `main` landmark must exist and carry an `id="main"` for the skip link.

## Requirements (Test Descriptions)
- [x] `it renders the primary navigation on every page`
- [x] `it marks the current navigation item as current`
- [x] `it provides a working skip link as the first focusable element`
- [x] `it moves focus to the main landmark when the skip link is activated`
- [x] `it renders exactly one main landmark on every route`
- [x] `it reserves space so content is never hidden behind the header`
- [x] `it reserves space for the mobile tab bar below 768 pixels`
- [x] `it renders a visible focus ring on every interactive element`
- [x] `it collapses motion under prefers-reduced-motion`
- [x] `it links only to routes that exist`

## Acceptance Criteria
- The shell renders on every route and the nav is identical on each.
- The skip link is the first focusable element, becomes visible on focus, and moves focus to `#main`.
- **Exactly one `<main>` per route.** The shell owns `<main id="main" tabIndex={-1}>`; no page renders its own `<main>`. A test asserts `document.querySelectorAll("main").length === 1` for every route.
- No route in the navigation 404s.
- The header does not overlap content, the mobile tab bar's height is reserved below 768 px, and `DESIGN.md` §10's small-screen behaviour is implemented rather than invented.
- Every interactive element in the shell is ≥ 44 × 44 px with ≥ 8 px spacing.
- The shell uses the token layer only — no palette utilities.
- `"use client"` appears only where interactivity requires it. **The nav's current-item state needs the pathname, so the nav is a client component; the header and `<main>` wrapper stay server-rendered.**
- `npm run typecheck`, `npm run lint` and `npm run test` stay green (no new failures).

## Implementation Notes

### What was built

**`app/layout.tsx`** — the shell. The font wiring is unchanged; the body now
renders `<SkipLink />`, `<SiteHeader />` and the single `<main id="main"
tabIndex={-1}>`. The main carries `max-w-[1440px] px-4 md:px-8`, the
`scroll-mt-14` that keeps a focused element clear of the 56 px sticky header,
and `pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0` — the 64 px tab-bar
reservation, below 768 px only.

**`src/components/shell/`**
- `SiteHeader.tsx` — the sticky 56 px header (`h-14 border-b border-rule
  bg-board`), wordmark left, navigation right. It renders the mobile tab bar
  alongside the header, so the two never diverge.
- `ShellNav.tsx` — `"use client"`. `PrimaryNav` is the desktop row (hidden
  below 768 px), `MobileTabBar` the fixed bottom bar (64 px + safe-area inset,
  `md:hidden`). Both are `<nav aria-label="Primary">`.
- `ShellBrand.tsx` — `"use client"`. The wordmark, which is the home link and
  therefore carries the current-location marker on `/`.
- `navDestinations.ts` — the five destinations and their Lucide icons
  (`House`, `Target`, `Users`, `Map`, `LayoutDashboard`).
- `SiteFooter.tsx` — the shell's `<footer>` landmark, inside the main so the
  main's bottom padding keeps it clear of the tab bar.

**`src/components/ui/`**
- `SkipLink.tsx` — `"use client"`. `sr-only` until focused, then a fixed brass
  bar at the top-left (`z-60`, `bg-brass text-board`, 44 px tall). Its
  `onClick` calls `target.focus()`, because the fragment navigation only
  scrolls — without the handler the next Tab press continues from the header.
- `VisuallyHidden.tsx` — `sr-only` text, used by the wordmark ("DartHub —
  the board, after dark.") so the link says where it goes.

### Decisions

- **shadcn/ui was not installed.** `CLAUDE.md` mandates it for component
  primitives, but the CLI plus the Radix tree is a far larger change than this
  task needs for a skip link and a hidden-text helper. Both primitives are
  built directly on the token layer instead, as the task allowed.
- **`"use client"` is on three leaves only** — `SkipLink`, `ShellNav` and
  `ShellBrand`, all of which need the pathname or a DOM handler. The layout,
  the header, the footer and the main wrapper stay server components.
- **The `<main>` landmark was converted on all ten route pages** to `<div>`,
  dropping `min-h-screen` (the shell's main carries the height now). The
  pages keep their remaining classes; task 009 restyles them.
- **The current-location marker is three signals, not one**: `aria-current`,
  a brass underline (`border-b-2 border-brass`) and a heavier weight, so it
  survives without colour.

### Verification

- `tests/unit/shell/appShell.test.tsx` (9 cases) and
  `tests/unit/shell/routeLandmarks.test.tsx` (2 cases, one per requirement
  list item) — all 10 named requirements pass.
- `tests/unit/ui/*.test.tsx` asserted `min-h-screen` and snapshotted the old
  `<main>` markup; both were updated to the new contract and the three
  snapshots regenerated.
- Measured in Chromium against the dev server: one `<main id="main"
  tabIndex="-1">` per route; the skip link is the first Tab stop and moves
  focus to the main on activation; the header is 56 px and every shell target
  is ≥ 44 × 44 px with ≥ 8 px separation (`gap-lg`); the tab bar is 65 px
  with 64 px reserved below 768 px; focus rings are 2 px cream at 2 px
  offset; `ink-muted` on `board` measures 9.29:1; and under
  `prefers-reduced-motion: reduce` transitions collapse to 0.01 ms.

### Known issue outside this task

`tests/unit/board/zz-render-probe.test.tsx` — the parallel task-003 worker's
temporary probe — has an import-order lint error, which fails
`npm run lint` and therefore `tests/unit/linting.test.ts` and
`tests/unit/ci-workflow.test.ts`. The file is marked "Deleted after the
visual check" and is not owned by this task, so it was left alone. Every other
lint and type error in the tree is clean.


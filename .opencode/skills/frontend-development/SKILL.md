---
name: Frontend Development
description: Use when building or changing Next.js pages, React components, Tailwind styling, match views or any user-facing surface in app/ or src/components/. Covers the installed Next.js version's local documentation, the DESIGN.md and design-system token rules, the accessibility floor, responsive viewports and the verification commands.
---

# Frontend development (DartHub)

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4 with the
DartHub token set.

## Before you write a line

1. **Read the installed Next.js documentation.** This repository ships a
   `next` package whose APIs differ from the ones in your training data. The
   guides live in `node_modules/next/dist/docs/` — read the page for the API
   you are about to use (routing, layouts, server vs. client components,
   route handlers, metadata, caching, image and font handling). Heed the
   deprecation notices there. The block at the top of `AGENTS.md` is generated
   by `next dev` and is not optional reading.
2. **Read the design specification.** `DESIGN.md` is authoritative;
   `design-system/darthub/MASTER.md` is the token source of truth;
   `design-system/darthub/pages/<page>.md` overrides Master for one page.
   Do not invent a direction and do not edit those documents — report a gap
   instead.
3. **Read the component you are changing** and the token vocabulary in
   `src/components/game/classes.ts`. Consistency with the existing surfaces
   matters more than your own preference.

## Layout of the UI

```text
app/
  layout.tsx            root layout
  page.tsx              home
  game/{501→301,cricket,around-the-clock,shanghai}/page.tsx
  game-center/page.tsx  mode rule sheet
  lobby/ dashboard/ career/  hub pages
  api/                  REST route handlers — the BACKEND agent owns these
src/components/
  game/                 match views, score sheets, throw pad, visit chips
  board/DartBoard.tsx   the board is the throw input, not an illustration
  shell/                header, nav, footer, brand
  ui/                   primitives (SkipLink, VisuallyHidden)
  x01/X01MatchView.tsx
```

## Design rules (binding)

- **Colour is data.** One accent (brass = the live thing), two semantic
  colours (treble green = a visit that counted, double red = a bust), the rest
  is a neutral ramp. No raw hex outside the token set. No colour that carries
  no information.
- **Colour is never the only channel.** Every state must survive greyscale:
  pair it with text, an icon or a position.
- **A number that changes never reflows.** Tabular figures, fixed column
  widths, no animation on values.
- **Density wins on the play surface.** The match view is read mid-throw, in
  bad light. Whitespace is for the hub pages.
- **Every distinction carries information.** Two things that mean different
  things must look different — by their rules, not by their hue.
- **The UI renders what the engine says.** Never invent an average, a player
  count or a chart. If the engine has no data, say so honestly.
- **Banned:** generic AI-dashboard layouts, interchangeable gradient cards,
  arbitrary bento grids, excessive rounding, emoji as icons, decorative glow,
  fake statistics.

## Accessibility floor (verify, do not assume)

- Text contrast ≥ 4.5:1; non-text UI ≥ 3:1.
- Interactive targets ≥ 44×44 px, ≥ 8 px apart.
- Visible focus rings — never removed without a replacement.
- `prefers-reduced-motion` honoured.
- Full keyboard operability, logical focus order, an accessible name on every
  icon-only control, `aria-hidden` on decorative icons next to visible text.

## Responsive

Check every changed surface at **1440 px**, **1024 px** and **390 px**:
no horizontal scrollbar at 390 px, no clipped or truncated text, no
collision with sticky bars, body copy not below 16 px on mobile.

## Conventions

- `"use client"` only where interactivity needs it; keep the server component
  tree as the default.
- Tailwind utility classes with the DartHub tokens; no inline styles with
  hard-coded values.
- One component per file, PascalCase for components, `useCamelCase` for hooks.
- `@/` alias for internal imports; import order is
  `builtin → external → internal (@/) → parent → sibling → index`, no blank
  lines between groups (enforced by ESLint).
- Server components must not import Node-only modules into the client bundle.
- Never render a value the server has not sent, and never compute game state
  in the browser that the engine owns.

## Verification

```bash
npm run lint
npm run typecheck
npx vitest run tests/unit/game tests/unit/ui tests/unit/shell \
  tests/unit/game-center tests/unit/tailwind
```

React component tests need jsdom, which is not the Vitest default here — the
first line of the file must be:

```ts
// @vitest-environment jsdom
```

For a visual change, look at the surface in a real browser:

```bash
npx playwright test e2e/<spec>.spec.ts --reporter=list
```

The dev server is `http://localhost:3000`; restart it after code changes so
Turbopack does not serve a stale bundle. `--reporter=list` avoids the blocking
HTML report server.

A passing build is not a design acceptance. Fix a visible problem before you
report.

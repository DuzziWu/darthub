---
name: darthub-frontend
description: This skill should be used when the user asks to "build a component", "style the page", "add a Tailwind class", "make it responsive", "add a design token", "fix the layout" or otherwise touches DartHub's React/Tailwind UI. Encodes the token-only styling vocabulary, the shared control classes, the accessibility invariants and the rule that a new token must exist in the design system first.
paths:
  - "app/**/*.tsx"
  - "src/components/**"
  - "app/globals.css"
---

# DartHub Frontend

Guide for building and changing DartHub's React/Tailwind UI so that it stays
inside the project's design system instead of drifting into generic styling.

## The token vocabulary is the styling contract

`app/globals.css` is the single source of truth for colour, type, spacing,
radius, motion and elevation, mirroring `design-system/darthub/MASTER.md`.
Components reference tokens as utilities — `bg-surface`, `text-ink`,
`rounded-sm` — and **never** as raw palette utilities.

| Instead of                        | Use                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `bg-gray-800`, `bg-[#16161a]`     | `bg-surface`, `bg-raised`, `bg-sunken`, `bg-board`                                      |
| `text-white`, `text-black`        | `text-ink`, `text-ink-muted`, `text-ink-faint`                                          |
| `border-gray-700`                 | `border-rule`, `border-edge`                                                            |
| `text-yellow-500`                 | `text-brass`                                                                            |
| `text-green-500` / `text-red-500` | `text-treble` (a visit that counted) / `text-double` (a bust)                           |
| `text-xl`, `text-sm`              | `text-display`, `text-title`, `text-heading`, `text-body`, `text-label`, `text-caption` |
| `p-4`, `gap-2`                    | `px-md`, `gap-sm`, `px-xs` … (the spacing tokens)                                       |

Two test files enforce this: `tests/unit/tailwind/designTokens.test.ts` asserts
that every token in `MASTER.md` exists in `@theme`, and
`tests/unit/tailwind/noLegacyUtilities.test.ts` rejects legacy utilities. A
raw palette class fails CI.

## Adding a token

1. Add the token to `design-system/darthub/MASTER.md` first — the design
   system is the source of truth, `globals.css` mirrors it.
2. Declare it in the `@theme static` block in `app/globals.css`.
3. Add its utility to the `@source inline(...)` whitelist in
   `app/globals.css`. That directive lists the utilities the design system
   publishes; a utility outside it is not emitted, so the class silently does
   not exist.
4. Extend `tests/unit/tailwind/designTokens.test.ts` with its expected value.
5. Use the generated utility, not the raw value.

Use `@theme static` rather than a plain `@theme` block when the token must stay
declared even if no utility consumes it — the board paints from
`var(--board-red)` and hand-written CSS reads `var(--space-md)`, neither of
which Tailwind can see as a usage.

## Reuse the shared control classes

`src/components/game/classes.ts` holds the shared classes of the play
surface, so states cannot drift apart between components or between the five
game modes:

| Constant                     | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `FOCUS_RING`                 | 2px cream focus ring, 2px offset. Never removed. |
| `TARGET_SIZE`                | the 44px house floor for every target            |
| `DISABLED`                   | the disabled treatment (opacity + cursor)        |
| `SECONDARY_BUTTON`           | the strip's own secondary action, in every mode  |
| `MATCH_STRIP`                | the band across the top of a match               |
| `MATCH_TITLE`, `MATCH_BADGE` | the mode name and live state in the strip        |

Import from `@/components/game/classes` rather than re-declaring a focus ring
or a target size inline. A second copy of a focus ring is a second thing that
can drift.

## Accessibility invariants already encoded

- **44px minimum target size** (`TARGET_SIZE`).
- **The focus ring is never removed.** `FOCUS_RING` uses cream (`text-ink`),
  never brass — brass on brass is 1.0:1 and invisible.
- **Contrast is role-dependent.** `--color-rule` is a decorative hairline only;
  `--color-edge` is the control boundary at ≥ 3:1. Do not use `rule` for
  interactive edges.
- `src/components/ui/SkipLink.tsx` and `VisuallyHidden.tsx` exist for
  skip navigation and screen-reader-only text — use them rather than
  reinventing.

## One strip, five modes

The five game modes (501, 301, Cricket, Around The Clock, Shanghai) share one
match strip and one set of controls. When changing a shared component:

1. Check all five mode views under `src/components/game/` still render.
2. Keep the mode-specific parts in the mode view, not in the shared component.
3. The rule sheet text comes from the engine registry, not from a component
   (see the `darthub-game-engine` skill).

## Responsive behaviour

- From the `md` breakpoint up, the match strip is sticky directly below the app
  header (`md:sticky md:top-14 md:z-30`), so mode and visit stay on screen
  while the sheet is read.
- On a phone the strip is compact and scrolls away. Use
  `src/components/game/useIsCompact.ts` where a component needs the compact
  variant in JS.
- The score sheet and the throw pad are separate components; the pad bed uses
  the `sunken` surface.

## Verification

```bash
npx vitest run tests/unit/game/ tests/unit/ui/ tests/unit/tailwind/
npx playwright test e2e/visual-qc.spec.ts   # needs `npm run dev` running
```

Read `references/test-matrix.md` for the known baseline before treating a
failure as a regression.

## Additional Resources

### Reference Files

- **`references/tokens.md`** — the token table, the `MASTER.md` to
  `globals.css` mapping, and the rules the token tests enforce.
- **`references/test-matrix.md`** — test categories and known failures.

# DartHub Design Tokens

The token vocabulary, its source of truth, and the rules the token tests
enforce.

## Source of truth

| File                               | Role                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| `design-system/darthub/MASTER.md`  | the design system — the canonical definition of every token          |
| `app/globals.css`                  | the `@theme static` block that declares the tokens Tailwind compiles |
| `design-system/darthub/board.md`   | the board's own specification                                        |
| `design-system/darthub/pages/*.md` | the per-page specifications                                          |

`app/globals.css` mirrors `MASTER.md`. A token must exist in `MASTER.md`
first, then be declared in `@theme`, then be used.

## Colour tokens

### Surfaces — the board and its parts

| Token             | Value     | Use                                      |
| ----------------- | --------- | ---------------------------------------- |
| `--color-board`   | `#0c0c0e` | page ground — warm black sisal           |
| `--color-surface` | `#16161a` | sheet, panel, card                       |
| `--color-raised`  | `#1e1e23` | raised: input, key, row hover            |
| `--color-sunken`  | `#08080a` | recessed well: throw pad bed, code block |

### Rules and edges

| Token          | Value     | Use                                                                         |
| -------------- | --------- | --------------------------------------------------------------------------- |
| `--color-rule` | `#2a2a31` | decorative hairline only (contrast 1.17–1.40:1) — never an interactive edge |
| `--color-edge` | `#6b6b78` | control boundary (contrast 3.16–3.81:1)                                     |

### Ink

| Token               | Value     | Use                             |
| ------------------- | --------- | ------------------------------- |
| `--color-ink`       | `#f2ede4` | primary text — bull cream       |
| `--color-ink-muted` | `#b9b2a6` | secondary text                  |
| `--color-ink-faint` | `#8c857a` | tertiary text, disabled, labels |

### Accent and semantic

| Token                | Value     | Use                                       |
| -------------------- | --------- | ----------------------------------------- |
| `--color-brass`      | `#e3a64f` | accent fill, active turn, bull            |
| `--color-brass-deep` | `#8a6220` | brass border/hover on dark — **not** text |
| `--color-treble`     | `#59d6ae` | a visit that counted                      |
| `--color-double`     | `#e85c4a` | a bust                                    |

### Board material

`--board-sisal-dark`, `--board-sisal-light`, `--board-red`, `--board-green`,
`--board-bull-inner`, `--board-bull-outer`, `--board-ring`, `--board-numeral`,
`--board-wire`, `--board-steel`, `--board-steel-lit`, `--board-steel-dark`,
`--board-wire-groove`, `--board-key-light`, `--board-vignette`,
`--board-source-white`.

These are painted board materials, not UI state colours. They are consumed by
`var()` on the SVG nodes, so they generate **no** Tailwind utilities — read
them as `var(--board-red)`, never as a utility class.

## Type scale

| Token             | Size / line height  | Use                      |
| ----------------- | ------------------- | ------------------------ |
| `--text-display`  | 2rem / 2.25rem      | the largest display type |
| `--text-title`    | 1.5rem / 1.875rem   | page titles              |
| `--text-heading`  | 1.125rem / 1.5rem   | section headings         |
| `--text-body`     | 0.9375rem / 1.5rem  | body text                |
| `--text-label`    | 0.8125rem / 1.25rem | labels                   |
| `--text-caption`  | 0.75rem / 1.125rem  | captions                 |
| `--text-score-xl` | 3rem / 3rem         | the largest score        |
| `--text-score-lg` | 2rem / 2.25rem      | score                    |
| `--text-score-md` | 1.5rem / 1.875rem   | score                    |
| `--text-score-sm` | 1.125rem / 1.5rem   | score                    |

Usage: `font-display text-heading text-ink`.

## Spacing

Two parallel families exist, and the distinction matters:

| Family        | Tokens                                                                                 | Feeds                           | Used as                                |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------- |
| `--space-*`   | `xs` 2px, `sm` 4px, `md` 8px, `lg` 12px, `xl` 16px, `2xl` 24px, `3xl` 32px, `4xl` 48px | only `space-x-*` / `space-y-*`  | `var(--space-md)` in hand-written CSS  |
| `--spacing-*` | same values                                                                            | `p-*`, `m-*`, `gap-*`, `size-*` | `px-md`, `gap-sm`, `p-lg` as utilities |

Both are declared so every spacing utility exists.

## Radius and motion

| Token                | Value  | Use                                           |
| -------------------- | ------ | --------------------------------------------- |
| `--radius-xs`        | 2px    | smallest radius                               |
| `--radius-sm`        | 3px    | standard radius (`rounded-sm`)                |
| `--radius-md`        | 4px    | larger radius                                 |
| `--radius-full`      | 9999px | genuine circles only — the bull, the turn dot |
| `--duration-instant` | 80ms   | press feedback                                |
| `--duration-fast`    | 120ms  | hover, focus, small state change              |
| `--duration-base`    | 200ms  | panel, sheet, expansion                       |

Utilities: `rounded-xs`, `rounded-sm`, `rounded-md`, `rounded-full`,
`duration-instant`, `duration-fast`, `duration-base`, `ease-out`, `ease-in`,
`ease-standard`, `shadow-overlay`.

## The `@source inline(...)` whitelist

`app/globals.css` contains an explicit `@source inline(...)` directive listing
the utilities the design system publishes:

```text
bg-board bg-surface bg-raised bg-sunken bg-brass bg-treble bg-double
text-ink text-ink-muted text-ink-faint text-brass text-board text-treble text-double
border-rule border-edge border-brass
font-display font-sans font-mono font-body font-label font-caption
text-display text-title text-heading text-body text-label text-caption
text-score-xl text-score-lg text-score-md text-score-sm
rounded-xs rounded-sm rounded-md rounded-full
p-xs p-sm p-md p-lg p-xl p-2xl p-3xl p-4xl
gap-xs gap-sm gap-md gap-lg gap-xl gap-2xl gap-3xl gap-4xl
space-y-xs … space-y-4xl
duration-instant duration-fast duration-base
ease-out ease-in ease-standard
shadow-overlay
```

A utility outside this list may not be emitted. When a new token is added,
add its utility to this directive in the same change, otherwise the class
silently does not exist.

## Reduced motion is a hard requirement

`app/globals.css` enforces it globally:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is required by `MASTER.md` 8.1. Do not add a component that relies on
motion to convey meaning.

## Why `@theme static`

`@theme static` keeps every declared token in `:root` even when no utility
consumes it. Hand-written CSS relies on `var(--space-md)`, and the board paints
with `var(--board-red)` — neither of which Tailwind can see as a usage. Without
`static`, those tokens would be dropped from the output.

## The rules the tests enforce

`tests/unit/tailwind/designTokens.test.ts`:

- every colour, type, spacing, radius and motion token from `MASTER.md` is
  declared in `@theme` in `app/globals.css`, with the exact expected value;
- the utilities the design system publishes compile to the expected CSS;
- `app/layout.tsx` wires the tokens as expected.

`tests/unit/tailwind/noLegacyUtilities.test.ts`:

- no legacy utility classes are present — a raw palette utility such as
  `bg-gray-800` fails.

`tests/unit/tailwind/tailwindToolchain.test.ts`:

- a production build emits a compiled stylesheet into `.next/static/css`.
  This one needs a successful `npm run build` first.

## Rules of thumb

1. Reach for a token before reaching for a raw value.
2. If no token fits, add one — to `MASTER.md` first, then to `@theme`, then to
   the token test.
3. Use `rule` for hairlines and `edge` for interactive boundaries.
4. Use `ink` for the focus ring, never `brass` — brass on brass is 1.0:1.
5. Use `treble` and `double` only for their game meanings (counted visit,
   bust), so the colour keeps its meaning across the whole app.
6. Add a new utility to the `@source inline(...)` whitelist in the same change
   that introduces the token — otherwise the class does not exist.
7. Never rely on motion to convey meaning; reduced motion is a hard
   requirement (`MASTER.md` 8.1).

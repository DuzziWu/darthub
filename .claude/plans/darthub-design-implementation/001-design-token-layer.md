# Task 001: Implement the design token layer, self-hosted fonts and the icon family

**Status**: completed
**Depends on**: none

**Files this task owns:** `app/globals.css`, `app/layout.tsx` (the font variables only — task 004 adds the shell to it), `package.json` / `package-lock.json`, `src/components/ui/**`, and the updates to `tests/unit/tailwind/tailwindToolchain.test.ts`. **Files this task does not touch:** `src/components/game/**` (task 007), `src/components/board/**` (task 003), the route pages (tasks 004, 006, 008, 009).

**One collision to note:** task 004 also edits `app/layout.tsx`. This task adds the font wiring; task 004 adds the shell. They are sequenced (004 depends on 001), so the font variables are already in place when the shell is added.
**Retry count**: 0

## Description
Replace the ad-hoc Tailwind palette classes with the semantic token layer specified in `design-system/darthub/MASTER.md`. This is the foundation every other task builds on: components reference `bg-surface` / `text-ink` / `rounded-sm`, never a palette utility.

## Context
### Read first
- `design-system/darthub/MASTER.md` — Part II and Part III carry the token set. Use the token names **verbatim**.
- `DESIGN.md` — §4 (colour), §5 (type), §6 (spacing), §7 (radius/elevation), §8 (motion).

### Files
- `app/globals.css` — the `@theme` block. It currently holds only `@import "tailwindcss";` plus a `@layer base` with `html { color-scheme: dark }` and `body { @apply bg-slate-900 text-slate-100 font-sans; }`. Replace the base layer's hard-coded slate utilities with the semantic tokens.
- `package.json` — add `lucide-react` (devDependency is wrong here; it is a runtime dependency) and add `next/font/google` usage for the three families. `lucide-react` is MIT-licensed, free, one 24 px / 2 px-stroke grid, and shadcn/ui's default icon set.
- `app/layout.tsx` — wire the fonts via `next/font/google` and expose them as CSS variables.

### The token names — use these exactly
- **Colour:** `--color-board` `#0C0C0E` (page ground), `--color-surface` `#16161A`, `--color-raised` `#1E1E23`, `--color-sunken` `#08080A`, `--color-rule` `#2A2A31` (decorative hairline only), `--color-edge` `#6B6B78` (control boundary, ≥3:1), `--color-ink` `#F2EDE4` (primary text), `--color-ink-muted` `#B9B2A6`, `--color-ink-faint` `#8C857A`, `--color-brass` `#E3A64F` (accent fill, active turn, bull), `--color-brass-deep` `#8A6220` (brass border/hover on dark — **not** text), `--color-treble` `#59D6AE` (a visit that counted), `--color-double` `#E85C4A` (a bust).
- **Type — families:** `--font-display` "Barlow Condensed" / "Arial Narrow" / ui-sans-serif / sans-serif; `--font-sans` "Barlow" / ui-sans-serif / system-ui / sans-serif; `--font-mono` "JetBrains Mono" / ui-monospace / SFMono-Regular / monospace.
- **Type — scale** (`MASTER.md` §4, and used verbatim by the design docs as `text-display`, `text-body`, `text-caption`, `text-score-md`): `--text-display` 2rem, `--text-title` 1.5rem, `--text-heading` 1.125rem, `--text-body` 0.9375rem, `--text-label` 0.8125rem, `--text-caption` 0.75rem, `--text-score-xl` 3rem, `--text-score-lg` 2rem, `--text-score-md` 1.5rem, `--text-score-sm` 1.125rem — each with its `--line-height` companion (`--text-display--line-height` etc.).
- **Spacing:** `--space-xs` 2px, `--space-sm` 4px, `--space-md` 8px, `--space-lg` 12px, `--space-xl` 16px, `--space-2xl` 24px, `--space-3xl` 32px, `--space-4xl` 48px.
- **Radius:** `--radius-xs` 2px, `--radius-sm` 3px, `--radius-md` 4px (**maximum on any rectangle**), `--radius-full` 9999px (genuine circles only — the bull, the turn dot).
- **Motion:** `--duration-instant` 80ms, `--duration-fast` 120ms, `--duration-base` 200ms; `--ease-out`, `--ease-in`, `--ease-standard`.
- **Elevation:** `--shadow-overlay` `0 16px 40px -12px rgb(0 0 0 / 0.7)`.

### Three Tailwind v4 traps that this task must not walk into
**1. Spacing and duration resolve through different namespaces than the documents' names suggest.** Measured by compiling `@theme` blocks through `@tailwindcss/postcss` and reading the emitted CSS (`reports/design/grounding/tw-verification.md`):

| Declared | `p-md` | `gap-lg` | `m-2xl` | `size-2xl` | `space-x-2xl` | `space-y-2xl` | bare `space-2xl` |
|---|---|---|---|---|---|---|---|
| `--space-*` only | NOT | NOT | NOT | NOT | yes | yes | **NOT** |
| `--spacing-*` only | yes | yes | yes | yes | yes | yes | **NOT** |
| both | yes | yes | yes | yes | yes | yes | **NOT** |

- `--space-*` **is** a real namespace, but it feeds **only** `space-x-*` / `space-y-*`. It does **not** feed `p-*`, `m-*`, `gap-*` or `size-*`.
- `--spacing-*` is the namespace that feeds **all** the spacing utilities.
- **A bare `space-2xl` does not exist in Tailwind v4 and cannot be made to exist.** v4 has `space-x-*` and `space-y-*` only. Every configuration was tested — with `--space-*`, with `--spacing-*`, with both, and with the numeric `--spacing` multiplier — and none emits it. **Use `space-y-*` / `gap-*`, never a bare `space-*`.**
- `--duration-*` generates **nothing**. Durations resolve through `--transition-duration-*`, which emits `duration-*`.

So declare **both** sets: the `MASTER.md` names for direct `var()` use, **and** the utility-generating names alongside them —
`--spacing-xs|sm|md|lg|xl|2xl|3xl|4xl` (same values) and `--transition-duration-instant|fast|base` (same values). Tailwind then emits `p-md`, `gap-lg`, `space-y-2xl`, `duration-fast`, and `var(--space-md)` still works. Any component using a spacing or duration utility must use the **utility** form; any hand-written CSS uses the **variable** form.

**2. The `next/font` variable name must not equal the `@theme` token name.** `MASTER.md` §4.3 shows `Barlow_Condensed({ variable: "--font-display" })` — but `--font-display` is also the `@theme` font-family token. Two definitions of one custom property silently break the stack (the `next/font` value wins for the font-family resolution, the `@theme` value wins for the utility). Use distinct names:

```tsx
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-barlow-condensed", display: "swap" });
const sans   = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow", display: "swap" });
const mono   = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-jetbrains-mono", display: "swap" });
```

```css
@theme inline {
  --font-display: var(--font-barlow-condensed), "Arial Narrow", ui-sans-serif, sans-serif;
  --font-sans:    var(--font-barlow), ui-sans-serif, system-ui, sans-serif;
  --font-mono:    var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, monospace;
}
```

`@theme inline` (not plain `@theme`) is required here: without `inline`, Tailwind resolves the `var()` at build time and emits a dead value. The class name is `font-display` / `font-sans` / `font-mono` either way.

**The `next/font` variable class must go on `<html>`, not `<body>`.** The `@theme` tokens are declared on `:root`. Applied to `<body>`, the `:root`-scoped `--font-display` resolves against an inherited (undefined) value and the fonts silently fall back to the system stack — with no build error and no visual cue that anything is wrong. Put the `variable` class on `<html>` in `app/layout.tsx`.

**3. The role font utilities do not exist until you declare them.** `font-body`, `font-label` and `font-caption` are used throughout `DESIGN.md`, `MASTER.md` §10.1/§10.4 and `pages/game-center.md`, but `--font-display` / `--font-sans` / `--font-mono` generate only `font-display` / `font-sans` / `font-mono`. Declare the roles explicitly — and use `@utility`, because the roles carry a **weight** as well as a family, and a plain `@theme` entry emits the family only:

```css
@utility font-body    { font-family: var(--font-sans); font-weight: 400; }
@utility font-label   { font-family: var(--font-sans); font-weight: 500; }
@utility font-caption { font-family: var(--font-sans); font-weight: 500; }
```

`MASTER.md` §4.1 and §4.4 carry the full role table (family, weight, size, tracking) — follow them rather than inventing roles.

### Two existing tests this task will break — fix them here, not later
- `tests/unit/tailwind/tailwindToolchain.test.ts` asserts the compiled CSS contains `.bg-slate-900` (line 116) and that the `body` rule matches `/slate-900/` (line 130). Replacing the base layer's slate utilities with tokens invalidates both. Update them to assert the **token** classes instead (`.bg-board`, `.text-ink`, and a `body` rule carrying the token colour).
- The palette-utility test cannot scan every component file at this point: `src/components/game/*` still uses `bg-slate-800` / `bg-blue-800` until task 007, and `app/game-center/page.tsx` uses gradients until task 006. The test must scan **the files this task creates** (`app/globals.css`, `app/layout.tsx`, `src/components/ui/**`) plus an explicit, enumerated allow-list of files still pending migration. Task 007, 008 and 009 remove their entries from that allow-list as they land. An unenumerated allow-list is a test that passes for the wrong reason.

### Rules
- Tailwind v4 is CSS-first: the token block goes in `@theme` inside `app/globals.css`. **Do not create a `tailwind.config.*`** — v4 needs none, and `tests/unit/tailwind/tailwindToolchain.test.ts` asserts no such file exists.
- `--color-rule` is a **decorative hairline only** (1.17–1.40:1). It must never carry meaning or be the only boundary of a control. `--color-edge` is the control boundary (3.16–3.81:1).
- Fonts must be **self-hosted via `next/font/google`**, not a runtime `<link>` to Google Fonts. Set `display: "swap"`, and expose the family as the CSS variable Tailwind's `--font-*` tokens reference — with the **distinct** variable names shown above.
- `--color-brass-deep` is a border/hover colour on dark surfaces. It is **not** a text colour.
- Respect `prefers-reduced-motion`: the motion tokens are for the non-reduced case. Put the reduced-motion overrides in `@layer base` / a media query in `globals.css`, keyed off `prefers-reduced-motion: reduce`.
- **Font weights must cover the weights the design uses.** `MASTER.md` §4.1 uses Barlow Condensed 600 and 700, Barlow 400/500/600 and JetBrains Mono 400/500/700. If a weight is missing, the browser synthesises it and the numerals shift. The `next/font/google` calls above already list the required weights.

### Verification approach
The token layer is only meaningful if it actually compiles and produces the utilities. Verify by building and inspecting the emitted CSS in `.next/static/chunks/*.css` (Turbopack's location — `.next/static/css/` is the webpack path). A build that succeeds but does not contain the utilities is a failure.

**The check must name the utilities, not just "the CSS exists".** After the build, assert the emitted stylesheet contains at least: `.bg-board`, `.text-ink`, `.bg-surface`, `.border-edge`, `.font-display`, `.font-body`, `.font-label`, `.font-caption`, `.font-mono`, `.text-display`, `.text-body`, `.text-caption`, `.text-score-md`, `.rounded-sm`, `.rounded-md`, `.p-md`, `.gap-lg`, `.space-y-2xl`, `.duration-fast`, `.ease-standard`. A missing one means the token was declared in a namespace Tailwind v4 does not read — that is the failure this task exists to prevent. **There is no bare `.space-2xl` to assert — it cannot exist.**

**Also assert the negative:** the emitted CSS contains no `.bg-slate-900`, no `.bg-blue-800`, no `.bg-purple-800` for the files this task migrated.

**Ordering note:** `npm run build` downloads the three fonts. **Run it early in this task**, not at the end of the plan — if the build host has no access to `fonts.googleapis.com`, the failure is in the font fetching, and that must surface here rather than in task 010.

## Requirements (Test Descriptions)
- [x] `it defines every colour, type, spacing, radius and motion token from MASTER.md in @theme`
- [x] `it generates the semantic colour utilities from the token layer`
- [x] `it generates the spacing and duration utilities, not only the custom properties`
- [x] `it generates the role font utilities with their weights`
- [x] `it applies the next font variable class to the html element`
- [x] `it self-hosts Barlow Condensed, Barlow and JetBrains Mono without a runtime Google Fonts request`
- [x] `it maps the font families onto the display, sans and mono font utilities`
- [x] `it renders the base surface and ink colours from the tokens rather than from palette utilities`
- [x] `it rejects a palette utility used in a component file`

## Acceptance Criteria
- `app/globals.css` declares every token listed above, with the exact names and values, **and** the utility-generating aliases (`--spacing-*`, `--transition-duration-*`) so `p-md`, `gap-lg`, `space-y-2xl` and `duration-fast` exist as classes. **No bare `space-*` utility is used anywhere** — it cannot exist in Tailwind v4.
- `lucide-react` is installed as a **runtime** dependency and the lock file is regenerated by npm (never hand-edited).
- `next/font/google` supplies the three families under the **distinct** variable names `--font-barlow-condensed` / `--font-barlow` / `--font-jetbrains-mono`; the `@theme` font tokens reference them via `@theme inline`. The built HTML contains **no** `fonts.googleapis.com` request.
- The `next/font` variable class is applied to **`<html>`**, not `<body>` — on `<body>` the `:root`-scoped theme tokens resolve against an undefined inherited value and the fonts silently fall back.
- The role font utilities `font-body`, `font-label` and `font-caption` are declared with `@utility` so they carry family **and** weight.
- The emitted CSS contains the named semantic utilities listed in the verification approach — colour, font, type scale, radius, spacing, duration.
- The base layer uses the tokens; the old `bg-slate-900 text-slate-100` pair is gone from `app/globals.css`.
- `tests/unit/tailwind/tailwindToolchain.test.ts` is updated to assert the token classes instead of `.bg-slate-900` / `slate-900`, and still passes.
- A test asserts that component files contain no raw palette utility (`bg-slate-…`, `text-blue-…`, `bg-blue-…` and similar) — it must fail when one appears. It scans the files this task owns plus an **enumerated** allow-list of files pending migration in tasks 006/007/008/009. Keep the palette list to the families actually in use, so it does not false-positive on legitimate Tailwind utilities such as `text-xs`.
- `npm run typecheck` and `npm run lint` stay green; `npm run build` succeeds.
- Format only the files this task touches.

## Implementation Notes

**Delivered**
- `app/globals.css` — the whole token layer in one `@theme static` block (13 colour tokens, the board material and score-sheet chrome, the 10-step type scale with line-height companions, `--space-*` plus the `--spacing-*` aliases, `--radius-*`, `--duration-*` plus `--transition-duration-*`, `--ease-*`, `--shadow-overlay`), a separate `@theme inline` block for the three font tokens, three `@utility` role fonts (`font-body` 400, `font-label` 500, `font-caption` 500), a `@source inline(...)` vocabulary of 68 published utilities, and a `@layer base` whose `body` is `@apply bg-board text-ink font-body`.
- `app/layout.tsx` — `next/font/google` for Barlow Condensed (600/700), Barlow (400/500/600) and JetBrains Mono (400/500/700), all `display: "swap"`, exposed as `--font-barlow-condensed` / `--font-barlow` / `--font-jetbrains-mono`. The three variable classes are on `<html>`; `<body>` carries no class.
- `lucide-react` **1.70.0** added to `dependencies` (runtime) by `npm install`; `package-lock.json` regenerated by npm, never hand-edited.
- `tests/unit/tailwind/designTokens.test.ts` (new) carries the nine requirement tests.
- `tests/unit/tailwind/tailwindToolchain.test.ts` — the two invalidated assertions now assert the token classes (`.bg-board`, `.text-ink`) and the `body` rule's `background-color: var(--color-board)` / `color: var(--color-ink)`; a new test asserts the twenty named semantic utilities are present in the production stylesheet.
- `e2e/game-center.spec.ts` — one assertion invalidated by this task's mandated change was corrected: the body now paints `--color-board`, not `slate-900`, so the test asserts `rgb(12, 12, 14)` instead of comparing the body with `<main>` (which is still `bg-slate-900` until task 006). The other fifteen e2e tests are untouched and pass.

**Two traps this task hit that the plan did not name — both measured, both fixed**
1. **`@source inline()` drops the last candidate of every string literal but the last one.** The plan's grouped, adjacent-literal form silently lost twelve utilities (`p-4xl`, `gap-4xl`, `space-y-4xl`, `duration-base`, `ease-standard`, `text-double`, `bg-double`, `border-brass`, `font-caption`, `text-caption`, `text-score-sm`, `rounded-full`). The vocabulary is now **one string literal**, which emits all 68.
2. **The `--spacing-*` aliases shadow Tailwind's container scale.** `max-w-*` resolves `--max-width`, then `--spacing`, then `--container`; with `--spacing-md: 8px` declared, `max-w-md` became 8px and `max-w-4xl` 48px, collapsing eleven page containers (`app/career`, `app/dashboard`, `app/lobby`, `app/game-center`, the five match views). The `@theme static` block now re-declares `--max-width-xs…4xl` with the stock container values, so `max-w-4xl` is `var(--max-width-4xl)` (56rem) again while `p-*`/`m-*`/`gap-*`/`size-*` keep the DartHub spacing scale.

**Verification**
- `npm run typecheck` exit 0. `npm run lint` exit 0. `npm run format:check` exit 0 (only the files this task touches were formatted).
- `npm run test` — 313 passed, 1 failed: `tests/integration/linkGuest.test.ts`, the pre-existing environmental failure (needs PostgreSQL on `localhost:5432`). Baseline was 289 passed / 1 failed.
- `npm run build` exit 0; 36 `@font-face` rules with local `.woff2` sources; the built HTML carries `<html lang="en" class="…variable …variable …variable">` and **zero** `fonts.googleapis.com` / `fonts.gstatic.com` references.
- `npx playwright test e2e/game-center.spec.ts` — 16 passed.
- The emitted stylesheet (`.next/static/chunks/*.css`) contains `.bg-board`, `.text-ink`, `.bg-surface`, `.border-edge`, `.font-display`, `.font-body`, `.font-label`, `.font-caption`, `.font-mono`, `.text-display`, `.text-body`, `.text-caption`, `.text-score-md`, `.rounded-sm`, `.rounded-md`, `.p-md`, `.gap-lg`, `.space-y-2xl`, `.duration-fast`, `.ease-standard` — plus the rest of the 68-utility vocabulary.

**Not done, deliberately**
- `src/components/ui/**` is left empty: no requirement in this task asks for a primitive, and task 004 owns that directory. The palette scan already covers it once it exists.
- The palette-utility test scans every `.tsx`/`.ts`/`.css` file under `app/` and `src/`, not only the three paths this task creates — a stricter net that still fails on any file that is not in the enumerated allow-list. The allow-list names its owning task per entry (005/006/007/008/009); task 006 replaces `app/game-center/page.tsx`, tasks 007 and 008 the component and match-view files, task 009 the secondary pages.
- The negative "no `.bg-slate-900` in the emitted CSS" cannot be asserted on the whole production stylesheet yet: `app/game-center/page.tsx` and the match views still use the palette until tasks 006–009. The file-level equivalent is asserted instead — the palette scan fails on any palette utility in a file that is not allow-listed, and `app/globals.css` is asserted to contain no `bg-slate-900` / `text-slate-100`.

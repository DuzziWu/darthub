# Plan: Game Center Styling Fix

## Created
2026-11-09

## Status
completed

## Objective
Restore the DartHub design system on `/game-center` and the five game-mode pages by wiring up the missing Tailwind CSS toolchain, so the pages render with the intended dark slate theme instead of unstyled browser defaults. Game logic and the five game modes must remain behaviourally unchanged.

## Related Issues
none

## Discovery Notes
The Tailwind toolchain was never installed or configured in this repo, so every utility class in `app/` and `src/components/game/` was inert:

- `package.json` lists no `tailwindcss`, `postcss` or `autoprefixer` dependency.
- No `postcss.config.*`, no `tailwind.config.*` and **no `.css` file anywhere in the repo**.
- `app/layout.tsx` renders `<body>{children}</body>` and imports no stylesheet.

Result: `/game-center` showed default serif fonts, default blue underlined links and a white background.

A second, **cosmetic** item: `app/game-center/page.tsx:55` uses `bg-gradient-to-br`, which Tailwind v4 renamed to `bg-linear-to-br`. Measured against the compiled CSS of Tailwind 4.3.5, **v4 still emits `.bg-gradient-to-br` as a legacy alias** (alongside the canonical `.bg-linear-to-br`), so this name is *not* broken — it works. The rename is a forward-looking canonicalisation, not a bug fix, and must not be described as one in the report. Every other utility in use (~120 distinct classes) exists unchanged in v4.

There is no shadcn/ui layer — no `src/components/ui`, no `cn()` helper, no `clsx`/`tailwind-merge`/`cva`. The game components are hand-written Tailwind, so no component-primitive work is involved in this fix.

### Baseline — measured, not assumed
Measured directly on the working tree on 2026-11-09 (before this plan), each command's **own** exit code captured (not a pipe's):

| Gate | Baseline result | Cause |
|---|---|---|
| `npm run test` | **exit 1** — 3 failed files / 3 failed tests, 279 passed (282 total) | `tests/integration/linkGuest.test.ts` (1 — needs PostgreSQL, `P1001` cannot reach `localhost:5432`), `tests/unit/formatting.test.ts` (1 — replays `npm run format:check`), `tests/unit/ci-workflow.test.ts` (1 — replays the workflow's `npm run` steps) |
| `npm run lint` | **exit 0** — clean | — |
| `npm run typecheck` | **exit 0** — clean | — |
| `npm run format:check` | **exit 1** — 8 files | 6 generated: `.playwright-mcp/page-*.yml` (×4), `playwright-report/index.html`, `test-results/.last-run.json`; 2 real: `docs/LOCAL_SETUP.md`, `tests/unit/game-engine/modes/ShanghaiMode.test.ts` |
| `npm run build` | exit 0 | 23 routes prerendered (Next.js 16.4.5, Turbopack) |

Two of the three failing tests fail **only because** `npm run format:check` fails: `formatting.test.ts` runs it directly, and `ci-workflow.test.ts` replays every `npm run` step of `ci.yml` (lint, format:check, typecheck) locally. The third failure is environmental — it needs a PostgreSQL server.

**The gate for this plan is therefore "no NEW failures relative to the table above"**, and this plan is expected to *reduce* it: fixing the format gate turns `formatting.test.ts` and `ci-workflow.test.ts` green, leaving only the PostgreSQL-dependent failure. The remaining failure is environmental, not a regression, and is not this plan's to fix.

> Note: an earlier draft of this table quoted "10 failed / 256 passed" and lint/typecheck failures. Those numbers came from a stale log file (`test_full_suite_output.log`, 2026-11-08) and were wrong. The table above is the measured truth and is the only baseline to compare against.

## Scope

### In Scope
- Install Tailwind CSS v4 + `@tailwindcss/postcss` as devDependencies (via `npm install -D`, so `package-lock.json` stays in sync for `npm ci`).
- Add `postcss.config.mjs` so Next.js runs the Tailwind pipeline.
- Add `app/globals.css` with the Tailwind import plus the base design tokens (dark colour scheme, page background, foreground colour, font stack applied to `body`).
- Import the global stylesheet from `app/layout.tsx`.
- Rename the single legacy utility `bg-gradient-to-br` → its canonical v4 name `bg-linear-to-br` (a canonicalisation: v4 still emits the old name as a working alias).
- Add a Playwright regression test that proves `/game-center` is actually styled (guards against the stylesheet being dropped again). It runs as a **local guard**; `.github/workflows/ci.yml` is not changed.
- Verify typecheck, ESLint, Prettier, the Vitest suite and a production build against the recorded baseline.
- Fix the format gate: ignore the three generated Playwright artifact directories (`.gitignore` + `.prettierignore`) and Prettier-format the two real files that are unformatted. This turns `formatting.test.ts` and `ci-workflow.test.ts` green.
- Write `reports/game-center-styling-fix.md`.

### Out of Scope
- Any change to game logic, the game engine, the five game modes, scoring, or the shared game components' behaviour.
- shadcn/ui component primitives (not installed, not used by these pages, not needed to fix the styling).
- Introducing a `tailwind.config.*` JS config — Tailwind v4 is CSS-first and needs none.
- Visual redesign of the Game Center (only "renders as designed", not "looks different").
- Fixing the PostgreSQL-dependent test failure `tests/integration/linkGuest.test.ts` — it needs a database server on `localhost:5432`; environmental, not a regression.
- Wiring the E2E suite into `.github/workflows/ci.yml` — E2E has never run in CI, and enabling it (browser install, dev server in CI, DB-dependent specs) is a separate capability, not part of this fix. The CSS *pipeline* stays CI-enforced through `npm run build`, which does run in CI.
- Restyling the `/` home route (`app/page.tsx` has no theme classes). It inherits the new dark body theme, so it is consistent rather than broken; giving it a layout is a design task, not a bug fix. Reported as a known limitation.
- The uncommitted state of the wider `darthub-full-product-planning` work.

## Success Criteria
- [ ] `/game-center` renders with the dark slate theme, the Tailwind font stack and compiled card gradients — no browser defaults.
- [ ] All five game modes (`/game`, `/game/301`, `/game/cricket`, `/game/around-the-clock`, `/game/shanghai`) still render and play correctly.
- [ ] Game logic, scoring and the domain tests are unchanged.
- [ ] A Playwright test fails if the global stylesheet is removed from the root layout.
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` and `npm run build` introduce **no new failures** relative to the baseline table above; `npm run build` must be fully green.
- [ ] `npm run format:check` is fully green, which drops the test suite from 3 failures to 1 (the remaining one needs PostgreSQL).
- [ ] The fix is documented in `reports/game-center-styling-fix.md`.

## Task Overview
| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| 001 | Wire up the Tailwind v4 toolchain and global stylesheet | - | completed |
| 002 | Migrate the legacy gradient utility to its canonical v4 name | 001 | completed |
| 003 | Add a Playwright regression test proving the page is styled | 001, 002 | completed |
| 004 | Run the full quality gate and document the fix | 002, 003 | completed |

## Architecture Notes
- Tailwind v4 is CSS-first: configuration lives in `app/globals.css` via `@theme` (optional — v4 already ships the `--font-sans` / `--font-mono` tokens); no `tailwind.config.js` is created.
- PostCSS pipeline: `postcss.config.mjs` → `{ plugins: { "@tailwindcss/postcss": {} } }`.
- The root layout stays the single place that loads global CSS (`import "./globals.css"`), matching the Next.js App Router convention.
- Base theme tokens go in `@layer base` so page-level utility classes keep overriding them.
- The stylesheet lives in `app/globals.css`, not in `styles/` as `.claude/architecture.md` suggests — that `styles/` entry describes the Tailwind v3 convention (a JS config plus a global CSS file) and the App Router convention is used instead. The architecture doc is not changed by this plan.
- `src/components/game/*` and the five game pages are read-only for this plan apart from the one utility rename.

## Risks & Mitigations
- **Tailwind v4 automatic source detection misses files**: v4 scans the project root and respects `.gitignore`. `app/` and `src/` are not ignored, so all components are picked up. Verified by the compiled CSS containing the utilities the pages use.
- **A legacy utility name still lurking**: task 002 audits the whole tree for legacy names (`bg-gradient-to-*`, `flex-grow-*`, `flex-shrink-*`, `overflow-ellipsis`, `decoration-slice`) so nothing is silently dropped. Note that Tailwind v4 keeps the old gradient name as a *working* alias, so the audit is about canonicalisation, not breakage.
- **Dark base theme breaks existing tests**: the current E2E assertions target text content and visibility, not colours, and the Vitest suite does not assert on styles. The full suite plus the production build are re-run as the gate.
- **A false-pass regression test**: the UA stylesheet already renders `h1` bold, so a `font-weight` assertion would pass with no stylesheet at all. Task 003 asserts `font-family` / `font-size`, `body` background and the card's `background-image` instead.
- **PostCSS config breaks the standalone Docker output**: the compiled CSS is emitted to `.next/static/css/`, which the `Dockerfile` copies separately (it is *not* inside `.next/standalone`). `next build` is run as part of task 004 and `.next/static/css/` is inspected.
- **`npm ci` breaks on an out-of-sync lock file**: the Dockerfile and CI both run `npm ci`. The dependencies are installed with `npm install -D`, never by hand-editing `package.json`.
- **Prettier reformats unrelated files**: `npm run format` would rewrite four invite-feature files. Only the files this plan touches are formatted.
- **Unrelated uncommitted work**: the working tree already contains uncommitted Game Center files from the previous plan, and the pre-existing gate failures listed in the baseline table. They are left untouched; **no commit is created without the user's explicit consent**.

## Commit Policy
The user has explicitly required: **no commits without explicit consent.** This plan therefore stops after task 004's verification and report; the orchestrator must not run the commit step and must report the working-tree state instead.

# Task 003: Add a Playwright regression test proving the page is styled

**Status**: completed
**Depends on**: 001, 002
**Retry count**: 0

## Description
The styling bug was invisible to the existing test suite: every E2E assertion checks text content and visibility, so the pages passed while rendering as unstyled HTML. Add a browser-level regression test that fails when the global stylesheet is missing, so the same class of regression cannot ship again unnoticed. This task owns **all** browser-level assertions for the plan.

## Context
- Related files:
  - `e2e/game-center.spec.ts` — add a new `test.describe` block, e.g. `"Game Center Styling"`. Keep the existing 10 tests untouched.
  - `playwright.config.ts` — **do not modify**.
  - `.github/workflows/ci.yml` — **do not modify** (see "CI wiring" below).
- The assertions must read **computed styles**, not class names. Asserting that `.bg-slate-900` exists in the DOM would pass even with no stylesheet attached.
- Useful checks (all browser-level):
  - the `body` computed `background-color` is the slate-900 token (without a stylesheet the body background is transparent `rgba(0, 0, 0, 0)`),
  - the `h1` computed `font-family` is a sans-serif stack — **not** the UA default serif (`Times New Roman`),
  - a game card link's computed `background-image` contains `linear-gradient`,
  - the document carries at least one stylesheet (`link[rel="stylesheet"], style` — either form satisfies this; Next/Turbopack does not guarantee a `<link>` element in every mode, so this is a secondary check).
- **Do not assert `font-weight` on the `h1`.** The browser's user-agent stylesheet already sets `h1 { font-weight: bold }`, so that assertion passes even when the stylesheet is completely missing — it cannot fail and therefore guards nothing. Use `font-family` and/or `font-size` (`text-3xl` → 30px, vs the UA default h1 32px) instead, which only Tailwind can produce.
- The slate-900 token resolves to `rgb(15, 23, 42)` in Tailwind v4. Assert on the computed value, and keep the assertion tolerant of the `rgb()` / `rgba()` formatting the browser reports.
- Follow the existing Playwright style in the file: `test(...)` / `await expect(...)`, `page.goto("/game-center")`, `page.locator(...)`.
- Playwright is a dev dependency and is already installed; no new package is required.

### Running Playwright locally
- `playwright.config.ts` only defines `webServer` when `process.env.CI` is set. Locally the dev server must **already be running** on `http://localhost:3000` (the `baseURL`); start it with `npm run dev` before running the suite.
- Restart the dev server after task 001/002 land so Turbopack does not serve a stale bundle.
- Use `--reporter=list`. The configured `reporter: "html"` starts a blocking report server on failure and will hang the run instead of returning a result.
- If the browser binary is missing, run `npx playwright install chromium` first.
- `reports/style-probe.mjs` already dumps the exact computed values needed (body background, body font, h1 font, card background image, stylesheet link count). Reuse it as a one-shot probe instead of writing a new script.

### CI wiring — explicitly out of scope
`.github/workflows/ci.yml` has never run Playwright, and this plan does **not** change that. Wiring E2E into CI means installing browsers on every push, starting a dev server in CI, and dealing with the DB-dependent specs — that is a new capability and a separate development phase, not part of fixing the styling. The user explicitly asked that no new development phase begin before this bug is fixed and documented.
- The regression test is therefore a **local guard**: it runs via `npx playwright test e2e/game-center.spec.ts --reporter=list` with the dev server up, and the task 004 report must state plainly that it is not enforced by CI.
- The one cheap mitigation that *is* in scope is task 001's build-level check: the production build emits the compiled stylesheet, and `npm run build` **does** run in CI. A missing `postcss.config.mjs` or a missing `import "./globals.css"` breaks the build or drops the utilities, so the CSS pipeline itself stays CI-enforced even though the browser assertions do not.
- If CI wiring is wanted later, it belongs in its own plan.

## Requirements (Test Descriptions)
- [x] `it carries a stylesheet in the game center document`
- [x] `it applies the slate-900 page background to the body`
- [x] `it renders the game center heading with the sans-serif design token font stack`
- [x] `it applies a linear gradient background to the game mode cards`
- [x] `it keeps all five game mode cards visible and linked on the game center page`
- [x] `it fails when the global stylesheet is removed from the root layout`

## Acceptance Criteria
- The new tests fail when the `import "./globals.css"` line is removed from `app/layout.tsx` (verify this by temporarily removing it, running the test, then restoring it — do not leave the removal in place).
- The new tests pass with the stylesheet in place.
- The 10 pre-existing `e2e/game-center.spec.ts` tests still pass.
- `.github/workflows/ci.yml` and `playwright.config.ts` are unchanged; no new `npm run` script is added.
- No new package is added.
- `npm run lint` and `npm run typecheck` stay **green** (both exit 0 today — measured baseline in task 004). `npm run format:check` still fails today; task 004 fixes it; this task must not make it worse.
- Format only the files this task touches: `npx prettier --write e2e/game-center.spec.ts`.

## Implementation Notes

Added a new `test.describe("Game Center Styling")` block to `e2e/game-center.spec.ts`
(6 tests). The 10 pre-existing tests were left untouched. No other file was modified:
`playwright.config.ts`, `.github/workflows/ci.yml` and `package.json` are unchanged, and no
package was added.

### Assertion design
All assertions read **computed styles** via `getComputedStyle` / `toHaveCSS`, never class names.

- **stylesheet present** — a bare element count of `link[rel="stylesheet"], style` is worthless
  here: Next always injects a font-face `<style>` even with `globals.css` missing (measured:
  0 links + 1 font-only `<style>` in the broken state). The test therefore also counts
  `CSSStyleRule` entries reachable through `document.styleSheets` (recursing into
  `CSSLayerBlockRule`s, which is how Tailwind v4 emits its utilities). Broken state = 0
  style rules, styled state = 295.
- **slate-900 body background** — compares `getComputedStyle(body).backgroundColor` against
  `getComputedStyle(main).backgroundColor` (the `<main>` carries the `bg-slate-900` utility)
  and asserts it is not the browser default `rgba(0, 0, 0, 0)`. This avoids hard-coding a
  colour string: Tailwind v4's palette is oklch-based and Chrome serialises it as
  `lab(7.78673 1.82346 -15.0537)`, not `rgb(15, 23, 42)`.
- **heading font stack** — asserts the `h1` `font-family` contains `sans-serif` and does not
  contain `Times New Roman`, plus `font-size === "30px"` (Tailwind `text-3xl`; the UA default
  `h1` is 32px). `font-weight` is deliberately **not** asserted — the UA stylesheet already
  sets `h1 { font-weight: bold }`, so that assertion could never fail.
- **card gradient** — first `main a` must have a `background-image` containing
  `linear-gradient` (styled: `linear-gradient(to right bottom, lab(59.0978 -58.6621 41.257…))`;
  broken: `none`).
- **five cards** — count is 5, each is visible, each has an `href` starting with `/game`, and
  each has `display: block` (the `block` utility; without the stylesheet the anchor falls back
  to `inline`). The `display` check is what makes this test fail in the broken state.
- **"fails when the global stylesheet is removed"** — a self-verifying guard: it first asserts
  the page *as actually served* by `app/layout.tsx` is styled (so it fails if the root layout
  stops importing `./globals.css`), then re-loads the page with `page.route("**/*.css", abort)`
  to simulate the missing stylesheet and asserts the page falls back to the UA defaults
  (transparent body, `Times New Roman`, 32px, `background-image: none`). This proves the
  other assertions in the block have teeth rather than merely documenting them.

### RED step (the important verification)
`import "./globals.css";` was temporarily removed from `app/layout.tsx` and the suite re-run
with `npx playwright test e2e/game-center.spec.ts --reporter=list`:

```
6 failed
    [chromium] › e2e\game-center.spec.ts:148:3 › Game Center Styling › it carries a stylesheet in the game center document
    [chromium] › e2e\game-center.spec.ts:184:3 › Game Center Styling › it applies the slate-900 page background to the body
    [chromium] › e2e\game-center.spec.ts:200:3 › Game Center Styling › it renders the game center heading with the sans-serif design token font stack
    [chromium] › e2e\game-center.spec.ts:220:3 › Game Center Styling › it applies a linear gradient background to the game mode cards
    [chromium] › e2e\game-center.spec.ts:231:3 › Game Center Styling › it keeps all five game mode cards visible and linked on the game center page
    [chromium] › e2e\game-center.spec.ts:249:3 › Game Center Styling › it fails when the global stylesheet is removed from the root layout
10 passed (17.8s)
```

Representative failure messages:

```
1) ... it carries a stylesheet in the game center document
   Error: expect(received).toBeGreaterThan(expected)
   > 181 |     expect(styleRuleCount).toBeGreaterThan(0);

2) ... it applies the slate-900 page background to the body
   Error: expect(received).not.toBe(expected) // Object.is equality
   Expected: not "rgba(0, 0, 0, 0)"

3) ... it renders the game center heading with the sans-serif design token font stack
   Error: expect(received).toContain(expected) // indexOf
   Expected substring: "sans-serif"
   Received string:    "\"Times New Roman\""

4) ... it applies a linear gradient background to the game mode cards
   Error: expect(received).toContain(expected) // indexOf
   Expected substring: "linear-gradient"
   Received string:    "none"

5) ... it keeps all five game mode cards visible and linked on the game center page
   Error: expect(locator).toHaveCSS(expected) failed
   Locator:  locator('main a').first()
   Expected: "block"
   Received: "inline"

6) ... it fails when the global stylesheet is removed from the root layout
   Error: expect(received).not.toBe(expected) // Object.is equality
   Expected: not "rgba(0, 0, 0, 0)"
```

All 6 new styling tests failed; all 10 pre-existing tests still passed (they only assert text
and visibility, which is exactly why the original bug shipped unnoticed).

The import was then restored and the suite re-run green.

### Final green run
`npx playwright test e2e/game-center.spec.ts --reporter=list` → **16 passed (11.1s)**
(10 pre-existing + 6 new).

### Other checks
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npx prettier --check e2e/game-center.spec.ts` → clean
- `app/layout.tsx` final content confirmed to contain `import "./globals.css";` (line 2)

### CI status (important caveat for task 004)
This regression test is a **local guard only**. `.github/workflows/ci.yml` still does not run
Playwright, so these assertions are **not enforced by CI** — they only run when someone
executes `npx playwright test e2e/game-center.spec.ts --reporter=list` with the dev server up
on `http://localhost:3000`. The only CI-enforced protection remains task 001's build-level
check: `npm run build` runs in CI and fails if `postcss.config.mjs` or the
`import "./globals.css"` line is missing.

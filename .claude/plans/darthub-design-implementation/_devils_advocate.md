# Devil's Advocate Review: darthub-design-implementation

Reviewed: `_plan.md` and tasks 001–010, against `DESIGN.md`, `design-system/darthub/MASTER.md`, `design-system/darthub/board.md`, `design-system/darthub/pages/game-center.md`, and the live repository (`src/game-engine/`, `src/components/`, `app/`, `tests/`, `e2e/`, `node_modules/tailwindcss/`).

All Critical and Important findings below have been applied to the plan files.

---

## Critical (Must fix before building)

### C1 — `--space-*` and `--duration-*` do not generate Tailwind v4 utilities (task 001)
The plan named the spacing scale `--space-xs|sm|md|lg|xl|2xl|3xl|4xl` and the motion scale `--duration-instant|fast|base` as `@theme` tokens, and told components to reference them as utilities. Tailwind v4 only generates utilities from a fixed namespace list — `--color-*`, `--font-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--ease-*`, `--animate-*`, `--breakpoint-*`, `--container-*` — plus a single `--spacing` multiplier. Verified against `node_modules/tailwindcss/theme.css` and `dist/lib.mjs`: there is no `--space-*` or `--duration-*` namespace, and `dist/lib.mjs` resolves spacing through `--spacing` and durations through `--transition-duration`.

Consequence: `p-md`, `gap-lg`, `space-2xl`, `duration-fast` would silently not exist. `design-system/darthub/pages/game-center.md` §3 and `DESIGN.md` §8.2 both specify spacing as utilities (`space-3xl`, `space-2xl`, `space-md`). Every spacing utility in the UI would be dropped at build time with no error.

**Fix applied:** task 001 now declares the `MASTER.md` names *and* the utility-generating aliases (`--spacing-*`, `--transition-duration-*`), states which form components use, and the acceptance criterion names the specific utilities that must appear in the emitted CSS.

### C2 — `next/font` variable name collides with the `@theme` font token (task 001)
`MASTER.md` §4.3 shows `Barlow_Condensed({ variable: "--font-display" })` while also defining `--font-display` in `@theme`. Two definitions of one custom property: the `next/font` value wins for the font-family resolution and the `@theme` value wins for the utility, so the stack breaks silently.

**Fix applied:** task 001 specifies distinct names (`--font-barlow-condensed`, `--font-barlow`, `--font-jetbrains-mono`) and `@theme inline` (without `inline`, Tailwind resolves the `var()` at build time and emits a dead value).

### C3 — the type scale is missing from the token list (task 001)
The plan's token list had families, spacing, radius and motion but **no font sizes**. `MASTER.md` §4 defines `--text-display|title|heading|body|label|caption|score-xl|score-lg|score-md|score-sm`, and `DESIGN.md` §8.2 and `game-center.md` §2.2 both reference `text-display`, `text-body`, `text-caption`, `text-score-md` as utilities. Without them, task 006 and task 007 have no size tokens to use.

**Fix applied:** the full type scale, with line-height companions, added to task 001's token list and to `_plan.md`'s architecture notes.

### C4 — the Double Out default breaks an existing domain test, and the plan claimed it would not (task 005)
`tests/unit/game-engine/modes/StandardMode.test.ts` asserts straight-out behaviour using `new Standard501Mode()` / `new Standard301Mode()` and finishes on `points: 1` with no segment. Under double out, `DoubleOutRule.isCheckout(undefined, 1)` is false (`src/game-engine/rules/OutRules.ts:61`), so the throw becomes a bust and the test fails. The plan asserted "the existing domain tests still pass unchanged" — false.

**Fix applied:** task 005 now names the failing assertions, prescribes the precise fix (the two straight-out cases construct `StandardMode` explicitly and keep their assertions; new cases cover the wrappers' double-out default), and forbids weakening or deleting assertions.

### C5 — the plan's own acceptance criteria for tasks 002 and 005 contradict each other
Task 002 said "No file under `src/game-engine/modes/` is modified" while task 005 required `Standard501Mode`/`Standard301Mode` to change their default — and task 005's own criterion said `git diff src/game-engine/modes/` must show "no behavioural change", which the default change *is*.

**Fix applied:** `_plan.md` now has a dedicated section, *"The boundary on 'the game rules must not change'"*, stating what changes (configuration), what does not (`OutRules.ts` and `LegSetManager` untouched — `git diff src/game-engine/rules/` must be empty), and what test changes are permitted. Task 002 and task 005 criteria are rewritten to match.

### C6 — a bust is a thrown error, never a returned state (task 005)
`StandardMode.applyThrow` throws `GameEngineStateError("Bust: …")` (`src/game-engine/modes/StandardMode.ts:104`) and the engine leaves the match state untouched — the engine's own README says so. The plan asked the score sheet for "visit chips (green = counted, red = bust)" and a bust indicator, with no statement of where the bust comes from. A worker following the plan would either build a BUST chip that never renders, or string-match the error message — which cannot distinguish a bust from "not your turn", since both are `GameEngineStateError`.

Three consequences the plan never stated: the UI must compute the bust itself; a bust does **not** consume a dart (so the BUST chip is UI-local state); a bust does **not** end the turn.

**Fix applied:** task 005 has a new section, *"A bust is a thrown error, not a returned state"*, with all three consequences, and the acceptance criteria forbid string-matching the error message.

### C7 — the Game Center sheet was to hardcode the rule values the design document says must be generated (task 006)
`design-system/darthub/pages/game-center.md` §2.3 makes this a hard requirement: *"Every rule value on this page is read from the mode registry in `src/game-engine/modes/`, not typed as prose in the page file."* `DESIGN.md` §8.2 repeats it, with the reason: the current page hardcodes a rule the engine does not implement, and that is the defect this plan exists to fix.

The plan's task 006 listed the correct values as literals with no registry. That would have left the drift possible one edit away — the same class of bug, one task later.

**Fix applied:** task 006 now builds `src/game-engine/modes/registry.ts`, derives each value from the modes' own exported constants (`CRICKET_TARGETS`, `MARKS_TO_CLOSE`, `AROUND_THE_CLOCK_TARGETS`, `SHANGHAI_ROUNDS`, `roundTarget`), reads the checkout column from the mode's actual default, and has an acceptance criterion asserting the page's cells equal the registry's entries.

### C8 — `aria-disabled` does not prevent a radio from being selected (task 006)
The plan required the two planned board sources to carry `aria-disabled="true"` and to be unselectable. `aria-disabled` is a semantic hint to assistive technology, not a behavioural lock — a radio with it is still changeable by mouse and keyboard. Without a behavioural guard, clicking "Camera Board" selects it and the match starts with no board — exactly what `board.md` §9.2 forbids.

**Fix applied:** task 006 specifies a controlled radio group whose change handler ignores an unavailable selection, keeping `aria-disabled` and focusability.

---

## Important (Should fix before building)

### I1 — the dependency graph was wrong in three places (all tasks)
As written, task 005 depended on 003/002 but needed task 007's new `onThrow` signature; task 008 depended on 007 but used the board from 003; and task 005 and task 006 both wrote `src/components/game/`, which task 007 also owns. With a two-worker limit, workers would have edited the same files concurrently.

**Fix applied:** the order is now 001/002 → 003/004 → 006/009 → 007 → 005/008 → 010, with an explicit statement of which task owns which file, and the executable waves spelled out in `_plan.md`.

### I2 — the board component had no prop contract, but three tasks depend on it (tasks 003, 005, 008)
The plan described the board's rendering and interaction but never its props. Tasks 005 and 008 had to build against an API that did not exist.

**Fix applied:** task 003 now defines `DartBoardProps` explicitly, with the constraint that the component imports only React and `src/board/boardGeometry.ts` — no engine, no camera — and an acceptance criterion that greps for it.

### I3 — the armed segment would have existed in two copies (tasks 003, 007)
`board.md` §6.5 requires the pad and the board to be "two views of one state". The plan made the board's armed band a board feature and the pad's a pad feature.

**Fix applied:** the armed segment is one piece of state in the match view, passed to both as a prop; both task 003 and task 007 state this, and task 007's pad props include `armedSegment` and `onArmedSegmentChange`.

### I4 — the pad's bull/miss keys contradicted the engine's validator (task 007)
The plan described the pad as an armed band of `1× / 2× / 3× / Bull`. But `board.md` §6.5 specifies bull as **separate keys** (`50`, `25`), not a band — a bull is a different place on the board, not a multiplier.

More seriously, a miss **cannot carry a segment**: `GameEngine.validateThrowInput` calls `isValidSegmentScore(segment, points)`, and that helper returns `false` for any `points <= 0` (`src/game-engine/rules/OutRules.ts:40`). A miss sent with a segment is a validation error, not a zero-scoring throw. The plan's requirement "it submits the segment with every throw" would have made every miss an error.

**Fix applied:** task 007 now specifies the three pad groups exactly as `board.md` §6.5 does, states that bull is not a band, and makes the segment-less miss an explicit correctness requirement in the requirements, acceptance criteria and the `onThrow` signature.

### I5 — every route rendered its own `<main>`, and the shell adds one (task 004)
All ten pages open with `<main className="min-h-screen …">`. `DESIGN.md` §8.1 puts `<main id="main">` in the shell. Adding it without converting the pages gives every route two nested `<main>` landmarks — invalid HTML and two "main" regions for a screen reader.

**Fix applied:** task 004 owns the decision (the shell owns the landmark), converts each page's `<main>` to a `<div>` in the same task so the work is not contended, adds `tabIndex={-1}` (without it the skip link scrolls but focus does not move), and adds an acceptance criterion asserting exactly one `<main>` per route. Tasks 005, 006, 008 and 009 now state that they render inside the shell's `<main>`.

### I6 — the mobile tab bar was missing (task 004)
`DESIGN.md` §8.1 specifies that below 768 px the nav collapses to a **bottom tab bar** (5 destinations max, 64 px + safe-area inset), and §10 requires its height to be reserved as padding on `<main>`. The plan only mentioned the nav "fitting without a horizontal scrollbar".

**Fix applied:** task 004 now specifies the bottom tab bar, its 5-destination cap, and the height reservation below 768 px.

### I7 — the existing tailwind test asserts on the old tokens (task 001)
`tests/unit/tailwind/tailwindToolchain.test.ts:116` asserts the compiled CSS contains `.bg-slate-900`, and line 130 asserts the `body` rule matches `/slate-900/`. Task 001 removes exactly those.

**Fix applied:** task 001 names the test and the two assertions, and requires them updated to the token classes.

### I8 — the palette-utility test could not have passed at task 001 (task 001)
The plan wanted a test that fails on any palette utility in a component file. At task 001, `src/components/game/*` still uses `bg-slate-800`/`bg-blue-800`/`bg-purple-800` (tasks 007) and `app/game-center/page.tsx` still uses gradients (task 006). Such a test fails immediately at task 001.

**Fix applied:** the test scans the files task 001 owns plus an **enumerated** allow-list of files pending migration, which tasks 006/007/008/009 shrink as they land. An unenumerated allow-list would be a test that passes for the wrong reason.

### I9 — the board's band colours were specified wrongly (task 003)
The plan said "the treble band is green and the double band is red on every real board" and required a test for it. `board.md` §2.3 specifies the opposite and more subtle rule: band colour is **positional** — odd positions in the segment order get a black bed with red bands, even positions get a light bed with green bands. A board where every treble is green is not the specified object.

**Fix applied:** task 003 states the positional rule and the requirement is rewritten to assert the alternation.

### I10 — the board's rendered sizes contradicted the spec (task 003, `_plan.md`)
The plan said 600 / **498** / 300 px. `board.md` §8.2 specifies **520 px** at 1024, and §7.2's target-size measurements are computed from it.

**Fix applied:** 600 / 520 / 300 throughout, with a note that §8.2's 520 px is the figure the measurements derive from.

### I11 — the board's dimensions, insets, wires and numerals were underspecified (task 003)
The plan gave the radii but not the **0.6 mm radial and 0.6 mm arc insets** (§4.2, without which the beds touch and the wires have no channel), the wire ring radii (15.9, 99, 107, 162, 170), the numeral radius (191 mm) and cap height (28 mm) with outward-pointing tops (§2.4), or the `bg-sunken` well.

**Fix applied:** all of these are now in task 003's rendering section, with the material strengths corrected to §3.2's values (12–18 % sisal, 8–12 % steel, key light at (−70, −90) mm, 25 % vignette — the plan said 26 %, 20 %, (−72, −92) and 42 %).

### I12 — the roving-tabindex grid was unspecified (task 003)
`board.md` §6.6 requires **62** real `<button>`s (20 sectors × 3 beds + 2 bulls), a roving tabindex, arrow-key movement, and **two** focus indicators — a 2 px cream outline on the bed *and* a 1 px brass outline around the whole sector, because a single outline on a 9 px band is invisible. The plan said only "roving tabindex over named controls".

**Fix applied:** task 003 specifies the 62 cells, the key bindings, the names ("Treble 20, 60 points"), the two-indicator focus treatment, and adds a requirement and acceptance criterion for the grid. The live region is assigned to the match screen (per §6.7 and `DESIGN.md` §11), not the board.

### I13 — the band-boundary rule was missing (task 002)
`board.md` §2.2: boundary values belong to the **inner** band. Without it, a hit at exactly r = 99 could be a single or a treble — a whole band of points, and the existing test list does not probe the boundaries.

**Fix applied:** task 002 states the inclusive-inner-band rule and the sector-edge rule, and adds boundary radii to the acceptance criteria.

### I14 — "consider moving `isValidSegmentScore`" was undecided and directionally risky (task 002)
The plan left it optional. Moving it into the board module would mean the board module owns game-rule validation and imports engine types — the wrong dependency direction, given the engine is meant to alias the board's type, not the reverse.

**Fix applied:** the decision is made — `isValidSegmentScore` **stays** in `OutRules.ts`, unchanged, with the rationale stated, plus a new requirement that every pair the resolver can produce is accepted by the engine's validator.

### I15 — `CameraDTO`'s new field needed a guard against the existing test (task 002)
`tests/unit/camera/cameraDTO.test.ts:23` asserts the DTO's keys are exactly `["score","timestamp","x","y"]`. Adding an optional `segment` keeps that test passing, but only if the field is genuinely optional and the sample is unchanged.

**Fix applied:** task 002 requires `segment?: BoardSegment` to be optional and the existing test to stay green.

### I16 — the non-x01 modes do not read `segment` at all (task 008)
`CricketMode.toSegmentHit` (`src/game-engine/modes/CricketMode.ts:27`), `AroundTheClockMode.hitsTarget` (`:73`) and `ShanghaiMode.segmentMarks` (`:135`) all derive everything from **points**. The plan said "read the mode implementations to see what each mode consumes" without saying what that means, and warned against "assuming" — which invited a worker to feed the board's segment into these modes and break them.

A concrete consequence: cricket's bull is 25 points for one mark and 50 points for two marks, so the board's inner bull and outer bull are **not** interchangeable in cricket.

**Fix applied:** task 008 spells out each mode's points→marks mapping, states that the board's `points` passes straight through and its `segment` is a UI label only, and adds a requirement that the inner bull counts as two marks.

### I17 — the career page's real data sources were not identified (task 009)
The plan said "check what actually exists before deciding what to show". The actual sources are six quest JSON files, `createQuestLoaderService()`, the quest schema, `CareerProgressRepository`, three career API routes and the XP/level maths in `progressionService.ts` — all listed in task 009 now, so the page can show the real quest catalogue rather than an empty shell.

**Fix applied:** task 009 lists the sources, requires the quests to be read **through the loader** (not reconstructed from filenames), and requires the empty state where progress does not exist.

### I18 — the UI unit tests and snapshots will break (task 009)
`tests/unit/ui/dashboard.test.tsx`, `lobby.test.tsx` and `career.test.tsx` assert specific Tailwind classes (`min-h-screen`, `grid-cols-1`, `md:p-8`, `bg-slate-700`, `bg-blue-600`), specific strings, and stored snapshots. `tests/integration/ui-skeletons.test.tsx` asserts the dashboard's "Rating"/"Level"/"Friends" and the career page's "Quest"/"Progress"/"Training".

**Fix applied:** task 009 requires those tests to be updated to assert the new design's semantic contract, with the explicit warning that re-recording a snapshot proves nothing.

### I19 — the e2e suite asserts on the old Game Center and the old pad (task 010)
`e2e/game-center.spec.ts` has 16 passing tests that assert the gradient cards, `main a` having exactly 5 elements, the `text-3xl` heading and the `slate-900` background — all of which task 006 replaces. It also drives the four match flows by clicking pad keys labelled `"T20"`, `"S1"` and `"20"`, which the new pad does not have. The plan's gate did not mention e2e at all.

**Fix applied:** task 010 names the file, lists the assertions that change, and adds the Playwright suite to the success criteria and to `_plan.md`.

### I20 — the visual QC measurements were specified in the wrong place (task 010)
The plan listed contrast, target size and overflow checks but left the method to "compute the contrast ratio of the actual rendered colours". These are properties of **rendered pixels** — CSS variable values prove nothing about the rendered pair, and a `pointer-events: none` element is not a target even if its box is 44 px.

**Fix applied:** task 010 specifies the Playwright-based method (computed colours with alpha compositing, `getBoundingClientRect`, `scrollWidth` vs `clientWidth` on both `documentElement` and `body`, `emulateMedia({ reducedMotion: "reduce" })`), and Playwright is already installed with a config in place.

---

## Minor (Nice to address)

- **M1 — `app/layout.tsx` is a server component and the nav needs the pathname.** Task 004's "keep it server-rendered by default" is right for the header and `<main>`, but the current-item state needs `usePathname`, so the nav is necessarily a client component. Now stated explicitly.
- **M2 — `lucide-react` is a runtime dependency.** The plan noted this in prose but the file list said only "add `lucide-react`". Task 001's acceptance criteria now say "as a runtime dependency".
- **M3 — the plan's "498 px" also appeared in `_plan.md`'s risks section**; corrected to 520 px alongside task 003.
- **M4 — `src/game-engine/index.ts` re-exports `ThrowSegment`** from `@/game-engine/types`. Task 002 now notes that path keeps working through the alias, so the re-export does not need a second edit.
- **M5 — task 010 named a specific PID (33596) from an earlier session.** A PID is meaningless by the time the task runs; replaced with "check whether a dev server is listening on port 3000".
- **M6 — `board.md` §8.2 also states the 1024 content width and the score-sheet compression.** Left to the implementer; not a defect, since `board.md` is the reference.

---

## Questions for the Team

- **Q1 — should `Standard501Mode`'s mode id change to `x01-501-double-out`?** It follows from `describeOutRule` at `src/game-engine/modes/StandardMode.ts:59`, and the suffix mechanism already exists for this. But if anything persists or matches on the mode id, the value changes. Nothing in the repo matches on it today (`src/realtime`, `src/ai` and the engine tests were checked), so the plan proceeds — flagging it because it is externally visible.
- **Q2 — is `src/game-engine/modes/registry.ts` the right home for the Game Center's mode metadata?** `game-center.md` §2.3 says "the mode registry in `src/game-engine/modes/`", and the plan follows it. The alternative is a UI-side module, which would keep display strings out of the engine but would diverge from the document. The plan follows the document; say if you would rather it live in `src/components/game/`.
- **Q3 — the plan does not specify the `README.md` update for the engine.** `src/game-engine/README.md` documents `outRule` as defaulting to `"straight"` (line 67) and shows `new StandardMode({ startScore: 501, outRule: "double" })`. After task 005 the wrappers default to double, so that README is slightly stale. Updating it is a documentation change to an engine file — outside the plan's stated scope, but cheap and arguably required for the "no drift" goal. Should task 005 update it?
- **Q4 — should the `e2e/game-center.spec.ts` assertions be rewritten or replaced?** Task 010 says rewritten to the new contract. If the Game Center is now a static rule sheet with no interactive behaviour beyond a link per row, several of the 16 tests may be better expressed as unit tests on the registry plus a smaller e2e smoke set. That is a judgement call about what the e2e suite is for.
- **Q5 — the board's documented WCAG 2.2 SC 2.5.8 deviation was reviewed on its merits, as requested.** The reasoning holds: the treble band is 8 mm of a 451 mm board, so no renderable board can satisfy a 24 px minimum for that target; the spacing exception fails because the wire channel is 1.2 mm; and the "essential" exception fails because the function is available through conformant targets. The mitigation is genuine only if it is implemented — the armed-band + numeral route, the 62-cell keyboard grid and the pad's segment radio group. The plan now makes all three acceptance criteria rather than citations. No change is recommended; the risk is in the implementation, not the decision.

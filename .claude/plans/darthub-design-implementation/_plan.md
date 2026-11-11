# Plan: DartHub Design Implementation

## Created
2026-11-09

## Status
completed


## Objective
Build DartHub's design system and its realistic interactive dartboard into the product: replace the ad-hoc Tailwind classes with the semantic token layer, render an authentic steel dartboard that resolves clicks into segment-aware throws, fix the Double Out defect that makes the advertised rule unwinnable, and rebuild the Game Center and the five match views on the "the board, after dark" art direction.

## Related Issues
none

## Discovery Notes
The design phase is complete. **Read these before implementing — they are the specification, not background:**
- `DESIGN.md` (614 lines) — the central design reference.
- `design-system/darthub/MASTER.md` (579 lines) — persisted design system plus the DartHub token set.
- `design-system/darthub/board.md` (722 lines) — the board specification: geometry, colour, materials, module API, interaction, target-size decision, source modes, layout.
- `design-system/darthub/pages/game-center.md` — the Game Center override.

Direction: **"the board, after dark"** — a warm-black instrument surface where the board's own colours carry game meaning (treble green = a visit that counted, double red = a bust), brass is the single accent, the score is a ruled sheet read at a glance. Barlow Condensed (display) / Barlow (body) / JetBrains Mono (every number that changes). Lucide icons.

**Verified functional defect this plan fixes.** `DoubleOutRule.isCheckout` (`src/game-engine/rules/OutRules.ts:61`) requires `segment === "double"`, but:
- `ThrowInput`/`ThrowRecord` (`src/game-engine/types.ts:31,92`) carry an optional `segment` that the **UI never sends** — `app/game/page.tsx` calls `engine.recordThrow({ playerId, points })` with points only.
- `app/game/page.tsx:29` builds `new StandardMode({ startScore: START_SCORE })` and `:31` calls `eng.startMatch({ playerIds: ids })` — **no `outRule` is ever passed**, so the mode falls back to `"straight"`.

Therefore **Double Out is unwinnable through the current interface**, and the Game Center copy advertising *"finish on a double"* for 501/301 is false. A board that resolves a click to `{ segment, points }` fixes this at the source.

**Verified architectural facts:**
- `src/` uses **flat feature folders** (`ai, auth, camera, career, components, friends, game-engine, privacy, rating, realtime`). There is **no** `src/domain/` and **no** `src/game/`, although `.claude/architecture.md` lists both — that document is aspirational and stale. `design-system/darthub/board.md` §5 proposes `src/domain/board/`; **this plan uses `src/board/`** instead, matching the convention the code actually follows and avoiding the introduction of a new architectural layer. See task 002.
- The camera pipeline already fixes the coordinate frame: `src/camera/CameraDTO.ts` and `src/camera/vision/Perspective.ts` both use board-plane millimetres, **x positive = right, y positive = above centre**. `HitDetector`'s documented intent already names the algorithm. The board module must use that frame exactly, so the future CV path needs no adapter.
- `src/game-engine/types.ts` owns `ThrowSegment` today. **Keep that export working.** The board module may own the definition and the engine may alias it, but no existing import may break.

**Tooling:** Tailwind CSS v4.3.5 + `@tailwindcss/postcss` are installed (`postcss.config.mjs`, `app/globals.css` exist). `lucide-react` and the three Google fonts are **not** yet installed and must be added by task 001. Both are free and open-source.

**Baseline (measured 2026-11-09, before this plan):** `npm run lint` exit 0, `npm run typecheck` exit 0, `npm run format:check` exit 0, `npm run test` exit 1 with **1 failed / 289 passed** (only `tests/integration/linkGuest.test.ts`, which needs PostgreSQL on `localhost:5432` — environmental, pre-existing), `npm run build` exit 0, Playwright `e2e/game-center.spec.ts` 16 passed.

**Two gate repairs made by the orchestrator after the design phase (not part of any task):** the design phase's own artefacts broke three repo meta-tests, because Prettier honours `.gitignore` but ESLint does not.
- `.claude/skills/**` — seven **untracked** third-party skill directories appeared in the project during this session, and ESLint linted their `.cjs` scripts into `no-require-imports` errors. `.claude/**` is now in the ESLint ignores; Prettier already skipped it via `.prettierignore`.
- `reports/**` — the gitignored scratch directory holding the design prototype's `.mjs` generator; ESLint now ignores it too.
- The design documents (`DESIGN.md`, `design-system/**/*.md`) are project source and were **Prettier-formatted**, not ignored — `npm run format:check` is green again.

These repairs are listed here so the change is not mistaken for an unrelated edit.

## Scope

### In Scope
- The semantic token layer in `app/globals.css` as Tailwind v4 `@theme`, plus self-hosted fonts and the Lucide icon family.
- `src/board/` — the shared board-geometry module (pure TypeScript, millimetres, camera-compatible).
- The `DartBoard` SVG component authored in millimetres.
- Segment-aware throws through the engine, and the Double Out fix on both halves (mode default and match configuration).
- The app shell: root layout navigation, skip link, reduced-motion handling.
- The Game Center rebuilt as a rule sheet with a Checkout column, plus the BoardSource selector.
- The shared game components rebuilt on the token layer, and the three non-x01 match views migrated onto them.
- Dashboard, lobby, career and the home route brought into the system.
- Visual quality control at 1440 / 1024 / 390, with problems fixed.

### Out of Scope
- **The game rules and scoring behaviour.** The engine's rules, modes, checkout logic and scoring maths are not changed — only the *inputs* reach them correctly, and the copy describing them is corrected.
- **Camera and Smart Dart implementation.** The UI models the three board sources; only Virtual Board is implemented. The two planned modes present as unavailable.
- Any change to the persisted design documents' art direction. This plan implements what they specify.
- Prisma, auth, realtime, career backend, ratings — untouched.
- The `/` home route's *content* — only its presentation comes into the system.

### The boundary on "the game rules must not change"
This needs one sentence of precision, because the plan otherwise reads as if it does two contradictory things.

**What changes:** the *default configuration* of the x01 modes and the *inputs* the UI sends. `Standard501Mode`/`Standard301Mode` gain `outRule: "double"` as their default, and `MatchConfig.outRule` carries the player's choice. Both are configuration, not rules.

**What does not change:** `src/game-engine/rules/OutRules.ts` (the `OutRule` implementations and `isValidSegmentScore`), `LegSetManager`, and every mode's scoring arithmetic. `git diff src/game-engine/rules/` must be empty. `src/game-engine/modes/` may change only in the x01 wrappers' `outRule` default and the `ThrowSegment` re-export — nothing else.

**The test that proves it:** `tests/unit/game-engine/modes/StandardMode.test.ts` is the engine's own contract for the x01 modes and it asserts straight-out behaviour. Those assertions stay **unchanged** — the wrappers' default changes, not the rules. Any edit to that file is a red flag that the boundary has been crossed.

**The consequence that must be accepted:** `Standard501Mode`'s mode id becomes `x01-501-double-out` (the id already carries a `-<rule>-out` suffix by design, `src/game-engine/modes/StandardMode.ts:59`). That is an expected, visible consequence of the fix, not a regression.

## Success Criteria
- [ ] Every colour, spacing step, radius and type size used in the UI comes from the token layer — no palette utilities (`bg-blue-500`, `text-slate-400`) in components.
- [ ] The board renders authentic geometry: correct segment order, red/green double and treble bands alternating by sector position, alternating black and light singles, correct bull and outer bull, visible number ring, procedural materials.
- [ ] Clicking a bed resolves to the correct segment and points, and the throw reaches the engine.
- [ ] **Double Out is winnable**: a double finishes the leg, a non-double does not, and the Game Center copy matches the rule that is actually in force.
- [ ] The Game Center shows the modes' real rules and no two cards differ only by colour.
- [ ] All five game modes still play correctly and their domain tests are green.
- [ ] No horizontal scroll at 390 px; no interactive target below 44 px except the board's painted beds, which are a documented deviation.
- [ ] Exactly one `<main>` landmark per route, and the skip link moves focus to it.
- [ ] The visual QC pass at 1440 / 1024 / 390 is performed, its findings are recorded, and the visible problems are fixed.
- [ ] `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build` stay green; `npm run test` introduces no new failure; the Playwright suite passes.

## Task Overview
| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| 001 | Implement the design token layer, self-hosted fonts and the icon family | - | completed |
| 002 | Implement the shared board-geometry module | - | completed |
| 003 | Build the DartBoard SVG component | 001, 002 | completed |
| 004 | Build the app shell: navigation, skip link, reduced motion | 001 | completed |
| 006 | Rebuild the Game Center as a rule sheet; add the `BoardSourceSelector` component | 001, 004 | completed |
| 007 | Rebuild the shared game components on the token layer (owns the shared setup contract) | 001, 004, 006 | completed |
| 005 | Wire segment-aware throws and fix Double Out in the x01 match views | 002, 003, 007 | completed |
| 009 | Bring dashboard, lobby, career and the home route into the system | 001, 004 | completed |
| 008 | Migrate the cricket, around-the-clock and shanghai match views | 003, 007 | completed |
| 010 | Visual quality control at 1440 / 1024 / 390 | 005, 006, 008, 009 | completed |

**Why this order.** The dependency graph is not cosmetic — it is what stops two workers editing the same file. `src/components/game/types.ts` and `PlayerSetup.tsx` are owned by task 007 alone; task 006 contributes only the standalone `BoardSourceSelector` component; tasks 005 and 008 consume them. Task 005 depends on 007 because the segment-aware dart pad does not exist until 007 lands. Task 008 depends on 003 because it reuses `DartBoard` and the shared resolver. With at most two workers, the executable waves are: (001, 002) → (003, 004) → (006, 009) → 007 → (005, 008) → 010.

## Architecture Notes
- **Tokens live in `app/globals.css` as a Tailwind v4 `@theme` block.** Components reference `bg-surface`, `text-ink`, `rounded-sm` — never a palette utility. This is the `html-tailwind` stack guidance the design phase confirmed: *"Define semantic design tokens with CSS-first @theme … Don't: Repeat palette utilities in components."*
- **The token names are fixed by `MASTER.md`.** Use them verbatim: `--color-board`, `--color-surface`, `--color-raised`, `--color-sunken`, `--color-rule`, `--color-edge`, `--color-ink`, `--color-ink-muted`, `--color-ink-faint`, `--color-brass`, `--color-brass-deep`, `--color-treble`, `--color-double`; `--font-display`, `--font-sans`, `--font-mono` plus the **role** utilities `font-body`, `font-label`, `font-caption` (declared with `@utility`, because a role carries family **and** weight); the **type scale** `--text-display|title|heading|body|label|caption|score-xl|score-lg|score-md|score-sm`; `--space-xs|sm|md|lg|xl|2xl|3xl|4xl` (2/4/8/12/16/24/32/48px); `--radius-xs|sm|md|full` (2/3/4/9999px); `--duration-instant|fast|base` (80/120/200ms); `--ease-out`, `--ease-in`, `--ease-standard`; `--shadow-overlay`. **Maximum radius on a rectangular surface is 4px** — pills are banned, except genuine circles (the bull, the turn dot).
- **Tailwind v4 namespaces were measured, not assumed** (`reports/design/grounding/tw-verification.md`): `--space-*` is a real namespace but feeds **only** `space-x-*` / `space-y-*`; `--spacing-*` is what feeds `p-*`, `m-*`, `gap-*` and `size-*`; `--duration-*` generates nothing while `--transition-duration-*` generates `duration-*`; and **a bare `space-2xl` does not exist in Tailwind v4 and cannot be made to exist** — use `space-y-*` / `gap-*`. Task 001 therefore declares the `MASTER.md` names **and** the utility-generating names alongside them (`--spacing-*`, `--transition-duration-*`). Its acceptance criterion checks the emitted CSS for the specific utilities the components use — a build that compiles is not proof the classes exist.
- **The `next/font` variable class goes on `<html>`, not `<body>`** — the `@theme` tokens are `:root`-scoped, so on `<body>` they resolve against an undefined inherited value and the fonts silently fall back. The `next/font` variable names must also differ from the `@theme` token names, and the font block uses `@theme inline`.
- **The `--board-*` tokens are consumed by `var()` on SVG nodes**, not as utilities — `--board-red` is not a Tailwind namespace, so `fill-board-red` does not exist.
- **Fonts are self-hosted through `next/font/google`** (Barlow Condensed, Barlow, JetBrains Mono) — free, no runtime third-party request, no layout shift. Not a `<link>` to Google Fonts. The `next/font` variable names must **not** collide with the `@theme` font tokens: use `--font-barlow-condensed` / `--font-barlow` / `--font-jetbrains-mono` for `next/font`, and reference them from `@theme inline { --font-display: var(--font-barlow-condensed), … }`. Naming both `--font-display` is the collision `MASTER.md` §4.3 shows and it silently breaks the font stack.
- **`src/board/` is the shared board module** — pure TypeScript, no DOM, no React, no Node built-ins. It must import unchanged into the browser, the game server and the CV pipeline. Its API is specified in `board.md` §5.1: `BOARD_DIAMETER_MM`, `BOARD_RADII_MM`, `BOARD_SEGMENT_ORDER`, `BoardSegment`, `BoardHit`, `BoardResolution`, `resolveBoardHit(xMm, yMm)`, `toBoardMm(dxPx, dyPx, pxPerMm)`.
- **`ThrowSegment` keeps working.** The board module owns the definition; `src/game-engine/types.ts` re-exports it as `ThrowSegment` so no existing import breaks.
- **The board's SVG is authored in millimetres** — `viewBox="-225.5 -225.5 451 451"`, so one user unit is one millimetre and the picture cannot drift from the scoring radii.
- **`CameraDTO` gains an optional `segment`** so a future camera feed submits an identical `ThrowInput` and the checkout rule behaves the same in both paths.
- **The board component's props are a contract between tasks 003, 005 and 008.** It is a pure presentational component: it owns the geometry, the hit markers and the armed-segment state, and it reports a resolved throw upward. It must not import the game engine. Both `DartBoard` and the dart pad read **one** armed-segment state so the board's numeral route and the pad never disagree — that state lives in the match view, and the board takes it as a prop.
- **`ThrowSegment` keeps working.** The board module owns the definition; `src/game-engine/types.ts` re-exports it as `ThrowSegment` so no existing import breaks.

## Risks & Mitigations
- **The board's painted beds cannot meet a 44 px target** — the treble band is 8 mm of a 451 mm board. `board.md` §8.3.2 records this as a documented deviation from WCAG 2.2 SC 2.5.8 (AA, 24 × 24), with the justification that 2.5.8's spacing and essential exceptions both genuinely fail and that complete capability is duplicated by ≥44 px controls including a keyboard path. The implementation must honour the documented mitigation — the armed-band + numeral route and the redesigned dart pad — and must not claim 2.5.8 conformance for the beds. The previous round's 512 px derivation is explicitly withdrawn; the board renders at 600 / 520 / 300 px and below 768 px it is a read-only preview. **On the merits:** the deviation is sound and the mitigation is genuine — every dart the beds can score is also scoreable through the pad's armed-band route at ≥44 px, and the keyboard grid exposes all 62 outcomes directly. What would *not* be sound is shipping the beds without that duplication, which is why the mitigation is an acceptance criterion and not a citation.
- **A `var` closure bug and a 180° bearing error** both occurred in the design prototype's resolver. The implementation must not repeat them: the resolver's tests must assert the bearing (a click on T13 resolves to T13, not T10) and the dart-pad keys must not capture a stale loop variable.
- **The 360° ring paths degenerated** in the prototype (the outer bull and the armed-band outline did not render). The implementation must assert these render.
- **Token drift.** A component using a palette utility is invisible until review. The token test in task 001 should fail if a raw palette utility appears in a component file — scoped to an enumerated allow-list of files still pending migration, so it is neither a no-op nor a premature failure.
- **Tailwind v4 namespace gaps.** `--space-*` and `--duration-*` do not generate utilities; only the namespace names do. Task 001 declares both and verifies the emitted CSS names the specific utilities the components use.
- **Fonts must load at build time.** `next/font/google` downloads during the build; if the network is unavailable the build fails. Task 001 runs the build early rather than at the end of the plan.
- **The bust path is a thrown error, not a state.** The engine rejects a busting throw with `GameEngineStateError` and leaves the match state untouched. The score sheet's BUST chip and the visit counter are therefore UI-local. Task 005 states this explicitly, because a worker who assumes the engine reports busts in the returned state will build a score sheet that silently never shows a bust.
- **Pre-existing failures are not regressions.** `tests/integration/linkGuest.test.ts` fails because it needs PostgreSQL; it failed before this plan. The gate is "no new failures".

## Decisions on the plan review's open questions
The post-plan reviewer raised five questions. Each is decided here so the workers do not have to invent an answer.

- **Q1 — `Standard501Mode`'s mode id becomes `x01-501-double-out`** (from `describeOutRule`, `src/game-engine/modes/StandardMode.ts:59`). **Decision: proceed.** Verified that nothing in `src/`, `app/` or the tests matches on the mode id — the only reference is the doc comment at `src/game-engine/types.ts:104`. The id is externally visible (it appears in the mode's `id`), so it is recorded here as a known consequence rather than an accident.
- **Q2 — is `src/game-engine/modes/registry.ts` the right home for the Game Center's mode metadata?** **Decision: yes, follow the design document.** `design-system/darthub/pages/game-center.md` §2.3 requires that *"Every rule value on this page is read from the mode registry in `src/game-engine/modes/`, not typed as prose in the page file"*, and `DESIGN.md` §8.2 repeats it. The reason is precisely the defect this plan exists to fix: the current page hardcodes a rule the engine does not implement. Display strings stay out of the registry; the registry carries facts.
- **Q3 — `src/game-engine/README.md` will be stale after task 005.** It documents `outRule` as defaulting to `"straight"` (line 66). **Decision: update it in task 005.** The distinction to state is that `StandardMode`'s own default remains `"straight"`, while `Standard501Mode` and `Standard301Mode` default to `"double"`. It is a documentation change in an engine file, but leaving a stale rule description behind would defeat the plan's own no-drift goal. No engine *logic* changes.
- **Q4 — rewrite or replace `e2e/game-center.spec.ts`?** **Decision: rewrite, not replace.** The Game Center is a rule sheet now, so the assertions about gradient cards, `main a` count and the `text-3xl` heading must go — but the six styling regression tests added by the `game-center-styling-fix` plan are the guard against exactly the failure this plan starts from, and they must stay. The five-mode coverage stays. The suite is updated to the new hub's contract and keeps its styling assertions.
- **Q5 — the WCAG 2.2 SC 2.5.8 deviation.** **Decision: no change to the decision.** The reviewer assessed it on its merits and agreed: the treble band is 8 mm of a 451 mm board, so no renderable board satisfies a 24 px minimum; the spacing exception fails (1.2 mm wire channel) and the "essential" exception fails (the function is available through conformant targets). The risk lives in the implementation, not the decision — the armed-band route, the 62-cell keyboard grid and the pad's segment radio group are acceptance criteria, not citations.

## Commit Policy
The user requires explicit consent before any commit. This plan stops after task 010's verification and report; the orchestrator must not run the commit step and must report the working-tree state instead.

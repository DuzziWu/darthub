# Task 001: Analyse the existing platform and the darts competitor set

**Status**: completed
**Depends on**: none
**Retry count**: 0

## Description
Establish what the darts product category looks like and where DartHub currently sits, so the art direction is chosen against reality rather than taste. Read the existing UI in the repo, then analyse the competitor set and the conventions the category has settled on.

## Context
- Read these to see what exists today:
  - `app/game-center/page.tsx` — the hub: five cards that differ only by their gradient.
  - `app/game/page.tsx`, `app/game/301/page.tsx`, `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx` — the five match views.
  - `src/components/game/` — `ThrowInputPad`, `ScoreDisplay`, `GameResultBanner`, `PlayerSetup`, `types`.
  - `app/dashboard/page.tsx`, `app/lobby/page.tsx`, `app/career/page.tsx`, `app/page.tsx` — the rest of the surface (currently unstyled stubs).
- The competitor set to analyse: **Autodarts.io** (the dominant online darts platform — board camera plus manual scoring, leagues, brackets, live stats), **DartsCounter** (3D board, room codes, multiplayer), **DartConnect** and similar club-league managers (fixture lists, tables, averages), **SmartScore** / **Shotboard** (minimal board scoring utilities), and **PDC / broadcast graphics** (the visual language of televised darts).
- Note that web research tools are **not available in this session** — the analysis must be written from your own knowledge, and must say so plainly rather than implying it was researched live.

## Requirements (Test Descriptions)
- [x] `it documents what the current DartHub UI looks like and where it fails the binding quality rules`
- [x] `it analyses the darts competitor set and identifies the category conventions`
- [x] `it identifies at least three visual opportunities DartHub can own that the competitors do not`
- [x] `it states the current UI's concrete shortcomings against each binding quality rule`

## Acceptance Criteria
- `reports/design/01-platform-analysis.md` exists.
- It names specific competitors and what each is actually good at, not vague category statements.
- It is explicit about which findings come from reading this repo versus from prior knowledge.
- It identifies concrete visual ownership opportunities, not "we could look nicer".
- It maps the current UI against each of the binding quality rules (generic dashboard layouts, bento grids, interchangeable gradient cards, excessive rounding, emoji icons, invented data, decorative elements, hierarchy/typography, match-view operability) and says which ones it currently breaks.
- No source file is modified.

## Implementation Notes

**Deliverable:** `reports/design/01-platform-analysis.md`

**How it was produced.** Every repo finding comes from reading the source plus Playwright measurements against the running dev server. Every competitor finding is written from prior knowledge and the document says so explicitly in its evidence note — web research tools were not available in this session, and no live-verification claim is made anywhere.

**Measured, not asserted.** 19 concrete failures are recorded with numbers: pad keys at 43×36px, 4px key gaps, an 81×20px back button, `slate-500` on `slate-800` at 3.07:1, `slate-600` on `slate-800` at 1.93:1, `green-600` + white at 3.30:1, `focus:outline-none` measured as `outlineStyle: "none"`, zero `aria-label`/`sr-only` in the codebase, 15 emoji, and raw palette utilities still present in the live DOM.

**Two findings that go beyond a visual audit** and that the implementation plan must act on:
- The Game Center advertises "finish on a double" for 501 and 301, but `StandardMode` defaults to `outRule: "straight"` and no UI passes `outRule`. The copy contradicts the rules the code runs.
- The UI never sends `ThrowSegment`, so `DoubleOutRule.isCheckout` can never be satisfied and Double Out is not winnable through the current interface. This makes the throw input's design a functional requirement, not a cosmetic one.

**Structural constraint recorded for the implementer:** only 501 and 301 use `src/components/game/*`. Cricket, Around The Clock and Shanghai each have a private bespoke UI, so the design system has to specify the shared match shell and require those three to migrate.

**Opportunities identified (four):** the score sheet as the primary object; the board as a live interactive surface; darts colour used semantically rather than decoratively; and the leg set as the unit of competition.

**No source file was modified.**

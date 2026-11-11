# Task 003: Persist the design system and author DESIGN.md + MASTER.md

**Status**: completed
**Depends on**: 002
**Retry count**: 0

## Description
Persist the chosen design system through UI/UX Pro Max, extend it with the DartHub-specific token set, and author the two central design references an implementer can build from without asking questions.

## Context
### Persist
```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "<the chosen direction's intent>" --design-system --persist -p "DartHub" --output-dir "E:/coding/darthub"
```
This writes `design-system/darthub/MASTER.md`. Read the generated file before extending it — the tool's output is the base, not the finished system.

### Extend with the DartHub token set
The persisted `MASTER.md` gives a generic palette and type pairing. Your extension is the part that makes it DartHub's:

- **Semantic colour tokens** mapped to the chosen direction, in Tailwind v4 CSS-first `@theme` form (`--color-primary`, `--color-surface`, …) so components use `bg-primary` and never a raw palette utility. This is confirmed by the `html-tailwind` stack guidance: *"Define semantic design tokens with CSS-first @theme … Don't: Repeat palette utilities in components."*
- **Type roles**, not just families: display, score/numeric (tabular figures), UI body, label. State the weights, sizes, line-heights and tracking, and which role is used where.
- **Spacing scale** on a 4pt grid, with named roles (gap, padding, section rhythm) and the density the match views need.
- **Radius scale** — restrained, instrument-like. Explicitly note the maximum radius and where a larger one is permitted.
- **Elevation scale** — a small, consistent set; no arbitrary shadows.
- **Motion tokens** — durations and easings by distance, and the `prefers-reduced-motion` behaviour.
- **Icon family** — name it (Lucide is the natural choice: free, OSS, one 24px/2px-stroke grid, shadcn/ui's default), with the sizing tokens and the accessibility rule (decorative icons `aria-hidden`, icon-only controls need an accessible name).
- **Semantic game colour** — how treble/double/bull/bust/turn/checkout are expressed, and why those colours. These are functional, not decorative.

### `DESIGN.md` — the central reference
Must contain: art direction and the one-line identity; the direction comparison and the choice with its justification; the principles; colour, typography, spacing, radius, elevation, motion; **component specifications** for the surfaces DartHub actually has (Game Center hub, match view, score display, throw input, player setup, result banner, and the app shell); **interaction states** for each (default, hover, focus-visible, active, disabled, plus the game-specific ones — turn indicator, bust, checkout, leg set); the responsive behaviour per viewport; an explicit **do/don't list**; and the accessibility floor.

Write it so an implementer can build a new surface from it without guessing. Where the tool's generic output and your DartHub-specific decision differ, your decision wins and you say why.

### `design-system/darthub/pages/`
Per-page specifications where a page deviates from Master. Use the tool's `--page` mechanism or write the file directly.

## Requirements (Test Descriptions)
- [x] `it persists a design system through ui-ux-pro-max --design-system --persist`
- [x] `it produces design-system/darthub/MASTER.md`
- [x] `it defines the DartHub semantic colour tokens in Tailwind v4 @theme form`
- [x] `it defines the type roles with weights, sizes, line-heights and tracking`
- [x] `it defines the spacing, radius, elevation and motion scales`
- [x] `it names the icon family and its sizing tokens`
- [x] `it documents the semantic game colour for treble, double, bull, bust and checkout`
- [x] `it authors DESIGN.md with component specifications and interaction states`
- [x] `it specifies the responsive behaviour for 1440, 1024 and 390`
- [x] `it states the accessibility floor as measurable criteria`

## Acceptance Criteria
- `design-system/darthub/MASTER.md` and `DESIGN.md` both exist and are non-trivial.
- The persisted system is the tool's real output, extended — not replaced by something invented and attributed to the tool.
- The token set is complete enough to implement against: an implementer should not need to invent a colour, spacing step, radius or type size.
- Component specs cover every surface DartHub currently has.
- The do/don't list maps directly onto the binding quality rules.
- The accessibility floor is stated as checkable numbers (contrast ratios, target sizes, spacing, focus ring width), not adjectives.
- No source file outside `DESIGN.md`, `design-system/` and `reports/design/` is modified — this task produces documents, not code.

## Implementation Notes

**Deliverables:** `DESIGN.md`, `design-system/darthub/MASTER.md`, `design-system/darthub/pages/game-center.md`, `reports/design/03-visual-qc.md`

**Persisted with the real CLI** (exact command, recorded in `MASTER.md` and `DESIGN.md`):
```
python .claude/skills/ui-ux-pro-max/scripts/search.py "scoreboard live match data dense dark precise" --design-system --persist -p "DartHub" --output-dir "E:/coding/darthub" --density 8 --variance 3 --motion 2
```
A page override was persisted separately with `--page "game-center"`.

**The persisted base is preserved verbatim.** `MASTER.md` is structured as Part I (the tool's output, unmodified and attributed) → Part II (the DartHub decisions, with a table giving the reason for every override) → Part III (the DartHub tokens and component specs). Nothing from the tool output was silently discarded; where it conflicts, the conflict and its resolution are both recorded.

**Token set is complete — no value left to the implementer.** 13 colour tokens, 10 type roles with weights/sizes/line-heights/tracking, 8 spacing steps, 4 radii, 4 elevation levels, 4 motion durations, 5 icon sizes, 6 semantic game colours, 6 z-index levels.

**Every contrast pair was computed, not estimated.** Six text tokens × four surfaces plus three on-accent pairs plus four non-text pairs. Lowest text ratio 4.55:1, lowest non-text 3.16:1. Two traps were caught by measurement and are documented: brass-on-brass focus rings are 1.0:1 (so the ring is cream), and `board` on `brass-deep` is 3.58:1 (so the primary button's hover label is `ink`).

**The board's geometry is derived, not chosen.** 44px targets with 8px separation on a 20-sector ring force a 225px radius and a 512px board. The full radial band table is in `DESIGN.md` §8.3.1 so the implementer does not have to re-derive it.

**The design was validated, not just written.** A static prototype was built from the token spec and inspected in Chromium at 1440/1024/390. It failed in 9 ways; all 9 were defects in the specification and all were fixed in the spec. Final state: 0 undersized targets, 0 horizontal page scroll, 8px minimum sector gap, a visible 2px focus ring on every control type, a working skip link, and `prefers-reduced-motion` collapsing all transitions to 0.01ms. Full critique in `reports/design/03-visual-qc.md`.

**Five items are flagged in `DESIGN.md` §13 as needing implementation-phase confirmation** rather than being silently assumed: the out rule must be exposed at setup, `segment` must be sent on every throw, leg/set data is optional, `totalPoints` means different things per mode (so the score caption must be mode-aware), and the three non-x01 modes must migrate onto the shared shell.

**No source file was modified.** `DESIGN.md`, `design-system/` and `reports/design/` are the only things written.

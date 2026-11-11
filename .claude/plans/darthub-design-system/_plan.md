# Plan: DartHub Design System

## Created
2026-11-09

## Status
completed

## Objective
Establish a distinctive, permanent visual identity for DartHub as a darts gaming platform: research the category, compare at least three genuinely different design directions, choose one with justification, and produce `DESIGN.md` plus `design-system/darthub/MASTER.md` as the authoritative design references that all later UI work is built on.

## Related Issues
none

## Discovery Notes
- The repo had **no CSS pipeline at all** until 2026-11-09 (fixed by the `game-center-styling-fix` plan): Tailwind v4 + `@tailwindcss/postcss` are now installed, `postcss.config.mjs` and `app/globals.css` exist, and `app/layout.tsx` imports the stylesheet.
- The current UI is **technically styled but artistically default**: a slate/blue/purple Tailwind palette, five Game Center cards that differ only by their gradient, `rounded-xl` cards, and no design tokens. It is exactly the "generic AI dashboard" look the new rules forbid.
- The `ui-ux-pro-max` skill lives at `.claude/skills/ui-ux-pro-max/` and its CLI needs `python` (3.11.9 available; use `python`, not `python3`).
- Dataset gaps found during pre-research (the skill requires one narrower retry, then an explicit fallback statement):
  - `icons` domain returns **0 results** for darts/game queries even after retry → fall back to the skill's general guidance (single SVG family, consistent stroke).
  - `nextjs` stack returns 0 results for "design tokens"/"theming" but does match "server components" and "streaming".
  - `html-tailwind` stack matches "design tokens" → confirms Tailwind v4 CSS-first `@theme` with semantic tokens (`bg-primary`, not `bg-blue-500`).
- No shadcn/ui is installed and no icon library is installed. `lucide-react` is the natural icon family (free, OSS, one 24px/2px stroke grid, and shadcn/ui's default) and would satisfy the "no emoji icons / consistent icon family" rule.
- Fonts should be self-hosted via `next/font/google` rather than a runtime `<link>` to Google Fonts — free, no runtime third-party request, no layout shift.

## Scope

### In Scope
- Platform and competitor analysis of the darts product category.
- UI/UX Pro Max research for DartHub.
- Critical comparison of ≥3 genuinely different design directions, with at least one rejected for a concrete reason.
- One chosen, justified art direction.
- A persisted design system via UI/UX Pro Max `--design-system --persist`, extended with DartHub-specific tokens.
- `DESIGN.md` and `design-system/darthub/MASTER.md` as central references.
- Per-page design specifications.

### Out of Scope
- Any implementation of the design (that is the next plan).
- Game rules, scoring logic, domain or backend changes.
- Paid services or packages.

## Success Criteria
- [ ] `reports/design/01-platform-analysis.md` analyses the current platform and the darts competitor set.
- [ ] `reports/design/02-direction-decision.md` compares ≥3 distinct directions critically and records one justified choice.
- [ ] `design-system/darthub/MASTER.md` exists, was produced by UI/UX Pro Max `--persist`, and carries the DartHub token set.
- [ ] `DESIGN.md` exists and is a usable reference for an implementer.
- [ ] The chosen direction violates none of the binding quality rules.
- [ ] The UI/UX Pro Max skill was actually invoked and its real output used.

## Task Overview
| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| 001 | Analyse the existing platform and the darts competitor set | - | completed |
| 002 | Research via UI/UX Pro Max, compare ≥3 design directions, decide | 001 | completed |
| 003 | Persist the design system and author DESIGN.md + MASTER.md | 002 | completed |
| 004 | Specify the realistic dartboard, segment-aware input, and the three board source modes | 003 | completed |

## Architecture Notes
- The design worker runs as the `design-worker` subagent (`.claude/agents/design-worker.md`), enrolled at the `pre-implementation` hook. It has the `Skill` tool and is required to actually call `ui-ux-pro-max`.
- `design-qc` (`.claude/agents/design-qc.md`) is enrolled at `post-implementation` and performs the mandatory 1440/1024/390 visual quality control in the implementation plan.

## Risks & Mitigations
- **The tool defaults to a generic result.** The `--design-system` query for any dark/gaming phrase resolves to "HUD / Sci-Fi FUI" with a neon palette and an accessibility risk of *high*. Every direction must be judged against the quality rules, not accepted on the tool's recommendation.
- **The dataset has no darts-specific palette.** The palette must be derived from darts semantics (treble green, double red, brass/bull accent on board black) and justified — not copied from a generic "Gaming" profile, which is neon purple and rose.
- **The design worker could write documents without grounding.** Its brief requires the real CLI output, the real `--persist` artefacts, and an explicit statement wherever a dataset match was not found.
- **A build that passes is not a design acceptance.** The `design-qc` agent exists solely to catch that, and it runs before the implementation plan's work is accepted.

## Commit Policy
The user requires explicit consent before any commit. This plan stops after task 003's artefacts; the orchestrator must not run the commit step and must report the working-tree state instead.

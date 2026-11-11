# Task 002: Research via UI/UX Pro Max, compare ≥3 design directions, decide

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Run the mandated UI/UX Pro Max research, generate at least three genuinely different candidate design directions, compare them critically against each other and against the binding quality rules, reject at least one for a concrete reason, and choose one with a defensible justification.

## Context
### The tool, used properly
```bash
# On Windows use `python`, not `python3`.
python .claude/skills/ui-ux-pro-max/scripts/search.py "<intent>" --design-system -f markdown -p "DartHub"
python .claude/skills/ui-ux-pro-max/scripts/search.py "<intent>" --domain color
python .claude/skills/ui-ux-pro-max/scripts/search.py "<intent>" --domain typography
python .claude/skills/ui-ux-pro-max/scripts/search.py "<intent>" --domain style
python .claude/skills/ui-ux-pro-max/scripts/search.py "<intent>" --domain ux
python .claude/skills/ui-ux-pro-max/scripts/search.py "<intent>" --stack nextjs
```
Use `--design-system` for system-wide direction, `--domain` for one focused concern, `--stack` for implementation guidance. Keep each query to one dominant intent.

### Known traps in the dataset
- Any dark/gaming-ish phrase resolves to **"HUD / Sci-Fi FUI"** — neon, glow, `Exo` + `Roboto Mono`, with an **accessibility risk of *high***. That style is a real option to evaluate, but it must be evaluated, not accepted by default.
- The `--domain color` "Gaming" profile is **neon purple + rose action**. That is the generic-gaming look the binding rules forbid. DartHub's palette should come from darts semantics instead (the board's treble green, double red, bull/brass, board black, bull cream) — and that decision must be justified.
- The `icons` domain returns **0 results** for darts/game queries even after a narrower retry. State that explicitly and fall back to the skill's general guidance: one SVG icon family, consistent stroke width, sized by token.
- The `nextjs` stack returns 0 results for "design tokens"/"theming" but matches "server components" and "streaming". The `html-tailwind` stack matches "design tokens" and confirms Tailwind v4 CSS-first `@theme` semantic tokens (`bg-primary`, never `bg-blue-500` in components).
- Type candidates found in the dataset: `Barlow Condensed` + `Barlow` (Sports/Fitness), `Bebas Neue` + `Source Sans 3` (Bold Statement, sports), `Russo One` + `Chakra Petch` (Gaming Bold), `Space Grotesk` (Kinetic Brutalism, "sports platforms"), `Inter` + `Playfair Display` + `JetBrains Mono` (Inter Poster, with "JetBrains Mono for labels and stats"). The direction must pick deliberately and justify it.

### What the three directions must be
Three directions that differ in **art direction**, not in colour swap. Each needs: what it looks like, what it feels like to play, where it breaks. At least one rejected for a concrete, stated reason.

Strong candidate axes to consider (not prescriptive — you may argue differently, but you must compare at least three and justify):
- **Broadcast/athletic** — the televised-darts language: condensed display type, high-contrast score surfaces, team/sport colour, data-forward.
- **Precision instrument** — the dartboard as the source of truth: board black surfaces, treble-green and double-red as *semantic* colour, brass/bull accent, tabular score numerals, restrained geometry.
- **Venue under stage light** — the dark room with the lit board: deep warm-neutral surface, a pool of light at the top of the viewport, one hot accent.

Reject at least one on the evidence. If you reject the sci-fi/HUD direction, say so on the grounds the dataset itself gives you (accessibility risk *high*, decorative glow without function), not on taste.

## Requirements (Test Descriptions)
- [x] `it runs the ui-ux-pro-max design-system search for at least three distinct directions`
- [x] `it runs focused ui-ux-pro-max domain and stack searches`
- [x] `it compares at least three genuinely different design directions`
- [x] `it rejects at least one direction for a stated, concrete reason`
- [x] `it selects one direction and justifies it against the alternatives and the binding quality rules`
- [x] `it states explicitly where the ui-ux-pro-max dataset returned no match and what was used instead`

## Acceptance Criteria
- `reports/design/02-direction-decision.md` exists.
- The CLI was actually executed — quote real output (style names, palette hexes, font pairings) rather than paraphrasing from memory.
- Every direction is described concretely enough that an implementer could build it.
- The chosen direction is written so it could be checked against the quality rules.
- The dataset-gap statements are explicit and honest.
- No source file is modified.

## Implementation Notes

**Deliverable:** `reports/design/02-direction-decision.md`

**Research actually run.** The document quotes **verbatim CLI output**, not paraphrase. Five `--design-system` searches were run (broadcast/athletic, precision instrument, venue-under-stage-light, plus two probes that produced the persisted system and its page override), plus `--domain color`, `typography`, `style`, `ux`, `icons`, `product`, `google-fonts`, and `--stack nextjs`, `html-tailwind`, `shadcn`.

**Dataset gaps stated explicitly** in a dedicated table: `--domain icons` returned **0 results** for darts/game queries (a broader retry did match and its guidance was adopted); `--stack nextjs` returned 0 for design tokens (the `html-tailwind` "Semantic colors … CSS-first @theme" rule was used instead); no darts-specific style or product type exists; and **web research tools were unavailable**, so the competitor analysis is written from prior knowledge and says so.

**Three directions compared, two rejected with evidence, not taste:**
- **Broadcast** — rejected because the tool's own pattern for it is a landing page ("Hero-Centric Design", sticky nav CTA), because its light `#FEF2F2` ground is wrong for a club room, and above all because spending **red on branding destroys the one colour the category has spare** for semantic meaning.
- **HUD / Sci-Fi FUI** — rejected on the dataset's own **accessibility risk: high** rating and its own key-effects list ("Glow effects … blinking markers"), which the binding rules ban by name. Its dense-monospaced idea was salvaged.
- **The board, after dark** — chosen.

**The risk in the chosen direction is named, not glossed.** The tool's Swiss-style output carries a "Hero + Features + CTA" page pattern and a "Financial Dashboard" category — both the generic AI-dashboard look the rules forbid. The resolution is stated: the *style* discipline is kept (grid, hairlines, no shadows, tight radius) and the *page pattern is replaced wholesale* with a rule sheet and a ruled score sheet.

**Decisions the implementer must not lose:**
- One accent (brass), two semantic colours (treble green = a visit that counted, double red = a bust), and **no per-mode colour at all** — the modes differ by their rules.
- The throw input must be **segment-explicit**. `ThrowSegment` already exists and is validated; without it Double Out is unwinnable and the semantic colour has no data source.
- The palette is built from **dartboard semantics**, not from the dataset (which has no darts palette). Every pair was contrast-verified numerically.

**No source file was modified.**

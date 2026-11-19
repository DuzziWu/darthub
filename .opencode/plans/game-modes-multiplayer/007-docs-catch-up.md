# 007 — M7: The design spec and the docs catch up with the shipped modes

**Owning agent:** `architect`
**Plan:** `docs/superpowers/plans/2026-11-12-game-modes.md` → Task M7
**Binding rulings:** B10, C3, C5, C6, C4
**Pre-flight:** `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`

## Scope

Bring the documentation back in line with the shipped behaviour.

**In scope**

- `design-system/darthub/pages/match.md` — the undo paragraph, the bust rule and the
  visit-strip paragraph.
- `.devflow/memory/CURRENT_STATE.md` — the "Working functionality" section and the
  "Measured quality baseline" table.

**Out of scope / blocked / not touched**

- **`docs/ROADMAP.md` is BLOCKED.** It is owned by a **parallel task** (the
  opencode-team-integration work) that is editing it right now in another worktree. M7 does
  **not** schedule an edit of that file as if it were free. When that task has settled, the
  update is: the milestone list at `docs/ROADMAP.md:45-48` and the delivery-status table at
  `:32-41` — add what this plan closed (the five local modes seat two players; x01 offers
  best-of-N legs) and leave the realtime row alone. Note that the 2026-11-12 draft cited
  "milestone M1's status line (line 115)" — **that line does not exist**: today's
  `docs/ROADMAP.md` is 64 lines long.
- **`docs/DECISIONS.md` is NOT touched.** Checked explicitly: this plan does not change a
  recorded decision, so the decision log stays as it is. (Do not add a row for it either — the
  engine's result seam is an implementation detail of an existing decision, not a new
  architectural decision.)
- **`src/game-engine/README.md` is NOT touched here.** Its `MatchState` code block
  (`src/game-engine/README.md:195-207`) changes with M5, and ruling **B10** assigns that
  update to **M5** (see `005-tie-and-tie-break.md`). M7 must not duplicate it.

## Ownership note

The team ownership table assigns `docs/` and `.opencode/plans/` to the `architect`, and
`src/components/` + `app/` to the `frontend`. Neither covers `design-system/` or `.devflow/`.
**This package assigns both trees to the `architect`** — they are documentation trees, the
work is prose-only, and no code is touched. The `frontend` agent has no business editing the
design system, and the `qa-engineer` agent owns only the test harness files.

## Files

**Owned by `architect` (this package edits these):**

| File                                   | What changes                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design-system/darthub/pages/match.md` | §3 (`:82-84`): the "Undo is out of scope" paragraph becomes the shipped behaviour. §6 rule 3 (`:151-156`): the bust rule becomes "a bust is entered in the ledger and counted for nothing". The paragraph below the rules (`:162-164`): the visit strip is assembled from the ledger alone. |
| `.devflow/memory/CURRENT_STATE.md`     | "Working functionality" (from `:9`): all five modes seat two players; x01 offers best-of-N legs. The "Measured quality baseline" table: the new test count.                                                                                                                                 |

**No other file may be touched by this package.**

## Binding rulings

- **B10 — the engine README's `MatchState` block is M5's job.** The 2026-11-12 draft left
  `src/game-engine/README.md:195-203` out of M7's scope even though M5 changes the shape it
  documents. M7 must **not** duplicate M5's update. _(The 2026-11-12 line range is stale; the
  block is at `:195-207` in this tree.)_
- **C3 — one record of the darts.** The match.md text must describe the ledger as the single
  source, not "two sources".
- **C5 — the engine stays framework-agnostic.** The match.md text must not describe a UI-local
  copy of a dart.
- **C6 — one `primary` per surface.** The match.md text keeps the "UNDO button in the Actions
  slot is a live `secondary` control" wording — the undo is **not** a second `primary`.
- **C4 — no commit.** The package ends with a verification command and a report, not a commit.

## Acceptance Criteria

1. `design-system/darthub/pages/match.md:82-84` no longer says the undo is out of scope; it
   describes the shipped ledger-backed undo.
2. `design-system/darthub/pages/match.md:151-156` rule 3 says the bust is entered in the ledger
   with `bust: true`, is rejected with a `GameEngineBustError`, counts for nothing, and that the
   BUST chip is read from the ledger — never from the error message and never from UI-local
   state.
3. `design-system/darthub/pages/match.md:162-164` says the visit strip is assembled from the
   ledger alone.
4. `design-system/darthub/pages/match.md` keeps the "one `secondary` undo, not a `primary`"
   wording.
5. `.devflow/memory/CURRENT_STATE.md` — the "Working functionality" section says that all five
   modes seat two players and that x01 offers best-of-N legs.
6. `.devflow/memory/CURRENT_STATE.md` — the "Measured quality baseline" table carries the test
   count **measured in this tree** (not a remembered one).
7. `docs/ROADMAP.md` is **not** modified by this package.
8. `docs/DECISIONS.md` is **not** modified by this package.
9. `src/game-engine/README.md` is **not** modified by this package.
10. The suite stays green — no code changed.

## Verification command

```bash
npx vitest run && npm run typecheck && npm run lint && npm run format:check
```

The build is **not** part of the gate here: `npm run build` was **nicht lokal verifiziert** in
the re-anchoring session, so this package does not claim a green build either. If the
implementer has the budget, run it and record the output in the `## Result` section — but do
not claim a build that was not run.

## Result

<!-- Filled in when the package is executed. -->

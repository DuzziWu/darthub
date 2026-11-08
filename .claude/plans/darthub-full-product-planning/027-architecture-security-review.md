# Task 027: Conduct architecture and security review (devils‑advocate, standards‑enforcer)

**Status**: completed (review delivered; orchestrator decides final plan status)
**Depends on**: 026
**Retry count**: 0

## Description
Run the built‑in HCF agents `devils-advocate` and `standards-enforcer` on the changed files to verify architectural consistency, coding standards, and security best practices.

## Context
- Agents are enrolled via `.claude/agents/` frontmatter (post‑plan hook is empty, so manual trigger).
- Review should produce a findings report.

## Requirements (Test Descriptions)
- [x] `it runs devils‑advocate and standards‑enforcer on all source files and produces no critical violations` (stable sources: scaffold t001, docs t026, game-engine t035, camera contracts t012, plus best-available review of ai/career/prisma with in-flight caveat; 0 CRITICAL findings, 3 HIGH design-level findings — A-1 per-mode rating schema drift, S-1 guest-migration design wording — assigned as pre-completion constraints to tasks 005 / 004; in-flight code (realtime, auth, privacy, 501/Cricket modes, smartphone stub) deferred to the end-of-run review)
- [ ] `it runs standards‑enforcer and ensures linting passes` — NOT satisfied at review time and intentionally not fixed (review-only): `npm run lint` exit 1 with 5 errors, ALL inside in-flight tasks (src/ai/engine.ts t007: import order + unused `request`; tests/unit/precommit/precommit.test.ts t032: import order + unused `existsSync`). PENDING, not a blocker; stable/scaffold areas lint-clean. Also recorded: `format:check` red on 8 task-026 docs files (V-2), `tsc --noEmit` red on task-026's own `docs.test.ts` (V-3) and in-flight `src/ai` (V-4), nondeterminism + scratch-dir race defects in tooling (V-5, V-6). Full details in the report's Standards Findings section.
- [x] `it documents any recommended refactorings` (10 recommendations R-1..R-10 in `reports/architecture-review.md`, incl. extracting board geometry out of `src/ai/dartboard.ts` into a shared domain module, snapshot-copying the quest registry, fixing `Math.random()` match IDs, removing dead code)
- [x] `it updates the plan status to ready if no blockers` (orchestrator manages plan status; this review carries no blocking findings: no CRITICAL findings, and no HIGH findings that block current in-flight work — the HIGH items are design-level reconciliations that must be resolved before tasks 005 and 004 complete, see report Verdict)

## Acceptance Criteria
- Review report is generated and stored in `reports/architecture-review.md`. ✅ (written 2026-11-07; includes Scope section listing stable vs in-flight areas, Architecture / Security / Standards Findings with severity + file references, and Recommended Refactorings)
- No high‑severity security findings remain. ⚠️ Partially: no high-severity findings in shipped code; 1 HIGH security finding is design-doc-level (`docs/API.md` `/api/users/migrate` wording "new or existing account" — account-takeover primitive) and must be pinned before task 004 starts.

## Verification Evidence
- Report: `E:\coding\darthub\reports\architecture-review.md`
- `npm run lint` → exit 1, 5 errors (all in-flight t007/t032 files)
- `npm run format:check` → exit 1, 19 files (8 are t026 docs)
- `npx tsc --noEmit --incremental false` → 47 errors (src/ai x4, docs.test.ts x31, rest in-flight); `npm run typecheck` (incremental) observed nondeterministic (stale tsbuildinfo TS6053)
- Scoped suite (stable+best-available areas): game-engine 3/3, camera-contracts 4/4, ai engine, career questSchema/questLoader, db-schema, docs, docker, ci-workflow all pass
- Review performed read-only (no source edits); both reviewer roles (devils-advocate, standards-enforcer) executed inline because subagent spawning is unavailable in this environment — adaptation noted in report Scope

---
name: darthub-code-review
description: This skill should be used when the user asks to "review this code", "review the PR", "review my changes", "check this diff" or otherwise asks for a code review of DartHub work. Reviews against DartHub's own architectural invariants — the engine's ledger-and-replay model, server authority, the feature-slice layering and the token-only styling vocabulary — and reports findings by severity with file and line.
triggers:
  - code review
  - review this
  - review the pr
  - review my changes
  - check this diff
  - review changes
---

# DartHub Code Review

Review DartHub changes against the project's own invariants, not against
generic code-quality preferences.

## Review order

Check in this order and stop reporting a lower-severity finding only if a
higher one already explains it:

1. **Engine correctness** (A1–A5) — a broken invariant corrupts game state.
2. **Server authority** (A6) — a client-side mutation breaks multiplayer.
3. **Layering** (A7–A8) — a wrong dependency direction spreads.
4. **Tokens and shared components** (A9–A10) — drift breaks the design system.
5. **Test quality** — a change without a test will regress silently.
6. **Style** — skip it. The pre-commit hook already runs ESLint and Prettier,
   so style issues cannot reach a review.

## Engine traps (A1–A5)

| Trap                                    | How it shows up                                                            | Why it matters                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **State mutated instead of re-derived** | a field assigned directly on the match state; a score incremented in place | undo and correction replay the ledger; a mutated field is lost or double-counted |
| **A rule duplicated outside the mode**  | rule text or a target list hard-coded in `registry.ts` or a component      | the rule sheet can then describe a rule the engine does not implement            |
| **A local segment type**                | a new `type Segment = ...` instead of importing `BoardSegment`             | board geometry and engine can disagree about the segment vocabulary              |
| **A framework import in the engine**    | `react`, `next`, `socket.io` or `node:*` imported under `src/game-engine/` | the engine must run unchanged on server and in browser                           |
| **Stored visit boundaries**             | a visit index written into the match state                                 | a correction changes the boundaries, so a stored one goes stale                  |

## Server-authority traps (A6)

- A socket handler that mutates the room state directly instead of going
  through `GameStateMachine`.
- A client-supplied value (score, player id, segment) reaching the engine
  without passing through `src/realtime/antiCheat.ts`.
- A non-JSON-safe value in a snapshot handed to clients.

## Layering traps (A7–A8)

- Business logic inside `app/api/**/route.ts` rather than behind
  `createXRouteHandlers`.
- A service importing `@prisma/client` directly instead of its
  `repository.ts` interface.
- A feature reaching into another feature's `prisma<Feature>Repository.ts`.
- `requireAuth` throwing instead of returning its `{ ok }` discriminant.

## UI traps (A9–A10)

- A raw palette utility (`bg-gray-800`, `text-white`, `text-yellow-500`)
  instead of a token (`bg-surface`, `text-ink`, `text-brass`).
  `tests/unit/tailwind/noLegacyUtilities.test.ts` catches these.
- A focus ring or target size re-declared inline instead of importing
  `FOCUS_RING` / `TARGET_SIZE` from `src/components/game/classes.ts`.
- A shared component changed without checking all five game-mode views.
- A new token used in a component but not declared in `@theme` in
  `app/globals.css` and not listed in `design-system/darthub/MASTER.md`.

## Test-quality traps

- A `MutableMatchState` fixture missing `throws` or `corrections` — the exact
  shape that broke `gameCenterPage.test.tsx` and `modeRegistry.test.ts`.
- A new game-engine rule without a correction-replay case.
- A test that asserts on implementation detail rather than on behaviour.
- A test that needs a real database where an in-memory double would do —
  `tests/support/inMemoryAuthRepository.ts` exists for this.

## Triage pre-existing failures

The baseline is **green** — 0 typecheck errors, 96/96 Vitest files and 447/447
tests passing, lint and format clean (full table in
`references/test-matrix.md`):

- `dockerignore.test.ts` skips its live build when no Docker **daemon** is
  reachable.
- `tailwindToolchain.test.ts` skips when no successful `npm run build` output
  is present.

Report only the **delta** against that baseline.

## Output format

For each finding:

```text
[Severity] file/path.ts:line — one-line statement of the defect
  Invariant: A2 (state is derived from a ledger)
  Why it matters: <the concrete consequence>
  Fix: <the specific change>
```

Severities: **critical** (corrupts state, breaks authority, loses data),
**major** (violates a layering or invariant rule with a real consequence),
**minor** (a real but low-impact deviation). No style nits — state plainly
that style is handled by the pre-commit hook.

Close with a verdict: the change is ready, ready after the listed fixes, or
blocked by a critical finding.

## Additional Resources

### Reference Files

- **`references/review-checklist.md`** — the full invariant list with
  file/line pointers, and the known-failure triage table.
- **`references/test-matrix.md`** — the test-file inventory, its required
  environment, and the known baseline results.

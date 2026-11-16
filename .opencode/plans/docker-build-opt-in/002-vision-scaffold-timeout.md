# 002 — The scoped compiler run gets the budget the repository already gives compiler runs

**Owning agent:** `game-engine`
**Plan:** `.opencode/plans/docker-build-opt-in/_plan.md` → task 002
**Status at hand-off:** `in_progress`
**Touches:** one test file.

---

## Scope

`tests/unit/camera/vision/visionScaffold.test.ts` runs a scoped `npx tsc` over the camera vision
outline and the `*.check.ts` contract probes of that directory. The compiler needs **~18 s** on an
idle machine and considerably more when the suite shares two CPUs with other worktrees — and the
run had only the global budget, which the M2 rework moved from 30 000 to 120 000 ms.

The repository already solves this problem for every other compiler run: `tests/unit/typescript.test.ts:5`
declares `{ timeout: 180_000 }`. This package gives the camera vision scaffold the same budget.

**In scope**

- `tests/unit/camera/vision/visionScaffold.test.ts`: the `it(...)` block that runs the scoped
  `tsc` gets its own `{ timeout: 180_000 }`.

**Out of scope**

- The compiler configuration, the `*.check.ts` probes, the camera vision outline itself, and every
  assertion in the file. **No assertion changes.**
- `vitest.config.ts` — package 001 owns it.
- The docker work — package 001 owns it.

---

## Files

| File                                              | What changes                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/camera/vision/visionScaffold.test.ts` | `{ timeout: 180_000 }` on the `it("includes type tests that the interfaces compile", …)` block, with a comment that names the reason. |

**No other file may be touched by this package.**

---

## Acceptance criteria

1. The `it("includes type tests that the interfaces compile", …)` block carries
   `{ timeout: 180_000 }` — the same budget `tests/unit/typescript.test.ts:5` already declares.
2. **No assertion in the file changes.** The block still compiles `src/camera` (including the
   vision outline) together with the `*.check.ts` contract probes and still asserts the same
   outcome.
3. The comment in the file explains why the budget exists: the scoped `tsc` needs ~18 s on an idle
   machine, so the default budget left almost no room on a machine that runs more than one suite at
   a time.
4. `npx vitest run tests/unit/camera/vision/visionScaffold.test.ts` is green.
5. `npm run typecheck`, `npm run lint` and `npm run format:check` are green.

---

## Verification command

```bash
npx vitest run tests/unit/camera/vision/visionScaffold.test.ts && npm run typecheck && npm run lint && npm run format:check
```

---

## Result

<!-- pending: filled in by the orchestrator after verification -->

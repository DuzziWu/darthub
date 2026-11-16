# 003 — Independent review of packages 001 and 002

**Owning agent:** `code-reviewer` (independent, strictly read-only)
**Disposition owner:** `qa-engineer` (package 001), `game-engine` (package 002)
**Plan:** `.opencode/plans/docker-build-opt-in/_plan.md` → task 003
**Status at hand-off:** `pending`
**Depends on:** 001, 002

---

## Scope

Review the two packages of this plan independently, before they are closed. The reviewer does not
change the code it reviews; it reports findings and the owning agent disposes of each one.

**In scope**

- The correctness of the opt-in gate: does the default run really start no build, and does the
  opt-in run really build?
- The honesty of the skip: is the reason visible to a reader who did not set the flag?
- The orphan fix: is the child really dead when the runner settles, on every path — success,
  failure, timeout, exception?
- The hygiene rework: are the **created** images removed and the **cached** ones kept? Can the
  cleanup of one run remove something another run needs?
- The retry on a broken cache chain: is it bounded, and does it not loop?
- The assertion that the structural `.dockerignore` checks still run in the default suite, with the
  same assertions.
- The change of the global `testTimeout` (30 s → 120 s): does it mask a hanging test, and is it
  covered by a measurement?
- The claim in the plan that `tests/unit/ci-workflow.test.ts` does not replay the CI docker step,
  and the fragility of that coupling.
- The honesty of the plan's own statements about the coverage of the 200 MB limit.

**Out of scope**

- The implementation of a fix. The reviewer reports; the owning agent fixes.
- The docker work of the M2 task beyond what packages 001 and 002 changed.
- Any file outside the packages' file lists.

---

## Files

| File                                                                      | What changes                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `.opencode/plans/docker-build-opt-in/003-independent-review.md` **(new)** | This file: the findings, their severity, and the disposition of each one. |

Read-only on every file of packages 001 and 002:

- `tests/support/docker-build.ts`
- `tests/unit/dockerignore.test.ts`
- `tests/unit/dockerignoreBuild.test.ts`
- `vitest.config.ts`
- `tests/unit/camera/vision/visionScaffold.test.ts`

---

## Acceptance criteria

1. Every finding names the file and the line, a severity, and what an implementer must change.
2. The reviewer states explicitly whether the default run starts a `docker build`, and how it
   established that — by reading the implementation **and** by running the gate test.
3. The reviewer states whether the child can survive the runner on any path, and if so, which.
4. The reviewer states whether the cleanup can remove an image that a concurrent build needs.
5. The reviewer states whether the structural assertions are unchanged, diffed against the
   pre-change file.
6. The reviewer states whether the 200 MB limit is still enforced, and where.
7. The reviewer states whether the plan's own claims match the implementation — including the
   exported names of `tests/support/docker-build.ts`. **A mismatch with the _API contract_ section
   of `_plan.md` is reported here**, so the plan can be corrected.
8. Every finding gets a disposition from the owning agent: fixed, accepted with a reason, or
   deferred with an owner.

---

## Verification command

```bash
npx vitest run tests/unit/dockerignoreBuild.test.ts && npx vitest run tests/unit/camera/vision/visionScaffold.test.ts && npm run typecheck && npm run lint
```

---

## Result

<!-- pending: filled in by the orchestrator after verification -->

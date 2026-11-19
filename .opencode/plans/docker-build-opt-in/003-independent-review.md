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

The `code-reviewer` (read-only) reviewed the whole diff against the base and returned
**approve with comments**: **no CRITICAL, no HIGH**, 6 MEDIUM and 8 LOW findings.

### What the reviewer verified as correct

1. The gate is real — `runDockerBuild` checks the flag **before** spawning, and it is the only
   place in the repository that starts a build.
2. The skip is visible — the reason is printed to stdout and carried in the test title.
3. The guard suite is not vacuous — it would fail if the live build were re-enabled in the default
   run (the shim log would be non-empty **and** the child run would exit non-zero).
4. The shim is a faithful double — `execSync` and `spawn` both resolve `docker` through `PATH`, and
   no code path uses an absolute docker path.
5. The child cannot outlive the runner on any path the code controls; the escalation test measured
   exit code 137 and proved the pid is gone.
6. `detached: false` is the correct decision, and the reasoning in the comment is right.
7. Nothing was weakened — the structural assertions were moved verbatim, the 200 MB ceiling is
   asserted unchanged, the retry is bounded to one attempt.
8. `docker image ls -q` really is the tagged set on this host (3 ids vs. 22 with `-a`).
9. The CI gate is in place and the local replay cannot start a build.
10. The static gates are green.

### The findings and their disposition

| #   | Severity | Finding                                                                                                                                              | Disposition                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | MEDIUM   | The CI guard does not see `env:` blocks — a job-level `env:` would put the build back into every plain suite run and the guard would stay green.     | **Fixed.** The workflow type models `env` on jobs and steps; the guard checks the run string, the step env and the job env, and finds the docker step whether the flag is inline or in an `env:` block.                                                                                                                                                               |
| 2   | MEDIUM   | The broken-cache-chain path removes the shared cached images, contradicting the module's own invariant.                                              | **Fixed by making the exception explicit** (the Tech Lead asked for M2's rework verbatim, and a chain whose parent snapshot is gone is useless to everyone). The exception is stated in the module comment and at the retry branch, the removal list is the exported helper `brokenChainImageIds`, and a unit test pins it.                                           |
| 3   | MEDIUM   | The cleanup is a silent no-op under BuildKit — the parsers read the legacy builder's format, and CI builds with BuildKit.                            | **Fixed.** `isBuildKitBuildOutput` recognises the BuildKit output; the cleanup logs one line that the legacy cleanup does not apply to a BuildKit build (it leaves no intermediate images behind) and does **not** fail. The CI stays green.                                                                                                                          |
| 4   | MEDIUM   | The daemon probe and the housekeeping commands run through `execSync` without a timeout — a hanging daemon would block the worker past every budget. | **Fixed.** `runCommand` gained an optional, backwards-compatible timeout; the docker CLI calls use 30 s. The compiler runs keep their unbounded budget. A timeout is reported as a failure with the partial output.                                                                                                                                                   |
| 5   | MEDIUM   | Nothing asserted that the replay filter excludes the docker step.                                                                                    | **Fixed.** The filter is the named `replayedWorkflowSteps(workflow)`, and a guard test asserts that the docker step is not in its result.                                                                                                                                                                                                                             |
| 6   | MEDIUM   | The global `testTimeout` of 120 s quadruples the time-to-fail of a hanging test.                                                                     | **Accepted with a reason.** A false red blocks a runner slot exactly like a slow suite does; the measured contention case is 36.9 s and the host runs up to five suites at a time. The measured suite duration is 351 s, far below the 30-minute runner limit. The budget belongs on the tests that need it — that is what package 002 does for the one compiler run. |
| 7   | LOW      | The guard's failure message is misleading for the `env:`-block case.                                                                                 | **Fixed.** The message names both ways of setting the flag.                                                                                                                                                                                                                                                                                                           |
| 8   | LOW      | The nested child run's `spawnSync` used the default 1 MB `maxBuffer`.                                                                                | **Fixed.** 32 MB.                                                                                                                                                                                                                                                                                                                                                     |

### One finding the review could not make

The reviewer noted the caveat that the "no orphan" property ultimately depends on the harness
killing by process group; if only the vitest **main** process is killed, the fork worker (and the
build) survive. That is true and it is the reason the runner has a hard deadline of 20 minutes per
attempt: the build cannot outlive the test by more than that, and the process-level guard covers
`exit`, `SIGINT` and `SIGTERM` inside the worker.

### A defect the review could not see — found by the orchestrator with a real build

The review worked on the code; the leak needed a real daemon. The first live run against the real
daemon showed that **removing a child image makes the daemon re-commit its parent under a new id**,
and that new id is not in the build output — so a single removal pass left five images of ~1.3 GB
behind, holding the layer of the `npm ci` stage. That is the disk leak this package exists to
close. The cleanup now runs in passes (see package 001's `## Result`), and the daemon state before
and after a live run is identical: **0 dangling images before, 0 after**.

The plan's risk 7 was corrected as well: an `env:` block on the CI step would _not_ start a build
(the replay inherits the ambient environment, which does not carry the flag); the real hazard is
the filter's exclusion clause — which is now guarded by a test.

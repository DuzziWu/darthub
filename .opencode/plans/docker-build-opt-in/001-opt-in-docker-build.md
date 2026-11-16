# 001 — The live docker build becomes opt-in and killable

**Owning agent:** `qa-engineer`
**Plan:** `.opencode/plans/docker-build-opt-in/_plan.md` → task 001
**Status at hand-off:** `in_progress`
**Touches:** test infrastructure only — no production code.

---

## Scope

Move the real `docker build` out of the default unit-suite run, and make the run that does build
leave nothing behind.

**In scope**

- A new shared support module `tests/support/docker-build.ts` that is the **only** place in the
  repository that talks to the Docker daemon. It owns the opt-in flag, the killable child process,
  the deadline, the image/container hygiene and the size measurement.
- `tests/unit/dockerignore.test.ts`:
  - the structural `.dockerignore` assertions stay in the default run, **unchanged**;
  - the live build + size check is gated behind `DART_DOCKER_BUILD=1`;
  - without the flag the live block is **skipped with a visible reason** — the test title names the
    flag and a console line repeats the reason. Never silently.
  - the build runs through the new module, not through `runCommand`/`execSync`.
  - the M2 hygiene rework is adopted: the created images are removed, the cached images stay, the
    containers a failed step left behind are removed, a broken cache chain earns one retry.
- `tests/unit/dockerignoreBuild.test.ts` (new): the tests that prove the gate.
- `vitest.config.ts`: `testTimeout` 30 000 → 120 000 ms. No assertion is touched.

**Out of scope**

- `Dockerfile`, `docker-compose.yml`, `.dockerignore` — untouched.
- The 200 MB limit and the assertions that enforce it — unchanged.
- `tests/unit/camera/vision/visionScaffold.test.ts` — package 002 owns it.
- `.github/workflows/ci.yml` — coordination item O1 in the plan, owned by `infra`.
- Any production code.

---

## Files

| File                                             | What changes                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/support/docker-build.ts` **(new)**        | The opt-in flag, the spawn-based build runner with its deadline and process-group termination, the image/container parsers and the cleanup helpers, the size measurement and the daemon probe. The contract is the _API contract_ section of `_plan.md`.                                                  |
| `tests/unit/dockerignore.test.ts`                | The live block is gated and reports its skip visibly; the build goes through the new module; the M2 hygiene rework is applied. The structural assertions are **kept verbatim** — moved into their own always-running `it(...)` block if the implementation splits them out, which is the preferred shape. |
| `tests/unit/dockerignoreBuild.test.ts` **(new)** | The proof that the default run starts no `docker build`, that the opt-in run does, and that the child is dead after the deadline.                                                                                                                                                                         |
| `vitest.config.ts`                               | `testTimeout: 30000` → `testTimeout: 120000`, with the reason in a comment.                                                                                                                                                                                                                               |

**No other file may be touched by this package.**

---

## The design as implemented

> **Read from the code on 2026-11-16.** The implementation of this package landed in the worktree
> while the plan was being written. This section describes **what the code does**, and the
> `## Result` section is still empty — the implementation has not been verified yet.

### The gate

- `DART_DOCKER_BUILD=1` — or `"true"` — enables the live build. Every other value (`"0"`, `""`,
  unset) is disabled.
- The refusal lives in the **module**: `runDockerBuild` checks the flag before it spawns anything
  and returns `started: false` with the reason. A direct call cannot start a build either.
- The live block's title in the default run states the reason:
  `docker build respects the ignore file and image size stays below 200 MB (skipped: set DART_DOCKER_BUILD=1 to run the live build)`,
  and a `console.info` line prints `liveBuildSkipReason()`. A reader must never have to guess
  whether the check ran.
- When the flag is set but no daemon answers, the test **fails** with the daemon's output: the
  live build was asked for explicitly, so a missing daemon is an error and not a silent skip.

### The killable child

- `spawn`, never `execSync`. The child is **not detached**: it stays in the process group of the
  vitest worker, so a runner that kills the task's process group reaches the build with it. A
  detached build would survive that group kill and become the orphan this package exists to
  prevent.
- The child is killed **by its pid** — never with `process.kill(-pid, …)`, which addresses the
  group and would kill the worker itself.
- On the deadline: **SIGINT** first (so the docker CLI cancels the build on the daemon side),
  **SIGKILL** after a 10 s grace window.
- A **process-level guard** is installed while a child is alive: on `exit`, `SIGINT` and `SIGTERM`
  every live child is killed. The listeners are removed again once the last child is gone, so a
  suite run without a live build keeps vitest's own signal behaviour.
- The runner **resolves only after the child is gone**: it waits for the child's `exit`, waits
  (bounded) for the stdio streams to flush, and kills the process once more if the handle does not
  know about the exit.
- The caller's `finally` removes the tag, the created images and the leftover containers — on the
  success path and on the timeout path alike.

### The hygiene (M2 rework, adopted)

- The images the build **created** are removed, newest first, because the daemon refuses to delete
  an image that still has a dependent child image.
- The images the build took **from the cache** are **never** removed — they belong to the shared
  daemon cache and to the builds running at the same time. Removing them is what broke a
  concurrent build's cache chain in the first place.
- The **tagged** images are never removed — a tagged image belongs to the daemon, not to this build.
- The **containers** a failed step left behind are removed — the builder only cleans up the container
  of a successful step itself.
- A build that died with `parent snapshot … does not exist` gets **one retry**, after the broken
  chain has been removed, so the retry starts from the base image.

### The budgets

The build's deadline is deliberately **smaller** than the test's timeout, so the runner's own
deadline fires first and produces a clean failure message instead of a vitest timeout that would
leave the child running: the first attempt gets 1 200 000 ms, the retry 600 000 ms, the test
2 100 000 ms.

### The proof that the default run starts no build — **still missing**

`tests/unit/dockerignoreBuild.test.ts` does not exist yet. The agreed design for it:

1. A temporary directory holds an executable `docker` **shim** that appends every invocation to a
   marker file and answers the commands the test uses (`info`, `build`, `image inspect`,
   `image ls`, `rmi`, `rm`) with plausible, deterministic output.
2. The shim directory is prepended to `PATH` of a **child** process that runs
   `npx vitest run tests/unit/dockerignore.test.ts`.
3. **Without** `DART_DOCKER_BUILD`: the child run exits 0, the marker file **does not exist** — no
   docker command was issued at all — and the output names the skip reason.
4. **With** `DART_DOCKER_BUILD=1`: the child run exits 0, the marker file **exists** and records the
   `build` invocation — the opt-in path really builds.
5. The child environment drops every `VITEST*` variable, so the nested run is not mistaken for a
   run inside a vitest worker.

The shim makes the pair of tests fast (seconds) and deterministic, and it proves the property that
matters — _the real test file starts no build by default_ — without waiting nine minutes for a
real one.

---

## Acceptance criteria

1. `npm test` runs the full suite and **starts no `docker build`** — proved by the shim test of
   package 001 (the marker file stays absent), not by an assertion about the source.
2. The structural `.dockerignore` assertions still run in the default suite, with the **same**
   assertions: the required entries exist, the named real paths are excluded, the builder-critical
   paths are kept, and the heavy paths are pruned from the simulated build context. The structural
   block is its own `it(...)` — `"keeps the heavyweight artifacts out of the build context"` — so
   it runs on every run.
3. `DART_DOCKER_BUILD=1 npm test -- tests/unit/dockerignore.test.ts` builds the image and enforces
   the limit: the build exits 0 and the measured size stays below 200 MB. **The assertions are not
   weakened.**
4. Without the flag the live block is skipped and the reason is **visible** in the test title and
   on the console. A run that silently omits the check fails this criterion.
5. `DART_DOCKER_BUILD` is enabled by `"1"` and `"true"`; `"0"`, `""` and unset are disabled — pinned
   by a test.
6. The build runs as a spawned child process, not through `execSync`, and the child is **not**
   detached — it stays in the worker's process group.
7. When the deadline fires, the child is terminated (SIGINT, then SIGKILL after a 10 s grace
   window) and the runner resolves only after the child is gone. A test asserts the pid is dead
   when the runner settles.
8. The `finally` removes the tag, the images the build **created**, and the containers a failed
   step left behind — on the timeout path as well as on the success path.
9. The images the build took **from the cache** are still on the daemon after the run, and the
   tagged images are untouched.
10. A build that dies with `parent snapshot … does not exist` is retried once, and the retry runs
    from the base image.
11. The guard test asserts that `tests/unit/ci-workflow.test.ts` does **not** replay the CI
    `Test (Docker image)` step — the inline `DART_DOCKER_BUILD=1 ` prefix is load-bearing and must
    stay — and that the workflow **does** contain that step, as
    `tests/unit/dockerignore.test.ts` already claims it does.
12. `vitest.config.ts` carries `testTimeout: 120000` with the reason in a comment. No assertion is
    affected by the change.
13. `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` are green.
14. The `## Result` section below carries the **real** command output, including `docker system df`
    before and after the opt-in run.

---

## Verification command

```bash
# 1. The default suite starts no docker build and is green.
npm test

# 2. The gate tests on their own.
npx vitest run tests/unit/dockerignoreBuild.test.ts

# 3. The opt-in run: the real build, the real 200 MB limit.
DART_DOCKER_BUILD=1 npm test -- tests/unit/dockerignore.test.ts

# 4. The static gates.
npm run typecheck && npm run lint && npm run format:check
```

The opt-in run takes 7–16 minutes on this host (422 s idle, up to 923 s with a concurrent build on
the same daemon). Run it **alone**, not together with the full suite.

---

## Result

Executed by the orchestrator on 2026-11-16 in the worktree
`.ai/cezar/worktrees/6cbf47cd-356a-4a5d-903c-05f870eef7d5` (branch `cez/6cbf47cd`, rebased onto
the integration head `9343787`).

### 1. The default suite — green, and no `docker build`

```
$ npm test
 Test Files  109 passed (109)
      Tests  601 passed | 1 skipped (602)
   Duration  351.03s (transform 6.16s, setup 8.26s, import 14.51s, tests 253.27s, environment 36.15s)
FINAL2_EXIT=0
```

The single skipped test is the opt-in live build. Its reason is printed to stdout and carried in the
test title — a skip nobody sees is a check nobody runs:

```
$ npx vitest run tests/unit/dockerignore.test.ts --reporter=verbose
stdout | tests/unit/dockerignore.test.ts
[dockerignore] DART_DOCKER_BUILD is not set: the live docker build is opt-in. It needs a reachable
docker daemon, several minutes of build time and about 4 GB of disk on the daemon, so it only runs
when DART_DOCKER_BUILD=1 is set in the environment.
 ✓ tests/unit/dockerignore.test.ts > dockerignore > contains entries for node_modules, tests/, .git, .env, and other large folders 14ms
 ✓ tests/unit/dockerignore.test.ts > dockerignore > does not ignore files the builder stage needs 43ms
 ✓ tests/unit/dockerignore.test.ts > dockerignore > keeps the heavyweight artifacts out of the build context 1ms
 ↓ tests/unit/dockerignore.test.ts > dockerignore > docker build respects the ignore file and image size stays below 200 MB (skipped: set DART_DOCKER_BUILD=1 to run the live build)
```

The file itself went from **474.65 s** (M2's measurement of the same file with the live build) to
**4.85 s** in the default mode. During the whole suite run no `docker build` process existed —
checked with `ps -eo pid,etime,cmd | grep "docker build"` while the suite was running.

### 2. The gate tests on their own

```
$ npx vitest run tests/unit/dockerignore.test.ts tests/unit/dockerignoreBuild.test.ts
 Test Files  2 passed (2)
      Tests  24 passed | 1 skipped (25)
   Duration  8.83s
```

### 3. The opt-in run — the real build, the real 200 MB limit

```
$ DART_DOCKER_BUILD=1 npm test -- tests/unit/dockerignore.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  673.18s
OPTIN4_EXIT=0
```

The build really ran (a `docker build` process existed for the whole run), the image was built, the
200 MB limit was enforced, and afterwards:

```
=== orphan processes? ===        NONE — no orphan docker build
=== leftover containers? ===     (empty — none)
=== the test image removed? ===  only the three shared tagged images remain
```

### 4. The static gates

```
$ npx prettier --check <all changed files>   →  All matched files use Prettier code style!
$ npx eslint --max-warnings=0 <all changed files>   →  (no output)
$ npx tsc --noEmit --incremental false       →  (no output)
$ npm run format:check                       →  All matched files use Prettier code style!
```

### 5. The disk leak — found and closed by the orchestrator

The first live run against a real daemon exposed a hole in the adopted M2 rework that no unit test
could see: **removing a child image makes the daemon re-commit its parent under a new id**, and that
new id is not in the build output. A single removal pass therefore left the parent chain behind —
five images of ~1.3 GB each, holding the layer of the `npm ci` stage. The cleanup now runs in
passes: the first pass removes the ids the builder reported, every pass after that removes the ids
that appeared on the daemon since the previous snapshot — those are the parents the daemon
re-committed. The window is one removal pass (seconds), not the whole build.

The daemon state before and after the final live run is the proof:

```
BEFORE: dangling=0 images_total=3     Images 3  281.2MB
AFTER:  dangling=0 images_total=3     Images 3  281.2MB
```

Without the loop the same build leaves five dangling images of ~1.3 GB — the leak that filled the
host to 99 % in the first place (M2: 19 builds → 70.36 GB). The build is the only thing that
touched the daemon in that run; it left it exactly as it found it.

### 6. The independent review

`code-reviewer`, read-only: **approve with comments** — no CRITICAL, no HIGH, 6 MEDIUM, 8 LOW. All
MEDIUM findings (1–5) and LOW findings (4–8) were fixed; LOW 1 (stale documentation) was fixed by
the `architect`. MEDIUM 6 (the global `testTimeout` of 120 s) was **accepted with a reason**: a
false red blocks a runner slot exactly like a slow suite does, and the measured suite duration of
351 s is far below the 30-minute runner limit. The review's own findings and their disposition are
in `003-independent-review.md`.

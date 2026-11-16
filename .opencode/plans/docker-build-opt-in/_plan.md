# Plan — Docker Build Opt-In

**Feature slug:** `docker-build-opt-in`
**Created:** 2026-11-16
**Branch:** `cez/6cbf47cd` · worktree `.ai/cezar/worktrees/6cbf47cd-356a-4a5d-903c-05f870eef7d5`
**Status:** `done` — packages 001, 002 and 003 are closed; the branch is rebased onto the integration head `9343787`
**Touches:** test infrastructure only. No production code, no `src/**`, no `app/**`, no `prisma/**`.

---

## Objective

Take the real `docker build` out of the default unit-suite run.

`tests/unit/dockerignore.test.ts` currently builds the production image against the shared Docker
daemon inside the ordinary `npm test` run. The build needs three to ten minutes on this 2-CPU
host, it leaves untagged images on the shared daemon (70 GB after nineteen runs), and — because it
runs through `execSync` — it survives the death of the process that started it: when a runner is
killed by a timeout or an abort, the `docker` CLI keeps running as an orphan, keeps burning RAM and
disk, and keeps the runner slot blocked.

This plan makes the live build **opt-in** through the environment variable `DART_DOCKER_BUILD=1`,
runs it as a killable child process with a hard deadline and a `finally` that guarantees the child
is dead, and adopts the Docker-hygiene rework of the M2 task: the images the build **created** are
removed, the **cached** images stay (they belong to the shared daemon cache and to the builds
running at the same time), the containers a failed step left behind are removed, and a build that
died because another build broke the shared cache chain gets one retry.

The structural `.dockerignore` checks stay in the default suite run, with their assertions unchanged.

---

## Discovery notes

### Why the live build is in the unit suite at all

The file verifies two different things about the production image, and only the second one needs a
daemon:

1. **The build context is pruned.** `.dockerignore` must exclude `node_modules`, `tests/`, `.git`,
   `.env*`, `.next`, `coverage`, `docs`, `reports`, `.github`, `.claude` and the build scratch
   state, and must keep `Dockerfile`, `package.json`, `package-lock.json`, `next.config.ts`,
   `tsconfig.json`, `app/`, `public/`, `src/`, `prisma/` — the paths the builder stage imports
   from. This is a pure file-level check over the repository tree, it needs no daemon, and it runs
   in milliseconds.
2. **The image that comes out is small.** The `.dockerignore` file only has meaning in relation to
   the image it produces: an ignore file that excludes the right paths still yields an oversized
   image when the Dockerfile copies something else, or when the dependency tree in the builder stage
   is bigger than the limit allows. The 200 MB ceiling can only be answered by building the real
   image against a real daemon and measuring it.

So the live build is not decoration: it is the **only** place where "the production image stays
below 200 MB" is a fact rather than an intention. The plan does not remove that check — it moves it
behind a flag and gives it a CI step of its own (see _The CI workflow_ below and risk 1).

### Why it costs three to ten minutes

The Dockerfile's builder stage runs `npm ci` **inside the container** — the whole dependency tree
is downloaded and unpacked there — and then `next build`. Measured on this host (2 CPUs, 3.8 GB
RAM) in the M2 report:

| Condition                                                    | Build time |
| ------------------------------------------------------------ | ---------- |
| Idle, warm cache                                             | 422 s      |
| Idle, second measurement                                     | 575 s      |
| One concurrent build on the daemon                           | 836 s      |
| One concurrent build + the test suite competing for the CPUs | 923 s      |
| Cold layer cache (the ~9 min figure)                         | ~540 s     |

The suite itself is not the bottleneck: the M2 run measured **1404.36 s** for the whole suite
(107 files / 556 tests) and **474.65 s** for `tests/unit/dockerignore.test.ts` alone. That one file
was roughly a third of the suite's wall clock, and it blocked every task that runs the full suite
for the duration.

The 900 s budget the file carried was already too small — 836–923 s is inside the contention
window — which is why the M2 rework raised it to 2 100 000 ms.

### Why it produces orphan processes

The build is started through `tests/support/run-command.ts`, and that helper uses `execSync`:

```ts
// tests/support/run-command.ts:14
const output = execSync(command, { cwd: process.cwd(), encoding: "utf-8", … });
```

`execSync` spawns the child synchronously and blocks the event loop. When the **parent** is killed
— the runner timeout fires, the task is aborted, the process receives SIGKILL — the child is
reparented to init and **keeps running**. Nothing in Node can prevent that: the parent never gets
the chance to run a `finally`, so the `finally { runCommand("docker rmi …") }` that removes the
tag never runs either.

The consequence is not a slow test but a stuck runner: the orphaned `docker build` keeps consuming
CPU, RAM and disk while holding the runner slot. Two runner slots were blocked overnight this way
and a third task was killed by the 30-minute runner timeout. The same mechanism explains why the
disk filled up: the orphan's images are never cleaned, because the cleanup code lives in a
process that no longer exists.

### The disk leak

This host has **no buildx plugin** — `docker buildx` answers `unknown command` (verified
2026-11-16, daemon 29.1.3) — so the **legacy builder** runs. The legacy builder commits **every
stage of the Dockerfile as its own image** and leaves the intermediate stages on the daemon as
untagged images. A single build of this Dockerfile leaves several gigabytes of them (the `npm ci`
stage alone is larger than the final image).

The old cleanup removed only the **tag** (`docker rmi ${tag}`), so the intermediate images stayed.
The M2 report measured the consequence: **19 builds left 70.36 GB of untagged images**, the daemon
stood at 58 images / 70.36 GB, the root filesystem was at **99–100 %** (867 MB free), and the next
build died with

```
failed to apply diff: write /var/lib/containerd/…/sha512/81/b0/02604f08…: no space left on device
```

— a failure that has nothing to do with the `.dockerignore` file, and one that looks exactly like a
regression of the thing the test is about. The same leak is present again right now: `docker system
df` reports **19 images / 23.99 GB** on the daemon.

The fix is the M2 rework, adopted here in full:

- the images the build **created** are removed with it — they are the leak;
- the images the build took **from the cache** stay — they belong to the shared cache of the
  daemon and to the builds running at the same time. Removing them was precisely the mistake that
  broke a concurrent build's cache chain;
- the **containers** a failed step left behind are removed — the builder only cleans up the
  container of a successful step itself.

### The shared daemon, the legacy builder and the cache chain

The legacy builder **uses** its cache, and the cache is a chain of images. When another build on the
same daemon removes an image, the store can take the snapshot of a cached layer away, and the next
build that uses that cache entry dies with

```
Step 8/25 : COPY . .
NotFound: parent snapshot sha256:b8c3e07e… does not exist: not found
```

That was the failure of the final M2 run (build 322 s, then `NotFound`). A build that dies that way
gets **one retry**: the broken chain is removed with it, so the retry runs the steps again from the
base image. The budget covers both attempts.

### The CI workflow — measured after the hand-off

The hand-off this plan was commissioned from states: _"the CI workflow does not set the flag — say
plainly what that means for the coverage of the size limit."_ **That was true when the plan was
commissioned and it is no longer true in this tree.**

At 2026-11-16 10:41 UTC a parallel agent added a step to `.github/workflows/ci.yml` in this
worktree (the file is modified but uncommitted):

```yaml
- name: Test (Docker image)
  run: DART_DOCKER_BUILD=1 npm run test -- tests/unit/dockerignore.test.ts
```

Before that change the workflow ran only `npm run test`, so with the opt-in gate the 200 MB limit
would have been verified **nowhere in CI**. With the step, the limit is verified in CI again — but
only as long as that step exists. The step is **not** in package 001's file list, and
`.github/workflows/` belongs to the `infra` agent per the ownership table in `AGENTS.md`. It is
therefore recorded as coordination item **O1** below and as risk 1, and the orchestrator decides
who owns it.

### The meta-test replay coupling

`tests/unit/ci-workflow.test.ts:47-54` replays every workflow step whose `run` **starts with**
`npm run`:

```ts
const npmSteps = steps.filter(
  (step) =>
    step.run?.startsWith("npm run") &&
    step.run !== "npm run test" &&
    step.run !== "npm run test:e2e",
);
```

The new docker step starts with `DART_DOCKER_BUILD=1 `, not with `npm run`, so it is **not**
replayed. Verified against the current workflow by running the filter itself:

```
REPLAYED by ci-workflow.test.ts:
  - npm run lint
  - npm run format:check
  - npm run typecheck
DOCKER step replayed? false
```

This coupling is load-bearing and fragile — but the failure mode is narrower than it first looks.
If the step were rewritten as `npm run test -- tests/unit/dockerignore.test.ts` with an `env:` block
instead of the inline prefix, the meta-test would indeed replay the step; it would **not** start a
build, because the replay runs the `run` string through `execSync` with the _ambient_ environment,
and the ambient environment does not carry `DART_DOCKER_BUILD` — the live block would be skipped.

The hazard that is real is the opposite one: if the replay filter's exclusion clause
(`!step.run.includes("DART_DOCKER_BUILD=1")`) were dropped or the filter widened while the `run`
string still carries the inline prefix, then the shell **would** apply the prefix and a real
multi-minute build would start inside the unit suite. The filter clause is therefore extracted into
a named function and guarded by a test (package 001, acceptance criterion 9; review finding
MEDIUM 5).

A second, independent hazard is an `env:` block on the `quality` **job**: it would put the flag into
every plain `npm run test` run on every push. The CI guard therefore models `env:` on jobs and steps
(review finding MEDIUM 1).

### The global test timeout

The suite shares the machine with other worktrees and repositories: 2 CPUs, 3.8 GB RAM. A jsdom
component test needs ~5 s on an idle machine and **36.9 s** when three suites compete for the same
cores — more than the 30 s global budget. `vitest.config.ts` therefore moves `testTimeout` from
30 000 to 120 000 ms. **No assertion is touched** by that change; the live docker build keeps its
own explicit, much larger budget.

---

## Scope

### In

- The structural `.dockerignore` checks stay in the default suite run, with their assertions
  unchanged.
- The live build + image-size check becomes opt-in via `DART_DOCKER_BUILD=1`. Without the flag it
  is skipped with a **visible** reason — the test title names it and a console line repeats it.
  Never silently.
- The live `docker build` runs as a killable child process (`spawn`, not `execSync`), with a hard
  deadline and a `finally` that guarantees the child is dead. No orphan process.
- A test proves the default run starts no `docker build`.
- The M2 Docker-hygiene rework: remove the created images, keep the cached images, remove the
  containers a failed step left behind, one retry on a broken cache chain.
- `vitest.config.ts`: global `testTimeout` 30 000 → 120 000 ms.
- `tests/unit/camera/vision/visionScaffold.test.ts`: the scoped `tsc` run gets its own budget
  (180 000 ms — the budget the repository already gives `tests/unit/typescript.test.ts`).

### Out

- **No production code.** `src/**`, `app/**`, `prisma/**`, `Dockerfile`, `docker-compose.yml` and
  `.dockerignore` are untouched. This is test infrastructure only.
- **No CI workflow change inside the package list.** The `Test (Docker image)` step in
  `.github/workflows/ci.yml` was added by a parallel agent and is tracked as coordination item O1,
  not as a package file.
- **No new dependency.** `node:child_process` is a Node built-in; `tests/support/run-command.ts`
  already uses it.
- **No change to the 200 MB limit** and none to the assertions that enforce it.
- **No commit, no push, no branch operation.**
- **No `docs/` or `AGENTS.md` change in this plan.** Both carry a paragraph about the dockerignore
  test that this plan makes stale — see _Follow-ups_ below.

---

## Success criteria

1. **The default suite run is green and starts no `docker build`.** Proved by a **test**, not by an
   assertion about the source: a `docker` shim on `PATH` records every invocation, and the default
   run must leave that record empty.
2. **`DART_DOCKER_BUILD=1 npm test -- tests/unit/dockerignore.test.ts` still builds the image and
   enforces the 200 MB limit** — the build must exit 0 and the measured image size must stay below
   200 MB. The assertions are not weakened.
3. **The build leaves no orphan process behind** when the test ends or the deadline fires. The
   child stays in the worker's process group and is killed by its pid; a process-level guard
   kills every live child on `exit`, `SIGINT` and `SIGTERM`; the helper resolves only after the
   child is gone.
4. **The structural checks still run in the default suite** — the same assertions, on every run.
5. The skip is **visible**: the test title and a `console.info` line state that the live build is
   opt-in and name the flag. A default run that quietly omits the check is a failure of this plan.
6. The daemon is left as it was found: the created images are gone, the cached images are still
   there, the leftover containers are gone.
7. `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` are green.
8. **The coverage of the 200 MB limit is stated honestly.** The limit is verified only in a run
   that sets `DART_DOCKER_BUILD=1`. In CI that is the `Test (Docker image)` step (O1). If that step
   is not merged, the limit is verified nowhere — that fact is recorded, not smoothed over.

---

## Task table

| Task    | Description                                                                                                                                                                                                                                                                                                                                                                               | Owner                                                    | Files                                                                                                                                                         | Depends on | Status |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| **001** | **The live build becomes opt-in and killable.** `DART_DOCKER_BUILD=1` gates the live block; the build runs through `spawn` with a hard deadline, a kill path and a `finally` that removes the tag, the created images and the leftover containers; the M2 hygiene rework is adopted; a test proves the default run starts no build; `vitest.config.ts` moves the global timeout to 120 s. | `qa-engineer`                                            | **owned:** `tests/support/docker-build.ts` (**new**); `tests/unit/dockerignore.test.ts`; `tests/unit/dockerignoreBuild.test.ts` (**new**); `vitest.config.ts` | —          | `done` |
| **002** | **The scoped compiler run gets the budget the repository already gives compiler runs.** `tests/unit/camera/vision/visionScaffold.test.ts` runs `npx tsc` over the camera vision outline; it needs ~18 s idle and gets `{ timeout: 180_000 }`, the budget `tests/unit/typescript.test.ts` already uses.                                                                                    | `game-engine`                                            | **owned:** `tests/unit/camera/vision/visionScaffold.test.ts`                                                                                                  | —          | `done` |
| **003** | **Independent review of 001 and 002.** Findings, severity, and the disposition of each one. The reviewer does not change the code it reviews.                                                                                                                                                                                                                                             | `code-reviewer` (with `qa-engineer` for the disposition) | **owned:** `.opencode/plans/docker-build-opt-in/003-independent-review.md` (**new**); read-only on every file of 001 and 002                                  | 001, 002   | `done` |

**Resume point:** package 001. The first entry that is not marked `done` is where a new session
continues.

**File ownership note.** `tests/unit/dockerignore.test.ts` and `tests/unit/dockerignoreBuild.test.ts`
live under `tests/` and are therefore the `qa-engineer`'s area. `tests/unit/camera/vision/visionScaffold.test.ts`
is a `src/camera/` test and therefore the `game-engine` agent's. The two packages touch disjoint
files and may run in parallel.

---

## Coordination items outside the package list

| #      | Item                                                                                                                                                                                                                                                                                                                                                                                       | Suggested owner   | State                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O1** | The `Test (Docker image)` step in `.github/workflows/ci.yml` (`DART_DOCKER_BUILD=1 npm run test -- tests/unit/dockerignore.test.ts`). It is the **only** place where the 200 MB limit is verified in CI. It was added by a parallel agent in this worktree on 2026-11-16 10:41 UTC and is **uncommitted**. `.github/workflows/` belongs to `infra` per the ownership table in `AGENTS.md`. | `infra` (confirm) | Present in the working tree, uncommitted. The orchestrator must decide whether it is part of this plan's delivery or a separate package — and it must be **committed**, or the limit is verified nowhere. |

### Follow-ups (not in this plan)

| #      | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Owner                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **F1** | ~~`AGENTS.md` carries a paragraph about the dockerignore test ("runs a **real** `docker build` … under a 900 s timeout …"). It becomes wrong in three places: the build is opt-in now, the budget is 2 100 000 ms, and the default run no longer builds anything.~~ **Done 2026-11-16** — the paragraph and the bullet above it now state the opt-in rule, the 2 100 000 ms budget and the command. The main checkout's `AGENTS.md` working copy still carries the old paragraph; it must be reconciled when the branch is merged. | `architect` — **done**                                            |
| **F2** | ~~`docs/TESTING.md` does not yet mention the opt-in flag or the CI step.~~ **Done 2026-11-16** — the QA handbook gained a "The Docker image build" subsection with the opt-in command, the skip reason and the CI step.                                                                                                                                                                                                                                                                                                            | `qa-engineer` — **done** (by the `architect`, who owns the prose) |
| **F3** | ~~The skill test matrices and `docs/ai-skills/README.md` still describe the live build as environment-dependent.~~ **Done 2026-11-16** — all five `references/test-matrix.md` files, the two `SKILL.md` files, `darthub-code-review/references/review-checklist.md` and `docs/ai-skills/README.md` state the opt-in rule; the installed copies under `.agents/skills/` were re-copied and are byte-identical to `docs/ai-skills/skills/`.                                                                                          | `architect` — **done**                                            |

---

## API contract

The new module `tests/support/docker-build.ts` is the seam between the test and the Docker daemon.
It is the only place in the repository that starts a build, and it is the place the orphan problem
is fixed.

> **Reconciled against the implementation on 2026-11-16.** Package 001's implementation landed in
> this worktree while the plan was being written. The contract below is the **implemented** one,
> read from `tests/support/docker-build.ts` and `tests/unit/dockerignore.test.ts`. Where the first
> draft of this plan differed, the implementation wins and the difference is recorded in the
> progress log: the exported names, the enabled flag values, the process-group strategy, the
> position of the retry and the treatment of a missing daemon all changed.

### The opt-in flag

```ts
/** The environment variable that enables the live docker build. */
export const LIVE_BUILD_ENV_FLAG = "DART_DOCKER_BUILD";

/** Whether the live docker build was explicitly requested. */
export const isLiveBuildRequested: (env?: NodeJS.ProcessEnv) => boolean;

/** The reason the live docker build does not run — logged, never silent. */
export const liveBuildSkipReason: (env?: NodeJS.ProcessEnv) => string;
```

- The flag is enabled by the values **`"1"` and `"true"`** (trimmed, case-insensitive). Every other
  value — `"0"`, `""`, unset — is disabled.
- The refusal lives in the **module**, not only in the test: `runDockerBuild` checks the flag
  _before_ it spawns anything and returns `started: false` with the reason. A direct call cannot
  start a build either.
- `liveBuildSkipReason` names the flag and the value in play, so the skip is never silent.

### The build runner

```ts
export type RunDockerBuildOptions = {
  /** The tag of the built image; part of the default command. */
  readonly tag: string;
  /** The deadline for the build. */
  readonly timeoutMs: number;
  /** The working directory of the build. */
  readonly cwd?: string;
  /** The command to run — injectable for tests. */
  readonly command?: string[];
  /** The environment the flag and the child process are read from. */
  readonly env?: NodeJS.ProcessEnv;
  /** The time between the SIGINT and the SIGKILL — 10 s by default. */
  readonly killGraceMs?: number;
};

export type DockerBuildOutcome = {
  /** False => no build process was spawned at all. */
  readonly started: boolean;
  /** The exit code of the build, 128 + signal number when it was killed. */
  readonly exitCode: number;
  /** The combined stdout and stderr of the build. */
  readonly output: string;
  /** True => the deadline killed the build. */
  readonly timedOut: boolean;
  /** How long the build ran. */
  readonly durationMs: number;
  /** Why the build did not run (or why it could not start). */
  readonly reason?: string;
  /** The pid of the build process — for the proof that it is gone. */
  readonly pid?: number;
};

/**
 * Runs a docker build as a killable child process.
 *
 * The build is only started when the opt-in flag is set — the check happens
 * here, before anything is spawned, so a caller cannot start a build by
 * accident. A build that exceeds its deadline is terminated (SIGINT first, so
 * the docker CLI cancels the build on the daemon side, SIGKILL after a grace
 * period) and the returned promise settles only after the child is gone.
 */
export const runDockerBuild: (options: RunDockerBuildOptions) => Promise<DockerBuildOutcome>;
```

**The child is deliberately NOT detached.** It stays in the process group of the vitest worker that
started it, so a runner that terminates a task by killing its process group reaches the build with
it. A detached build would sit in a group of its own, survive the group kill and become exactly the
orphan this runner is meant to prevent. The same holds for Ctrl-C in a terminal: the SIGINT reaches
the foreground process group, so the docker CLI cancels the build on the daemon side instead of
running on.

The child is therefore killed **by its pid** — never with `process.kill(-pid, …)`, because the
negative pid addresses the process _group_, and the child shares that group with the vitest worker:
that call would kill the test runner itself.

A **process-level guard** is installed while a build child is alive and removed again once the last
child is gone:

| Signal / event | Effect                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| `exit`         | Every live child is killed with SIGKILL.                                            |
| `SIGINT`       | Every live child is killed with SIGKILL, then the process exits with 128 + SIGINT.  |
| `SIGTERM`      | Every live child is killed with SIGKILL, then the process exits with 128 + SIGTERM. |

A suite run without a live build keeps vitest's own signal behaviour untouched, because the
listeners are removed again.

**The retry is not in the module.** `runDockerBuild` runs **one** attempt; the retry on a broken
cache chain lives in the test file, where the cleanup of the first attempt happens before the
second one starts.

### The hygiene helpers

The parsers are the ones the M2 report validated against a real failed build output:

```ts
/** The blocks the builder printed per step, without the step headline. */
export const parseBuildSteps: (buildOutput: string) => string[];

/** The id of the image a step ended with, if the step produced one. */
export const stepImageId: (step: string) => string | undefined;

/** The ids of the images the build took from the cache. */
export const parseCachedImageIds: (buildOutput: string) => string[];

/** The ids of the images the build created itself. */
export const parseCreatedImageIds: (buildOutput: string) => string[];

/** The ids of the containers the build created. */
export const parseBuildContainerIds: (buildOutput: string) => string[];

/**
 * Whether the build died because another build broke the shared cache chain
 * of the daemon: the store took the snapshot of a cached layer away, and the
 * build that uses that cache entry dies with "NotFound: parent snapshot ...
 * does not exist".
 */
export const isBrokenCacheChain: (buildOutput: string) => boolean;

export type DockerCliResult = {
  readonly exitCode: number;
  readonly output: string;
};

export type DockerCliRunner = (args: string[]) => DockerCliResult;

/** Runs a docker command and captures its status and combined output. */
export const runDockerCli: DockerCliRunner;

/**
 * The ids of the images that carry a repository:tag — the shared ones.
 * `docker image ls -q` lists exactly those; `docker image ls -a -q` would
 * additionally list the dangling intermediate images, and those are the leak
 * the cleanup has to remove.
 */
export const listTaggedImageIds: (runner?: DockerCliRunner) => string[];

/** A tagged image belongs to the daemon, not to this build. */
export const isSharedImage: (taggedImageIds: string[], id: string) => boolean;

/** Removes the given image ids, newest first, and ignores the ones that go. */
export const removeImageIds: (
  taggedImageIds: string[],
  ids: string[],
  runner?: DockerCliRunner,
) => void;

/** Removes the containers a build left behind. */
export const removeBuildContainers: (containerIds: string[], runner?: DockerCliRunner) => void;
```

### Invariants of the module

- **The build is spawned; it is never run through `execSync`.** The long-running command is the
  one that can orphan, and it is the one that is spawned with a deadline and a kill path.
- The short-lived housekeeping commands — `docker info`, `docker image ls -q`,
  `docker image inspect`, `docker rmi`, `docker rm` — go through `runDockerCli`, which is
  `runCommand` (`execSync`). They finish in milliseconds; the orphan problem does not apply to them.
- **The child is not detached** and stays in the worker's process group, so a group kill reaches
  it.
- **The child is killed by pid**, never by process group — the group belongs to the worker.
- **The helper resolves only after the child is gone.** A caller can rely on "the promise settled"
  meaning "nothing of this build is still running": the runner waits for the child's `exit`, waits
  (bounded) for the stdio streams to flush, and kills the process once more if the handle does not
  know about the exit.
- **The process-level guard is installed while a child is alive and removed again afterwards.**
- **The cached images are never removed.** Removing them is what broke a concurrent build's cache
  chain in the first place.
- **The tagged images are never removed.** A tagged image belongs to the daemon and to the builds
  that run at the same time.
- The module touches **no** file outside the repository and **no** global state beyond the daemon.

### The observable behaviour of the test file

| Situation                     | What a reader sees                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default run, no flag          | The live block is **skipped**. Its title names the flag (`… (skipped: set DART_DOCKER_BUILD=1 to run the live build)`) and a `console.info` line prints the reason. The structural blocks run and pass. |
| `DART_DOCKER_BUILD=1`         | The live block **runs**: the daemon is probed, the image is built, the size is measured, and the 200 MB limit is asserted.                                                                              |
| No daemon reachable, flag set | The test **fails** with the daemon's output. The live build was asked for explicitly, so a missing daemon is an error and not a silent skip.                                                            |
| The deadline fires            | The child is terminated (SIGINT, then SIGKILL after 10 s), the test **fails** with the deadline in the message, and no child survives.                                                                  |

The live test's budgets: the first attempt gets 1 200 000 ms, the retry 600 000 ms, and the test
itself 2 100 000 ms. The build's deadline is deliberately **smaller** than the test's timeout, so
the runner's own deadline fires first and produces a clean failure message instead of a vitest
timeout that would leave the child running.

---

## Risks

| #   | Risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Likelihood                                                        | Impact                                                                                                                                  | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The 200 MB size limit is verified nowhere.** The limit is only checked in a run that sets `DART_DOCKER_BUILD=1`. The CI workflow did **not** set the flag until a parallel agent added the `Test (Docker image)` step at 2026-11-16 10:41 UTC — and that step is still **uncommitted**. If it is dropped, reverted, or never merged, the size limit is checked by nothing: not by CI, not by the default suite.                                                                                                                                                                               | medium — the step exists in the tree but is uncommitted           | **critical** — a silent, permanent loss of a release gate                                                                               | The CI step is coordination item **O1** with a named owner to confirm. A guard test asserts the workflow contains the step and that the meta-test does **not** replay it. The plan states the gap plainly instead of hiding it behind "the check still exists somewhere".                                                                                                                                                                                                                       |
| 2   | **The legacy builder's image leak returns.** There is no buildx plugin on this host (`docker buildx` → `unknown command`, verified), so every build leaves several GB of untagged intermediate images. A regression in the cleanup fills the disk again — the daemon already stands at 19 images / 23.99 GB.                                                                                                                                                                                                                                                                                    | medium — the cleanup is new code with a parser behind it          | **high** — the disk fills, the next build fails with `no space left on device`, and the failure looks like a `.dockerignore` regression | The cleanup removes **only** the images the build created, identified by the builder's own `---> <id>` output; the cached images stay. `docker system df` before and after is recorded in package 001's `## Result`.                                                                                                                                                                                                                                                                            |
| 3   | **A shared daemon whose image store is churned by concurrent builds.** The legacy builder's cache is a chain; another build's removal can take the snapshot of a cached layer away and the build dies with `NotFound: parent snapshot … does not exist`.                                                                                                                                                                                                                                                                                                                                        | medium — it is the observed failure of the M2 run                 | medium — a red docker test that is contention, not a regression                                                                         | One retry after the broken chain is removed. The failure message names the cause. A red docker test under contention is documented as **not** a regression.                                                                                                                                                                                                                                                                                                                                     |
| 4   | **The 2-CPU host.** The build needs 422 s idle and 836–923 s under contention, and the suite competes for the same cores. A deadline that is too small turns contention into a failure; one that is too large keeps the runner blocked.                                                                                                                                                                                                                                                                                                                                                         | certain                                                           | medium — a failed or a blocked runner                                                                                                   | The live test keeps its own explicit budget (2 100 000 ms, covering the cold path, a concurrent build and the one retry). The global timeout change (30 s → 120 s) does not shorten it.                                                                                                                                                                                                                                                                                                         |
| 5   | **The orphan mechanism returns.** A `docker` invocation somewhere in the path still goes through `execSync`, and a killed parent leaves the child running again.                                                                                                                                                                                                                                                                                                                                                                                                                                | low after the rework — but `runCommand` is the established helper | **high** — the exact failure this plan exists to remove                                                                                 | The **build** is spawned, never `execSync`-ed: it stays in the worker's process group, it is killed by pid (SIGINT, then SIGKILL after 10 s), a process-level guard kills every live child on `exit`/`SIGINT`/`SIGTERM`, and the helper resolves only after the child has exited. The short-lived housekeeping commands (`info`, `image ls`, `rmi`, `rm`) still use `execSync` — they cannot outlive the parent in any meaningful way. A test asserts the pid is gone after the helper returns. |
| 6   | **The daemon-side build survives the killed client.** Killing the `docker` CLI does not stop the build the daemon is already running; it keeps writing layers.                                                                                                                                                                                                                                                                                                                                                                                                                                  | medium                                                            | medium — images and CPU keep being consumed                                                                                             | The `finally` cleanup runs even on the timeout path and removes the created images and the leftover containers; the daemon aborts the build when the client disconnects.                                                                                                                                                                                                                                                                                                                        |
| 7   | **The meta-test replays the CI docker step**, so the unit suite grows by nine minutes again. `tests/unit/ci-workflow.test.ts` replays every step whose `run` starts with `npm run`; the step only escapes because it starts with `DART_DOCKER_BUILD=1 `. **Corrected 2026-11-16 after the independent review:** an `env:` block instead of the inline prefix would _not_ start a build — the replay runs the `run` string with the ambient environment, which does not carry the flag. The real hazard is the filter's exclusion clause being dropped or widened while the inline prefix stays. | low — verified against the current workflow                       | **high** — the failure mode returns in the form of a green suite                                                                        | The replay filter is extracted into a named function and a guard test asserts that the docker step is not in the replayed set (review finding MEDIUM 5). The inline env prefix must be preserved. The coupling is documented in the discovery notes.                                                                                                                                                                                                                                            |
| 8   | **The global timeout 30 s → 120 s masks a genuinely hanging test.** A test that hangs now fails after two minutes instead of thirty seconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | low                                                               | medium — slower feedback on a real hang                                                                                                 | The change is documented with the measurement that motivates it (36.9 s measured under contention). Tests that need more declare their own budget; the 120 s is a ceiling, not a habit.                                                                                                                                                                                                                                                                                                         |
| 9   | **The flag leaks into a normal run.** A developer's shell profile or a CI variable sets `DART_DOCKER_BUILD` and the default suite starts a nine-minute build.                                                                                                                                                                                                                                                                                                                                                                                                                                   | low                                                               | medium — the blocked runner returns                                                                                                     | The flag is enabled by `"1"` and `"true"` only; `"0"`, `""` and unset are disabled, and a test pins that. No script in the repository sets it — the only place the flag appears is the CI step of coordination item O1.                                                                                                                                                                                                                                                                         |
| 10  | **The disk is full for reasons outside this test** — another worktree's build, a stale image, a log file. The build then dies with `no space left on device`, which reads like a `.dockerignore` failure.                                                                                                                                                                                                                                                                                                                                                                                       | medium — the daemon carries 23.99 GB of leftovers                 | medium — a confusing failure                                                                                                            | The failure message names the disk state and the `docker system df` output. `docker system df` is part of the recorded result.                                                                                                                                                                                                                                                                                                                                                                  |
| 11  | **The live build is never actually run** after the gate goes in, because nobody sets the flag locally either.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | medium                                                            | high — the gate exists but is never exercised                                                                                           | The CI step (O1) runs it on every push. The opt-in command is documented in the plan, in `docs/TESTING.md` (F2) and in `AGENTS.md` (F1).                                                                                                                                                                                                                                                                                                                                                        |
| 12  | **A concurrent agent changes the same files.** The tree is moving: `ci.yml` was modified at 10:41 UTC and `visionScaffold.test.ts` at 10:39 UTC while this plan was being written.                                                                                                                                                                                                                                                                                                                                                                                                              | **certain**                                                       | medium — a lost or overwritten change                                                                                                   | Every package has exactly one owning agent and a disjoint file list. The plan records the tree state it was written against, and the orchestrator reconciles the diff before the packages are closed.                                                                                                                                                                                                                                                                                           |
| 13  | ~~**Two files of package 001's file list are still missing** at the time of writing: `tests/unit/dockerignoreBuild.test.ts` does not exist, and the guard that `tests/unit/dockerignore.test.ts` claims for the CI step is not in `tests/unit/ci-workflow.test.ts`.~~ **Resolved 2026-11-16** — both exist and are green: the guard suite (19 assertions) and the CI guard (5 tests).                                                                                                                                                                                                           | ~~**certain** — verified by reading both files~~ → **resolved**   | ~~**high**~~ → **none**                                                                                                                 | Closed by package 001.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

---

## Progress log

| Date       | Event                                                          | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-16 | Plan commissioned                                              | The orchestrator handed over the objective: make the live docker build opt-in, killable and hygienic, without touching production code. The hand-off listed three packages (001 `qa-engineer`, 002 `game-engine`, 003 `code-reviewer` + `qa-engineer`) and stated that the CI workflow does not set the flag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-11-16 | M2 evidence read                                               | The M2 report and the stopgap patch were read as the primary source: full suite 1404.36 s (107 files / 556 tests), `tests/unit/dockerignore.test.ts` alone 474.65 s, the build itself 422 s idle and 836–923 s under contention, 19 builds leaving 70.36 GB of untagged images and the disk at 99–100 %. The patch's hygiene rework is adopted verbatim in 001.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-11-16 | Host facts re-verified                                         | Docker daemon 29.1.3 reachable; `docker buildx` → `unknown command`, so the **legacy builder** is the one that runs; `docker system df` → 19 images / 23.99 GB — the leak is present again. No `DART_*` variable exists anywhere in the repository, so `DART_DOCKER_BUILD` has no collision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-16 | Package 002 already in the tree                                | `tests/unit/camera/vision/visionScaffold.test.ts` carries `{ timeout: 180_000 }` in the working tree (modified, uncommitted) — the same budget `tests/unit/typescript.test.ts:5` already uses. Package 002 is therefore at "implemented, not yet verified".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-16 | CI workflow changed under the plan                             | At 10:41 UTC a parallel agent added the `Test (Docker image)` step (`DART_DOCKER_BUILD=1 npm run test -- tests/unit/dockerignore.test.ts`) to `.github/workflows/ci.yml` — uncommitted. The hand-off's statement that the workflow does not set the flag was true at commissioning and is false now. The step is coordination item O1 and risk 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-16 | Meta-test replay coupling verified                             | The filter of `tests/unit/ci-workflow.test.ts:47-54` was run against the current workflow: only `npm run lint`, `npm run format:check` and `npm run typecheck` are replayed. The docker step escapes **because** its `run` starts with `DART_DOCKER_BUILD=1 ` — recorded as risk 7 and as a guard to be added in 001.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-11-16 | Plan written                                                   | This plan, `001-opt-in-docker-build.md`, `002-vision-scaffold-timeout.md` and `003-independent-review.md` were written. No file outside `.opencode/plans/` was touched. No implementation was performed — packages 001 and 002 are in flight with their owners.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-11-16 | **The API contract was reconciled against the implementation** | Package 001's implementation landed in this worktree while the plan was being written (`tests/support/docker-build.ts` new, `tests/unit/dockerignore.test.ts` and `vitest.config.ts` modified). The contract section was rewritten from the **code**, and five points of the first draft were wrong: (1) the names are `LIVE_BUILD_ENV_FLAG`, `isLiveBuildRequested`, `liveBuildSkipReason`, `RunDockerBuildOptions`, `DockerBuildOutcome`, `isBrokenCacheChain`, `removeImageIds(taggedImageIds, ids, runner?)` and `removeBuildContainers(containerIds, runner?)`; (2) the flag is enabled by `"1"` **or** `"true"`, not by `"1"` alone; (3) the child is **not** detached — it deliberately stays in the worker's process group and is killed by pid, because a detached child would survive a group kill; the termination is SIGINT then SIGKILL after 10 s, and a process-level guard covers `exit`/`SIGINT`/`SIGTERM`; (4) the retry lives in the test file, not in the module; (5) a missing daemon with the flag set is an **error**, not a skip. The first draft of the plan is therefore wrong on those points and the implementation is right. |
| 2026-11-16 | Two files of package 001 are still missing                     | `tests/unit/dockerignoreBuild.test.ts` does not exist, and the guard for the CI step that `tests/unit/dockerignore.test.ts:126` claims (`tests/unit/ci-workflow.test.ts` guards it) is not in `tests/unit/ci-workflow.test.ts`. Recorded as risk 13; package 001 stays `in_progress` until they exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-11-16 | Orchestrator action required                                   | Assign O1 (the CI step) to an owner; confirm that the two missing files of package 001 land; decide whether F1 (`AGENTS.md`) and F2 (`docs/TESTING.md`) join this plan or follow it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

| 2026-11-16 | **Package 001 closed** | The live build is opt-in (`DART_DOCKER_BUILD=1`), killable, hygienic and guarded. Default suite on the rebased tree: 109 files / 601 passed / 1 skipped, 351.03 s, exit 0 — no `docker build` at any point. Opt-in run: 4/4 passed, 673.18 s, the real image built and the 200 MB limit enforced; no orphan process, no leftover container, and the daemon left exactly as it was found (0 dangling images before, 0 after). |
| 2026-11-16 | **Package 002 closed** | `tests/unit/camera/vision/visionScaffold.test.ts` carries `{ timeout: 180_000 }`; the file is green (6/6) and the scoped `tsc` run, which alone took 30.22 s, is no longer passing by a hair against the 30 s global budget. |
| 2026-11-16 | **Package 003 closed** | The independent review returned _approve with comments_: no CRITICAL, no HIGH, 6 MEDIUM and 8 LOW. MEDIUM 1–5 and LOW 4–8 were fixed, LOW 1 (stale documentation in `AGENTS.md`, `docs/TESTING.md` and the six skill matrices) was fixed by the `architect`, MEDIUM 6 (the global 120 s budget) was accepted with a reason. The review's findings and their disposition are in `003-independent-review.md`. |
| 2026-11-16 | **A defect the review could not see** | The first live run against the real daemon exposed the hole in the adopted M2 rework: removing a child image makes the daemon **re-commit its parent under a new id**, and that id is not in the build output — a single removal pass left five images of ~1.3 GB behind, holding the layer of the `npm ci` stage. The cleanup now runs in passes (the first pass removes the ids the builder reported, every pass after that the ids that appeared since the previous snapshot; the window is one pass, not the whole build). Red-before-green is pinned by a unit test with a fake daemon. |
| 2026-11-16 | **Rebased onto the integration head** | `git rebase integration/opencode-team` onto `9343787` (M2 Around The Clock, M3 Shanghai, the doc catch-up) — conflict-free. The integration head's `AGENTS.md` carried a paragraph that the change made wrong ("runs a **real** `docker build` … under a 900 s timeout"); it now states the opt-in rule and the 2 100 000 ms budget. The M2 game-mode files were not touched. |

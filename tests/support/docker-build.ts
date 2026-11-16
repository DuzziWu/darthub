import { spawn, type ChildProcess } from "node:child_process";
import { constants as osConstants } from "node:os";
import { runCommand } from "./run-command";

// --- Killable `docker build` ------------------------------------------------
//
// The live image build is by far the slowest check in the repository: it needs
// a reachable daemon, several minutes of wall clock and about 4 GB of disk on
// the daemon. It is therefore opt-in — `DART_DOCKER_BUILD=1` enables it — and
// the runner itself refuses to start a build without that flag. The refusal
// lives here and not only in the test, so a direct call cannot start a build
// either.
//
// The build runs as a normal child process of the vitest worker, so it stays
// in the worker's process group. `execSync` cannot do that: it blocks the
// event loop, so the parent cannot kill the build when its deadline passes —
// a build started that way stays behind as an orphan that keeps burning RAM
// and disk until it finishes on its own. See the spawn site below for why the
// child is deliberately NOT detached.

/** The environment variable that enables the live docker build. */
export const LIVE_BUILD_ENV_FLAG = "DART_DOCKER_BUILD";

/** The values of the opt-in flag that count as "enabled". */
const LIVE_FLAG_VALUES = new Set(["1", "true"]);

/** The exit code reported when no build process was started at all. */
const EXIT_CODE_NOT_STARTED = -1;

/** The time the build gets to react to SIGINT before it is killed. */
const SIGKILL_GRACE_MS = 10_000;

/** The time the output waits for the stdio streams to be flushed. */
const OUTPUT_FLUSH_GRACE_MS = 2_000;

/** Whether the live docker build was explicitly requested. */
export const isLiveBuildRequested = (env: NodeJS.ProcessEnv = process.env): boolean =>
  LIVE_FLAG_VALUES.has((env[LIVE_BUILD_ENV_FLAG] ?? "").trim().toLowerCase());

/** The reason the live docker build does not run — logged, never silent. */
export const liveBuildSkipReason = (env: NodeJS.ProcessEnv = process.env): string => {
  const value = (env[LIVE_BUILD_ENV_FLAG] ?? "").trim();
  const state =
    value.length > 0
      ? `${LIVE_BUILD_ENV_FLAG} is set to '${value}', which does not enable the live build`
      : `${LIVE_BUILD_ENV_FLAG} is not set`;
  return (
    `${state}: the live docker build is opt-in. It needs a reachable docker daemon, ` +
    `several minutes of build time and about 4 GB of disk on the daemon, so it only ` +
    `runs when ${LIVE_BUILD_ENV_FLAG}=1 is set in the environment.`
  );
};

export type DockerBuildOutcome = {
  /** False => no build process was spawned at all. */
  started: boolean;
  /** The exit code of the build, 128 + signal number when it was killed. */
  exitCode: number;
  /** The combined stdout and stderr of the build. */
  output: string;
  /** True => the deadline killed the build. */
  timedOut: boolean;
  /** How long the build ran. */
  durationMs: number;
  /** Why the build did not run (or why it could not start). */
  reason?: string;
  /** The pid of the build process — for the proof that it is gone. */
  pid?: number;
};

export type RunDockerBuildOptions = {
  /** The tag of the built image; part of the default command. */
  tag: string;
  /** The deadline for the build. */
  timeoutMs: number;
  /** The working directory of the build. */
  cwd?: string;
  /** The command to run — injectable for tests. */
  command?: string[];
  /** The environment the flag and the child process are read from. */
  env?: NodeJS.ProcessEnv;
  /** The time between the SIGINT and the SIGKILL — 10 s by default. */
  killGraceMs?: number;
};

// --- The process-level guard ------------------------------------------------
//
// While a build child is alive the guard is installed:
//   * "exit" covers a normal exit and an explicit `process.exit()`,
//   * "SIGINT" / "SIGTERM" cover a runner that terminates the vitest process.
// In all three cases the build process is killed, so no `docker build`
// survives the test run that started it. The handlers are removed again once
// the last child is gone, so a suite run without a live build keeps vitest's
// own signal behaviour untouched.

const liveChildren = new Set<ChildProcess>();
let guardInstalled = false;

/**
 * Kills the build process.
 *
 * The child is killed by its pid — never with `process.kill(-pid, …)`: the
 * negative pid addresses the process *group*, and the child shares the group
 * with the vitest worker, so that call would kill the test runner itself.
 */
const killChild = (child: ChildProcess, signal: NodeJS.Signals): void => {
  try {
    child.kill(signal);
  } catch {
    // The process is already gone — nothing to kill.
  }
};

const killAllLiveChildren = (): void => {
  for (const child of liveChildren) {
    killChild(child, "SIGKILL");
  }
};

const onProcessExit = (): void => {
  killAllLiveChildren();
};

const onSigint = (): void => {
  killAllLiveChildren();
  process.exit(128 + osConstants.signals.SIGINT);
};

const onSigterm = (): void => {
  killAllLiveChildren();
  process.exit(128 + osConstants.signals.SIGTERM);
};

const installGuard = (): void => {
  if (guardInstalled) {
    return;
  }
  guardInstalled = true;
  process.on("exit", onProcessExit);
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
};

const uninstallGuard = (): void => {
  if (!guardInstalled || liveChildren.size > 0) {
    return;
  }
  guardInstalled = false;
  process.removeListener("exit", onProcessExit);
  process.removeListener("SIGINT", onSigint);
  process.removeListener("SIGTERM", onSigterm);
};

/** A cancellable wait, used to bound the output flush and the kill escalation. */
const wait = (ms: number): { promise: Promise<void>; cancel: () => void } => {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<void>((resolveWait) => {
    timer = setTimeout(resolveWait, ms);
  });
  return {
    promise,
    cancel: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    },
  };
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
export const runDockerBuild = async (
  options: RunDockerBuildOptions,
): Promise<DockerBuildOutcome> => {
  const env = options.env ?? process.env;
  const startedAt = Date.now();

  if (!isLiveBuildRequested(env)) {
    return {
      started: false,
      exitCode: EXIT_CODE_NOT_STARTED,
      output: "",
      timedOut: false,
      durationMs: 0,
      reason: liveBuildSkipReason(env),
    };
  }

  const command = options.command ?? ["docker", "build", "-t", options.tag, "."];
  const [executable, ...commandArgs] = command;
  if (executable === undefined) {
    return {
      started: false,
      exitCode: EXIT_CODE_NOT_STARTED,
      output: "",
      timedOut: false,
      durationMs: Date.now() - startedAt,
      reason: "the build command is empty",
    };
  }
  const cwd = options.cwd ?? process.cwd();

  let output = "";
  let timedOut = false;
  let spawnError: Error | undefined;

  const child: ChildProcess = spawn(executable, commandArgs, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    // NOT detached: the build must stay in the process group of the vitest
    // worker that started it. A runner that terminates a task by killing its
    // process group reaches the build with it — a detached build would sit
    // in a group of its own, survive the group kill and become exactly the
    // orphan this runner is meant to prevent. The same holds for Ctrl-C in a
    // terminal: the SIGINT reaches the foreground process group, so the
    // docker CLI cancels the build on the daemon side instead of running on.
    detached: false,
    env: { ...process.env, ...options.env },
  });

  liveChildren.add(child);
  installGuard();

  const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveExit) => {
      child.once("error", (error: Error) => {
        spawnError = error;
        resolveExit({ code: null, signal: null });
      });
      child.once("exit", (code, signal) => {
        resolveExit({ code, signal });
      });
    },
  );

  const closedPromise = new Promise<void>((resolveClose) => {
    child.once("close", () => resolveClose());
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf-8");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf-8");
  });

  let graceTimer: NodeJS.Timeout | undefined;
  const deadlineTimer = setTimeout(() => {
    timedOut = true;
    // SIGINT: the docker CLI cancels the build on the daemon side, so the
    // daemon does not keep building in the background.
    killChild(child, "SIGINT");
    graceTimer = setTimeout(() => {
      killChild(child, "SIGKILL");
    }, options.killGraceMs ?? SIGKILL_GRACE_MS);
  }, options.timeoutMs);

  const exitInfo = await exitPromise;
  clearTimeout(deadlineTimer);
  if (graceTimer !== undefined) {
    clearTimeout(graceTimer);
  }

  // The output is complete when the stdio streams are closed. A grandchild
  // that inherited them can keep them open, so the wait is bounded.
  const flushWait = wait(OUTPUT_FLUSH_GRACE_MS);
  await Promise.race([closedPromise, flushWait.promise]);
  flushWait.cancel();

  // The child must be dead when this promise settles. If the handle does not
  // know about the exit, the process is killed once more.
  if (child.exitCode === null && child.signalCode === null) {
    killChild(child, "SIGKILL");
    const exitWait = wait(OUTPUT_FLUSH_GRACE_MS);
    await Promise.race([exitPromise, exitWait.promise]);
    exitWait.cancel();
  }

  liveChildren.delete(child);
  uninstallGuard();

  const exitCode =
    exitInfo.code ??
    (exitInfo.signal === null
      ? EXIT_CODE_NOT_STARTED
      : 128 + (osConstants.signals[exitInfo.signal] ?? 0));

  return {
    started: spawnError === undefined,
    exitCode,
    output,
    timedOut,
    durationMs: Date.now() - startedAt,
    ...(spawnError === undefined
      ? {}
      : { reason: `the build process could not be started: ${spawnError.message}` }),
    ...(child.pid === undefined ? {} : { pid: child.pid }),
  };
};

// --- Image hygiene ----------------------------------------------------------
//
// The legacy builder commits every stage of the Dockerfile as an own image and
// keeps it: after the build the intermediate stages are untagged images on the
// daemon, and nothing but an explicit `docker rmi` removes them. A build of
// this Dockerfile leaves several gigabytes of intermediate layers behind (the
// `npm ci` stage alone is larger than the final image), so a handful of runs
// fill the disk — and the next build then dies with "no space left on
// device". That fails a test for a reason that has nothing to do with the
// code under test.
//
// The build prints the id of every image it creates ("---> <id>") and marks
// the steps it took from the cache ("Using cache"), so the cleanup can tell
// the two apart:
//
//   * the images the build created are removed with it — they are the leak,
//   * the cached images stay: they belong to the shared cache of the daemon
//     and to the builds that run at the same time. Removing them would take
//     the snapshot of a cached layer away from a build that is using it.
//
// The images are removed from the top of the chain downwards, because the
// daemon refuses to delete an image that still has a dependent child image.
//
// ONE EXCEPTION: a build that died on a broken cache chain ("NotFound: parent
// snapshot ... does not exist") removes the cached images of that attempt as
// well — see `brokenChainImageIds`. The chain they belong to is already
// broken, so it is useless to everyone, and the retry needs it gone. That is
// the only path on which a cached image is removed.

/** The blocks the builder printed per step, without the step headline. */
export const parseBuildSteps = (buildOutput: string): string[] =>
  buildOutput.split(/^Step \d+\/\d+ : /m).slice(1);

/** The id of the image a step ended with, if the step produced one. */
export const stepImageId = (step: string): string | undefined => {
  const ids = [...step.matchAll(/^\s*--->\s+([0-9a-f]{12,64})\s*$/gm)].map((match) => match[1]);
  return ids.at(-1);
};

/** The ids of the images the build took from the cache. */
export const parseCachedImageIds = (buildOutput: string): string[] =>
  parseBuildSteps(buildOutput)
    .filter((step) => step.includes("Using cache"))
    .map(stepImageId)
    .filter((id): id is string => id !== undefined);

/** The ids of the images the build created itself. */
export const parseCreatedImageIds = (buildOutput: string): string[] =>
  parseBuildSteps(buildOutput)
    .filter((step) => !step.includes("Using cache"))
    .map(stepImageId)
    .filter((id): id is string => id !== undefined);

/**
 * The ids of the containers the build left behind.
 *
 * The builder removes the container of a successful step itself ("---> Removed
 * intermediate container <id>"), but a failed step leaves its container
 * behind, and with it the writable layer of the step. Only the containers
 * without a removal line are still there.
 */
export const parseBuildContainerIds = (buildOutput: string): string[] => {
  const removed = new Set(
    [...buildOutput.matchAll(/^\s*--->\s+Removed intermediate container ([0-9a-f]{12,64})\s*$/gm)]
      .map((match) => match[1])
      .filter((id): id is string => id !== undefined),
  );
  const ids: string[] = [];
  for (const match of buildOutput.matchAll(/^\s*--->\s+Running in ([0-9a-f]{12,64})\s*$/gm)) {
    const id = match[1];
    if (id !== undefined && !removed.has(id) && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
};

/**
 * The ids of the images of a build that died on a broken cache chain.
 *
 * The cached images of the failed attempt are part of the list: the chain
 * they belong to is broken — the store took the snapshot of a cached layer
 * away — so it is useless to every build that would use it, and the retry
 * needs it gone. This is the one path on which a cached image is removed.
 */
export const brokenChainImageIds = (buildOutput: string): string[] => [
  ...parseCachedImageIds(buildOutput),
  ...parseCreatedImageIds(buildOutput),
];

/**
 * Whether the build ran with BuildKit.
 *
 * BuildKit prints neither the "Step n/m :" headlines nor the "---> <id>"
 * lines of the legacy builder, so the image cleanup of the legacy builder
 * does not apply to its output. That is harmless: BuildKit leaves no
 * intermediate images behind. It matters for the broken-chain retry as well:
 * the error it looks for never appears in a BuildKit build.
 */
export const isBuildKitBuildOutput = (buildOutput: string): boolean =>
  /(?:^|[\r\n])#\d+/.test(buildOutput);

/**
 * Whether the build died because another build broke the shared cache chain
 * of the daemon: the store took the snapshot of a cached layer away, and the
 * build that uses that cache entry dies with "NotFound: parent snapshot ...
 * does not exist".
 */
export const isBrokenCacheChain = (buildOutput: string): boolean =>
  /parent snapshot .* does not exist/.test(buildOutput);

export type DockerCliResult = {
  exitCode: number;
  output: string;
  /** True when the command was killed because it exceeded its timeout. */
  timedOut?: boolean;
};

export type DockerCliRunner = (args: string[]) => DockerCliResult;

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * The budget of a single docker CLI call. The commands of the cleanup are
 * queries (`docker info`, `docker image ls`) and removals of images and
 * containers that the daemon knows already — none of them builds anything.
 * The bound matters because `execSync` blocks the event loop: a hanging
 * daemon would block the worker past every vitest timeout, because none of
 * them can fire while the loop is blocked.
 */
const DOCKER_CLI_TIMEOUT_MS = 30_000;

/** Runs a docker command and captures its status and combined output. */
export const runDockerCli: DockerCliRunner = (args) =>
  runCommand(["docker", ...args].map(shellQuote).join(" "), undefined, DOCKER_CLI_TIMEOUT_MS);

/**
 * The ids of the images that carry a repository:tag — the shared ones.
 *
 * `docker image ls -q` lists exactly those; `docker image ls -a -q` would
 * additionally list the dangling intermediate images, and those are the leak
 * the cleanup has to remove.
 */
export const listTaggedImageIds = (runner: DockerCliRunner = runDockerCli): string[] => {
  const ids = runner(["image", "ls", "-q"])
    .output.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return [...new Set(ids)];
};

/** A tagged image belongs to the daemon, not to this build. */
export const isSharedImage = (taggedImageIds: string[], id: string): boolean =>
  taggedImageIds.some((tagged) => tagged === id || tagged.startsWith(id) || id.startsWith(tagged));

/** Removes the given image ids, newest first, and ignores the ones that go. */
export const removeImageIds = (
  taggedImageIds: string[],
  ids: string[],
  runner: DockerCliRunner = runDockerCli,
): void => {
  for (const id of [...new Set(ids)].reverse()) {
    if (isSharedImage(taggedImageIds, id)) {
      continue;
    }
    runner(["rmi", id]);
  }
};

/** Removes the containers a build left behind. */
export const removeBuildContainers = (
  containerIds: string[],
  runner: DockerCliRunner = runDockerCli,
): void => {
  for (const id of containerIds) {
    runner(["rm", id]);
  }
};

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  brokenChainImageIds,
  isBrokenCacheChain,
  isBuildKitBuildOutput,
  isLiveBuildRequested,
  isSharedImage,
  listAllImageIds,
  listTaggedImageIds,
  parseBuildContainerIds,
  parseBuildSteps,
  parseCachedImageIds,
  parseCreatedImageIds,
  removeBuildImages,
  removeImageIds,
  runDockerBuild,
  LIVE_BUILD_ENV_FLAG,
  type DockerCliRunner,
} from "../support/docker-build";
import { runCommand } from "../support/run-command";

// --- The docker shim --------------------------------------------------------
//
// The shim replaces the docker CLI for the child runs below: it records every
// invocation and answers with the small protocol the dockerignore suite uses.
// It is the proof that the default suite run does not build the image — the
// real daemon would happily build it, and the whole point of the opt-in is
// that nobody has to wait for it.

const SHIM_LOG_ENV = "DART_DOCKER_SHIM_LOG";

const DOCKER_SHIM = [
  "#!/bin/sh",
  "# Test double for the docker CLI: records every invocation and answers",
  "# with the protocol the dockerignore suite uses.",
  'printf "%s\\n" "$*" >> "$DART_DOCKER_SHIM_LOG"',
  'case "$1" in',
  "  info)",
  "    exit 0",
  "    ;;",
  "  build)",
  "    cat <<'BUILD_OUTPUT'",
  "DEPRECATED: The legacy builder is deprecated and will be removed in a future release.",
  "Sending build context to Docker daemon   1.69MB",
  "Step 1/3 : FROM node:22-alpine AS deps",
  " ---> Using cache",
  " ---> 1314fb30ec37",
  "Step 2/3 : WORKDIR /app",
  " ---> Running in 2778a181b2a7",
  " ---> Removed intermediate container 2778a181b2a7",
  " ---> bd5d5038d1c1",
  "Step 3/3 : COPY . .",
  " ---> 31842dfd8de2",
  "Successfully built 31842dfd8de2",
  "BUILD_OUTPUT",
  "    exit 0",
  "    ;;",
  "  image)",
  '    if [ "$2" = "inspect" ]; then',
  "      echo 104857600",
  "    fi",
  "    exit 0",
  "    ;;",
  "  rmi|rm)",
  "    exit 0",
  "    ;;",
  "esac",
  "exit 0",
  "",
].join("\n");

const repoRoot = path.resolve(import.meta.dirname, "../..");
const vitestCli = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
const suitePath = "tests/unit/dockerignore.test.ts";

// The sandbox lives outside the repository, so the create/delete cycle of the
// shim can never disturb a concurrent test run.
const shimDir = mkdtempSync(path.join(tmpdir(), "darthub-docker-shim-"));
const shimPath = path.join(shimDir, "docker");
writeFileSync(shimPath, DOCKER_SHIM, { mode: 0o755 });
chmodSync(shimPath, 0o755);

afterAll(() => {
  rmSync(shimDir, { recursive: true, force: true });
});

type VitestReport = {
  testResults?: Array<{
    name?: string;
    status?: string;
    assertionResults?: Array<{ fullName?: string; status?: string }>;
  }>;
};

type ChildRun = {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  shimLog: string;
  report: VitestReport | null;
};

/**
 * The environment of the child run: the shim directory comes first on the
 * PATH, the vitest variables are removed (the child must not think it is a
 * vitest worker) and the opt-in flag is set only for the live run.
 */
const childEnv = (liveBuild: boolean, logFile: string): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITEST") || key === "TEST") {
      delete env[key];
    }
  }
  delete env[LIVE_BUILD_ENV_FLAG];
  if (liveBuild) {
    env[LIVE_BUILD_ENV_FLAG] = "1";
  }
  env.PATH = `${shimDir}${path.delimiter}${env.PATH ?? ""}`;
  env[SHIM_LOG_ENV] = logFile;
  return env;
};

/** Runs the dockerignore suite in a child process, with the shim in place. */
const runSuiteAsChild = (options: { liveBuild: boolean }): ChildRun => {
  const label = options.liveBuild ? "live" : "default";
  const logFile = path.join(shimDir, `shim-${label}.log`);
  const reportFile = path.join(shimDir, `report-${label}.json`);
  writeFileSync(logFile, "");

  const result = spawnSync(
    process.execPath,
    [vitestCli, "run", suitePath, "--reporter=json", `--outputFile=${reportFile}`],
    {
      cwd: repoRoot,
      env: childEnv(options.liveBuild, logFile),
      encoding: "utf-8",
      timeout: 120_000,
      // The default of 1 MB aborts the child with an opaque ENOBUFS; the
      // report of a child run is small, but the budget is explicit.
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  const report = existsSync(reportFile)
    ? (JSON.parse(readFileSync(reportFile, "utf-8")) as VitestReport)
    : null;

  return {
    exitCode: result.status ?? -1,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    shimLog: readFileSync(logFile, "utf-8"),
    report,
  };
};

/** The state of the live docker build test in the report of a child run. */
const liveTestStatus = (run: ChildRun): string | undefined =>
  run.report?.testResults?.[0]?.assertionResults?.find((assertion) =>
    assertion.fullName?.includes("docker build respects the ignore file"),
  )?.status;

// --- The recorded legacy-builder output -------------------------------------
//
// A real output of the legacy builder (this daemon has no buildx plugin) that
// failed with a broken cache chain. It reproduces the numbers the cleanup was
// measured with: 8 steps, 4 cached images, 3 created images and 1 container
// left behind by the failed step. The container of step 7 was removed by the
// builder itself — only the container of the failed step is still there.

const LEGACY_BUILD_OUTPUT = [
  "DEPRECATED: The legacy builder is deprecated and will be removed in a future release.",
  "            Install the buildx component to build images with BuildKit:",
  "            https://docs.docker.com/go/buildx/",
  "",
  "Sending build context to Docker daemon   1.69MB",
  "Step 1/8 : FROM node:22-alpine AS deps",
  " ---> 1314fb30ec37",
  "Step 2/8 : WORKDIR /app",
  " ---> Using cache",
  " ---> e44a4a36277f",
  "Step 3/8 : COPY package.json package-lock.json ./",
  " ---> Using cache",
  " ---> 5772e1fe1f59",
  "Step 4/8 : RUN npm ci",
  " ---> Using cache",
  " ---> e44a4a36277f",
  "Step 5/8 : FROM node:22-alpine AS builder",
  " ---> Using cache",
  " ---> 3b021da7590f",
  "Step 6/8 : COPY --from=deps /app/node_modules ./node_modules",
  " ---> bd5d5038d1c1",
  "Step 7/8 : RUN npx prisma generate",
  " ---> Running in 2778a181b2a7",
  " ---> Removed intermediate container 2778a181b2a7",
  " ---> 1314fb30ec37",
  "Step 8/8 : RUN npm run build",
  " ---> Running in 6b5a4c3d2e1f",
  "NotFound: parent snapshot sha256:b8c3e07e96676bcf7ed3c5092657af6fea7ec522bda498a74fb20d9bf720cae5 does not exist: not found",
  "",
].join("\n");

// --- A recorded BuildKit output ---------------------------------------------
//
// The GitHub runners have buildx, so CI builds with BuildKit. Its output has
// neither the "Step n/m :" headlines nor the "---> <id>" lines of the legacy
// builder.

const BUILDKIT_BUILD_OUTPUT = [
  "#1 [internal] load build definition from Dockerfile",
  "#2 [internal] load metadata for docker.io/library/node:22-alpine",
  "#3 [builder 1/4] FROM docker.io/library/node:22-alpine",
  "#4 [builder 2/4] RUN npm ci",
  "#5 [builder 3/4] COPY . .",
  "#6 [builder 4/4] RUN npm run build",
  "#6 DONE 45.2s",
  "",
  "naming to darthub:dockerignore-test-4711 done",
  "",
].join("\n");

/** Whether the process is gone: a pid that no longer exists throws ESRCH. */
const processGone = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
};

// --- A fake daemon ----------------------------------------------------------
//
// The daemon re-commits the parent of a removed image under a new id. The
// fake models that behaviour: `rmi` removes the id and re-commits its
// parent, and `image ls -a -q` reports the images that are on the daemon.

type FakeDaemon = {
  runner: DockerCliRunner;
  /** The dangling images on the daemon, in the order they appeared. */
  images: Map<string, string | undefined>;
  /** The tagged images on the daemon — the shared ones. */
  tagged: Set<string>;
  calls: string[][];
};

type FakeDaemonOptions = {
  /** The dangling images, each with the id of its parent (the base has none). */
  chain?: Array<{ id: string; parent?: string }>;
  /** The tagged images of the daemon. */
  tagged?: string[];
  /** An image that appears while the first removal runs. */
  addedDuringRemoval?: string;
};

const createFakeDaemon = (options: FakeDaemonOptions = {}): FakeDaemon => {
  const images = new Map<string, string | undefined>();
  for (const entry of options.chain ?? []) {
    images.set(entry.id, entry.parent);
  }
  const tagged = new Set(options.tagged ?? []);
  const calls: string[][] = [];
  let recommits = 0;
  let removalRuns = 0;

  const runner: DockerCliRunner = (args) => {
    calls.push(args);
    if (args[0] === "image" && args[1] === "ls") {
      // The tagged set is the shared one; `-a` adds the dangling images.
      const ids = args.includes("-a") ? [...tagged, ...images.keys()] : [...tagged];
      return { exitCode: 0, output: ids.join("\n") };
    }
    if (args[0] === "rmi") {
      removalRuns += 1;
      if (removalRuns === 1 && options.addedDuringRemoval !== undefined) {
        images.set(options.addedDuringRemoval, undefined);
      }
      const id = args[1] ?? "";
      if (!images.has(id)) {
        return { exitCode: 1, output: `Error response from daemon: No such image: ${id}` };
      }
      const parent = images.get(id);
      images.delete(id);
      // The daemon materialises the parent of the removed image again — under
      // a new id, which is not in the build output.
      if (parent !== undefined && images.has(parent)) {
        const grandParent = images.get(parent);
        images.delete(parent);
        recommits += 1;
        images.set(`deadbeef00${String(recommits).padStart(2, "0")}`, grandParent);
      }
      return { exitCode: 0, output: "" };
    }
    return { exitCode: 0, output: "" };
  };

  return { runner, images, tagged, calls };
};

/** The calls that listed the images of the daemon, tagged and dangling. */
const snapshotCalls = (calls: string[][]): string[][] =>
  calls.filter((call) => call[0] === "image" && call[1] === "ls" && call.includes("-a"));

describe("dockerignore build gate", () => {
  it("starts no docker build in the default suite run", { timeout: 180_000 }, () => {
    const run = runSuiteAsChild({ liveBuild: false });

    expect(
      run.exitCode,
      `the suite run failed (signal ${run.signal}):\n${run.stdout}\n${run.stderr}`,
    ).toBe(0);

    // The default run must not even talk to the daemon: the shim records
    // every invocation, so an empty log proves that nothing was executed.
    expect(run.shimLog.trim(), "the default run invoked the docker CLI").toBe("");

    // The skip is visible: the test is reported as skipped, not silently
    // dropped.
    expect(liveTestStatus(run), "the live docker build test must be skipped").toBe("skipped");
  });

  it("starts the docker build when the opt-in flag is set", { timeout: 180_000 }, () => {
    const run = runSuiteAsChild({ liveBuild: true });

    expect(
      run.exitCode,
      `the suite run failed (signal ${run.signal}):\n${run.stdout}\n${run.stderr}`,
    ).toBe(0);

    expect(run.shimLog, "the live run did not start a docker build").toMatch(/^build /m);
    expect(liveTestStatus(run), "the live docker build test did not run").toBe("passed");
  });
});

describe("docker build runner", () => {
  // Next.js declares `NODE_ENV` as a required member of `NodeJS.ProcessEnv`,
  // so an environment is always built from the ambient one.
  const envWithoutFlag = (): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env[LIVE_BUILD_ENV_FLAG];
    return env;
  };

  const envWithFlag = (value: string): NodeJS.ProcessEnv => ({
    ...process.env,
    [LIVE_BUILD_ENV_FLAG]: value,
  });

  it("reads the opt-in flag", () => {
    expect(isLiveBuildRequested(envWithoutFlag())).toBe(false);
    expect(isLiveBuildRequested(envWithFlag("0"))).toBe(false);
    expect(isLiveBuildRequested(envWithFlag(""))).toBe(false);
    expect(isLiveBuildRequested(envWithFlag("1"))).toBe(true);
    expect(isLiveBuildRequested(envWithFlag("true"))).toBe(true);
    expect(isLiveBuildRequested(envWithFlag("TRUE"))).toBe(true);
  });

  it("starts no build without the opt-in flag", async () => {
    const marker = path.join(shimDir, "must-not-be-created");
    const outcome = await runDockerBuild({
      tag: "darthub:never",
      timeoutMs: 5_000,
      // The flag is missing, so the runner must refuse — whatever command it
      // is given.
      env: envWithoutFlag(),
      command: [
        process.execPath,
        "-e",
        `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "started")`,
      ],
    });

    expect(outcome.started, "the runner started a build without the opt-in flag").toBe(false);
    expect(outcome.reason).toContain(LIVE_BUILD_ENV_FLAG);
    expect(existsSync(marker), "the command ran although the build was refused").toBe(false);
  });

  it("kills a build that exceeds its deadline and leaves no orphan", async () => {
    const outcome = await runDockerBuild({
      tag: "darthub:never",
      timeoutMs: 1_000,
      env: envWithFlag("1"),
      command: [process.execPath, "-e", "setTimeout(() => {}, 60000)"],
    });

    expect(outcome.started).toBe(true);
    expect(outcome.timedOut, "the deadline did not kill the build").toBe(true);
    expect(outcome.pid).toBeDefined();

    // The proof that nothing is left behind: the process is gone when the
    // promise settles. `process.kill(pid, 0)` throws ESRCH for a pid that no
    // longer exists.
    expect(processGone(outcome.pid as number), "the build process is still alive").toBe(true);
  });

  it("escalates to SIGKILL when the build ignores SIGINT", async () => {
    const outcome = await runDockerBuild({
      tag: "darthub:never",
      timeoutMs: 500,
      killGraceMs: 500,
      env: envWithFlag("1"),
      // The child ignores SIGINT from its first instruction: `trap "" INT`
      // sets the signal disposition to "ignore", and that disposition
      // survives the exec. A node child would reset it — node installs its
      // own SIGINT handling at startup.
      command: ["/bin/sh", "-c", `trap "" INT; exec sleep 600`],
    });

    expect(outcome.started).toBe(true);
    expect(outcome.timedOut, "the deadline did not kill the build").toBe(true);
    // 128 + the number of SIGKILL.
    expect(outcome.exitCode, "the build was not killed with SIGKILL").toBe(137);
    expect(processGone(outcome.pid as number), "the build process is still alive").toBe(true);
  });

  it("installs the process guard only while the build is alive", async () => {
    const sigintBefore = process.listenerCount("SIGINT");
    const sigtermBefore = process.listenerCount("SIGTERM");
    const exitBefore = process.listenerCount("exit");

    // The runner spawns the child and installs its guard before it awaits
    // anything, so the guard is in place while the build runs.
    const pending = runDockerBuild({
      tag: "darthub:never",
      timeoutMs: 1_000,
      env: envWithFlag("1"),
      command: [process.execPath, "-e", "setTimeout(() => {}, 60000)"],
    });

    expect(process.listenerCount("SIGINT")).toBe(sigintBefore + 1);
    expect(process.listenerCount("SIGTERM")).toBe(sigtermBefore + 1);
    expect(process.listenerCount("exit")).toBe(exitBefore + 1);

    await pending;

    // The guard is removed again, so a suite run without a live build keeps
    // vitest's own signal behaviour untouched.
    expect(process.listenerCount("SIGINT")).toBe(sigintBefore);
    expect(process.listenerCount("SIGTERM")).toBe(sigtermBefore);
    expect(process.listenerCount("exit")).toBe(exitBefore);
  });
});

describe("docker cli bound", () => {
  it("reports a command that exceeds its timeout as a failure with its output", () => {
    // `execSync` blocks the event loop, so a hanging daemon would block the
    // worker past every vitest timeout. The timeout turns the hang into a
    // visible failure.
    const result = runCommand("echo partial-output; sleep 5", undefined, 700);

    expect(
      result.exitCode,
      "a command that exceeded its timeout must not look successful",
    ).not.toBe(0);
    expect(result.timedOut, "the timeout was not reported").toBe(true);
    expect(result.output, "the output produced so far must be kept").toContain("partial-output");
  });
});

describe("docker build output parsers", () => {
  it("separates the created images from the cached ones", () => {
    expect(parseBuildSteps(LEGACY_BUILD_OUTPUT)).toHaveLength(8);
    expect(parseCachedImageIds(LEGACY_BUILD_OUTPUT)).toEqual([
      "e44a4a36277f",
      "5772e1fe1f59",
      "e44a4a36277f",
      "3b021da7590f",
    ]);
    expect(parseCreatedImageIds(LEGACY_BUILD_OUTPUT)).toEqual([
      "1314fb30ec37",
      "bd5d5038d1c1",
      "1314fb30ec37",
    ]);
  });

  it("collects only the container that the failed step left behind", () => {
    // The builder removed the container of step 7 itself ("---> Removed
    // intermediate container"), only the container of the failed step is
    // still on the daemon.
    expect(parseBuildContainerIds(LEGACY_BUILD_OUTPUT)).toEqual(["6b5a4c3d2e1f"]);
    expect(parseBuildContainerIds(LEGACY_BUILD_OUTPUT)).not.toContain("2778a181b2a7");
  });

  it("hands the cached images of the failed attempt to the broken-chain retry", () => {
    // The one path on which a cached image is removed: the chain it belongs
    // to is already broken.
    expect(brokenChainImageIds(LEGACY_BUILD_OUTPUT)).toEqual([
      "e44a4a36277f",
      "5772e1fe1f59",
      "e44a4a36277f",
      "3b021da7590f",
      "1314fb30ec37",
      "bd5d5038d1c1",
      "1314fb30ec37",
    ]);
    expect(brokenChainImageIds(LEGACY_BUILD_OUTPUT)).toContain("e44a4a36277f");
  });

  it("recognises a broken cache chain", () => {
    expect(isBrokenCacheChain(LEGACY_BUILD_OUTPUT)).toBe(true);
    expect(isBrokenCacheChain("Successfully built 31842dfd8de2")).toBe(false);
  });

  it("recognises a BuildKit build", () => {
    expect(isBuildKitBuildOutput(BUILDKIT_BUILD_OUTPUT)).toBe(true);
    expect(isBuildKitBuildOutput(LEGACY_BUILD_OUTPUT)).toBe(false);
  });

  it("takes the shared set from the tagged images only", () => {
    const calls: string[][] = [];
    const runner = (args: string[]) => {
      calls.push(args);
      return { exitCode: 0, output: "1314fb30ec37\n94e9e444bcba\n" };
    };

    expect(listTaggedImageIds(runner)).toEqual(["1314fb30ec37", "94e9e444bcba"]);
    // `docker image ls -a` would list the dangling intermediate images as
    // well, and those are the leak the cleanup has to remove.
    expect(calls).toEqual([["image", "ls", "-q"]]);
  });

  it("never removes an image that carries a repository:tag", () => {
    const calls: string[][] = [];
    const runner = (args: string[]) => {
      calls.push(args);
      return { exitCode: 0, output: "" };
    };

    removeImageIds(["1314fb30ec37", "94e9e444bcba"], ["bd5d5038d1c1", "1314fb30ec37"], runner);

    expect(calls).toEqual([["rmi", "bd5d5038d1c1"]]);
  });

  it("matches a tagged image id that is longer than the created one", () => {
    // The daemon prints the full id in some commands and the short one in
    // others, so the comparison has to work in both directions.
    const fullId = "b8c3e07e96676bcf7ed3c5092657af6fea7ec522bda498a74fb20d9bf720cae5";

    expect(isSharedImage([fullId], "b8c3e07e9667")).toBe(true);
    expect(isSharedImage([fullId], fullId)).toBe(true);
    expect(isSharedImage([fullId], "bd5d5038d1c1")).toBe(false);
    expect(isSharedImage(["bd5d5038d1c1"], "bd5d5038d1c1")).toBe(true);
  });
});

describe("docker image cleanup", () => {
  it("removes the images the daemon re-commits while it removes them", () => {
    // A chain of four images: the oldest is the base, the newest the top.
    // Removing the top makes the daemon re-commit its parent under a new id,
    // and that id is not in the build output — a single pass would leave the
    // chain behind.
    const daemon = createFakeDaemon({
      chain: [
        { id: "aaaaaaaaaaaa" },
        { id: "bbbbbbbbbbbb", parent: "aaaaaaaaaaaa" },
        { id: "cccccccccccc", parent: "bbbbbbbbbbbb" },
        { id: "dddddddddddd", parent: "cccccccccccc" },
      ],
      tagged: ["111111111111"],
    });

    removeBuildImages(
      ["111111111111"],
      ["aaaaaaaaaaaa", "bbbbbbbbbbbb", "cccccccccccc", "dddddddddddd"],
      daemon.runner,
    );

    expect([...daemon.images.keys()], "the chain of the build must be gone").toEqual([]);
    expect(
      snapshotCalls(daemon.calls).length,
      "the loop must run in more than one pass",
    ).toBeGreaterThan(2);
  });

  it("stops after the first pass when the daemon re-commits nothing", () => {
    const daemon = createFakeDaemon({
      // Two images without a parent relation: removing them re-commits
      // nothing.
      chain: [{ id: "aaaaaaaaaaaa" }, { id: "bbbbbbbbbbbb" }],
      tagged: ["111111111111"],
    });

    removeBuildImages(["111111111111"], ["aaaaaaaaaaaa", "bbbbbbbbbbbb"], daemon.runner);

    expect([...daemon.images.keys()]).toEqual([]);
    // One snapshot before the first removal and one after it — a single
    // removal pass.
    expect(snapshotCalls(daemon.calls)).toHaveLength(2);
    // The shared images are never removed.
    expect(
      daemon.calls.filter((call) => call[0] === "rmi"),
      "a tagged image must never be removed",
    ).toEqual([
      ["rmi", "bbbbbbbbbbbb"],
      ["rmi", "aaaaaaaaaaaa"],
    ]);
  });

  it("never removes an image that is not part of the build", () => {
    const daemon = createFakeDaemon({
      chain: [{ id: "aaaaaaaaaaaa" }, { id: "ffffffffffff" }],
      tagged: ["111111111111"],
    });

    removeBuildImages(["111111111111"], ["aaaaaaaaaaaa"], daemon.runner);

    expect([...daemon.images.keys()], "the foreign image must survive").toEqual(["ffffffffffff"]);
  });

  it("removes an image that appears during a removal pass", () => {
    // The honest rule of the loop: it removes what appeared since the
    // previous snapshot, and the snapshot is taken once per pass. An image
    // that a concurrent build commits during a pass is therefore removed as
    // well. The window is one pass (seconds), not the whole build (minutes) —
    // the wider window is what breaks the builds of other tasks.
    const daemon = createFakeDaemon({
      chain: [{ id: "aaaaaaaaaaaa" }],
      tagged: ["111111111111"],
      addedDuringRemoval: "eeeeeeeeeeee",
    });

    removeBuildImages(["111111111111"], ["aaaaaaaaaaaa"], daemon.runner);

    expect(
      [...daemon.images.keys()],
      "the id of the concurrent build is swept with the pass",
    ).toEqual([]);
  });

  it("keeps the tagged set apart from the dangling one", () => {
    const daemon = createFakeDaemon({
      chain: [{ id: "aaaaaaaaaaaa" }],
      tagged: ["111111111111"],
    });

    expect(listTaggedImageIds(daemon.runner)).toEqual(["111111111111"]);
    expect(listAllImageIds(daemon.runner)).toEqual(["111111111111", "aaaaaaaaaaaa"]);
  });
});

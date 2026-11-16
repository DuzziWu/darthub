import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  brokenChainImageIds,
  isBrokenCacheChain,
  isBuildKitBuildOutput,
  isLiveBuildRequested,
  listTaggedImageIds,
  liveBuildSkipReason,
  parseBuildContainerIds,
  parseCreatedImageIds,
  removeBuildContainers,
  removeImageIds,
  runDockerBuild,
  runDockerCli,
  LIVE_BUILD_ENV_FLAG,
} from "../support/docker-build";

// --- Minimal .dockerignore simulation ---------------------------------------
//
// Docker is not available in this environment, so the build context cannot be
// inspected live. Instead the entries in `.dockerignore` are resolved against
// the actual repository tree with a small hand-written matcher that covers the
// subset of `.gitignore` syntax used by `.dockerignore` files:
//
//   - `#` comments and blank lines are ignored
//   - a trailing `/` marks a directory (matched together with everything below)
//   - patterns containing a `/` are anchored to the context root
//   - `*`, `**` and `?` act as wildcards (`*` and `?` never cross a `/`)

type Rule = {
  raw: string;
  regex: RegExp;
};

const compileRule = (pattern: string): Rule => {
  const raw = pattern.trim().replace(/\/+$/, "");
  const anchored = pattern.includes("/");
  const body = raw
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*")
    .replace(/\?/g, "[^/]");
  if (anchored) {
    return { raw, regex: new RegExp(`^${body}(?:/.*)?$`) };
  }
  // Unanchored patterns match a single name at any directory depth.
  return { raw, regex: new RegExp(`(?:^|/)${body}(?:/.*)?$`) };
};

const parseIgnore = (content: string): Rule[] =>
  content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map(compileRule);

const isExcluded = (relativePath: string, rules: Rule[]): boolean =>
  rules.some((rule) => rule.regex.test(relativePath));

type SimulatedContext = {
  included: string[];
  excluded: string[];
};

// Walks the repository and prunes every directory that is already excluded, so
// `node_modules`, `.git` and `.next` are never actually traversed.
const simulateBuildContext = (root: string, rules: Rule[]): SimulatedContext => {
  const included: string[] = [];
  const excluded: string[] = [];

  const walk = (absoluteDir: string, relativeDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (isExcluded(relativePath, rules)) {
        excluded.push(relativePath);
        continue;
      }
      included.push(relativePath);
      if (entry.isDirectory()) {
        walk(resolve(absoluteDir, entry.name), relativePath);
      }
    }
  };

  walk(root, "");
  return { included: included.sort(), excluded: excluded.sort() };
};

// --- Fixtures ----------------------------------------------------------------

const ignorePath = resolve(process.cwd(), ".dockerignore");
const ignoreContent = readFileSync(ignorePath, "utf-8");
const rules = parseIgnore(ignoreContent);
const context = simulateBuildContext(process.cwd(), rules);

// Every pruned path ended up in `excluded` instead of `included`, so a path is
// out of the build context exactly when it never survived the walk.
const isBuildContextExcluded = (path: string): boolean => !context.included.includes(path);

// Files and directories that the builder stage (`npm ci` + `next build`) needs;
// the Dockerfile's `COPY . .` must not drop any of them out of the context.
const builderCriticalPaths = [
  "Dockerfile",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "app",
  "public",
  "src",
  "prisma",
  "prisma/schema.prisma",
  "app/layout.tsx",
  "app/page.tsx",
  "public/.gitkeep",
];

// --- The live build ---------------------------------------------------------
//
// The live build is opt-in: `DART_DOCKER_BUILD=1` enables it. The default
// suite run must not build the image — it needs a reachable daemon, several
// minutes of wall clock and about 4 GB of disk on the daemon, and the shared
// CI host runs several suites at the same time. The CI workflow verifies the
// image in a dedicated step (`tests/unit/ci-workflow.test.ts` guards it).

const liveBuildEnabled = isLiveBuildRequested();

const liveBuildTitle = liveBuildEnabled
  ? "docker build respects the ignore file and image size stays below 200 MB"
  : "docker build respects the ignore file and image size stays below 200 MB (skipped: set DART_DOCKER_BUILD=1 to run the live build)";

if (!liveBuildEnabled) {
  // A skip that nobody sees is a check that nobody runs: the reason is
  // logged, not swallowed.
  console.info(`[dockerignore] ${liveBuildSkipReason()}`);
}

// The budgets. The live build is slow, and this daemon has no buildx plugin,
// so the legacy builder runs. Its cache only helps for the steps whose chain
// is still on the daemon; the test removes the images it created, so the
// `npm ci` stage — the container downloads and unpacks the whole dependency
// tree — is rebuilt on every run.
//
// Measured on this machine (2 CPUs, 3.8 GB RAM):
//   * 422 s and 575 s without another build on the same daemon
//   * 836 s with one concurrent build, 923 s with one concurrent build while
//     the rest of the test suite competes for the same CPUs
//
// The deadline of the build is smaller than the timeout of the test, so the
// runner's own deadline fires first and produces a clean failure message
// instead of a vitest timeout that would leave the child running: the two
// attempts together get 1 800 000 ms, the test 2 100 000 ms.
const FIRST_ATTEMPT_TIMEOUT_MS = 1_200_000;
const RETRY_ATTEMPT_TIMEOUT_MS = 600_000;
const LIVE_TEST_TIMEOUT_MS = 2_100_000;

describe("dockerignore", () => {
  it("contains entries for node_modules, tests/, .git, .env, and other large folders", () => {
    const lines = new Set(
      ignoreContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#")),
    );

    for (const required of ["node_modules", "tests/", ".git", ".env*"]) {
      // A directory entry may be written with or without the directory marker.
      const bare = required.replace(/\/$/, "");
      expect(lines.has(bare) || lines.has(`${bare}/`), `expected a '${required}' entry`).toBe(true);
    }

    // "Other large folders": local caches, documentation and tooling state
    // that never belongs inside a production image build context.
    for (const largeFolder of [".next", "coverage", "docs", "reports", ".github", ".claude"]) {
      expect(
        lines.has(`${largeFolder}/`),
        `expected a '${largeFolder}/' entry for the large folder`,
      ).toBe(true);
    }

    // Build scratch state that is regenerated on demand.
    expect(lines.has("*.tsbuildinfo")).toBe(true);
    expect(lines.has("next-env.d.ts")).toBe(true);

    // The entries must actually exclude the real tree entries they name.
    for (const excludedPath of [
      "node_modules/next/index.js",
      "tests/unit/dockerignore.test.ts",
      ".git/config",
      ".next/server/app.js",
      "coverage/lcov-report/index.html",
      "docs/architecture.md",
      "reports/architecture-review.md",
      ".github/workflows/ci.yml",
      "tsconfig.tsbuildinfo",
      "next-env.d.ts",
    ]) {
      expect(isExcluded(excludedPath, rules), `expected '${excludedPath}' to be excluded`).toBe(
        true,
      );
    }

    // Secret files of any naming convention must stay out of the context.
    for (const secret of [".env", ".env.local", ".env.production"]) {
      expect(isExcluded(secret, rules), `expected '${secret}' to be excluded`).toBe(true);
    }
  });

  it("does not ignore files the builder stage needs", () => {
    for (const criticalPath of builderCriticalPaths) {
      expect(
        isExcluded(criticalPath, rules),
        `expected '${criticalPath}' to stay in the build context`,
      ).toBe(false);
    }

    // The simulated context must actually contain every real file below the
    // directories the builder imports from (app/, public/, src/, prisma/).
    for (const includedPath of context.included) {
      if (/^(app|public|src|prisma)\//.test(includedPath)) {
        expect(
          isExcluded(includedPath, rules),
          `builder-relevant file '${includedPath}' must not be excluded`,
        ).toBe(false);
      }
    }
    expect(
      context.included.some((path) => path.startsWith("src/")),
      "expected src/ files in the build context",
    ).toBe(true);
    expect(
      context.included.some((path) => path.startsWith("app/api/")),
      "expected app/api/ files in the build context",
    ).toBe(true);
  });

  it("keeps the heavyweight artifacts out of the build context", () => {
    // Structural level of verification (always executed): the simulated build
    // context, i.e. the repository tree filtered through `.dockerignore`, must
    // not contain the heavyweight artifacts that would otherwise end up in the
    // image or bloat the build.
    const mustNotBeInContext = [
      "node_modules",
      ".next",
      ".git",
      "coverage",
      ".claude",
      "docs",
      "reports",
      "tests",
    ];
    for (const heavyPath of mustNotBeInContext) {
      expect(
        isBuildContextExcluded(heavyPath),
        `expected '${heavyPath}' to be pruned from the build context`,
      ).toBe(true);
    }
    expect(
      context.included.some((path) => path.startsWith("node_modules/")),
      "no node_modules content may reach the build context",
    ).toBe(false);
    expect(
      context.included.some((path) => path.startsWith(".next/")),
      "no .next content may reach the build context",
    ).toBe(false);
  });

  it.skipIf(!liveBuildEnabled)(liveBuildTitle, { timeout: LIVE_TEST_TIMEOUT_MS }, async () => {
    // Live level of verification. The daemon is probed here and not
    // earlier: without the opt-in flag the default run must not talk to the
    // daemon at all. The user asked for the live build explicitly, so a
    // missing daemon is an error and not a silent skip.
    const daemon = runDockerCli(["info"]);
    expect(
      daemon.exitCode,
      `the live docker build was requested (${LIVE_BUILD_ENV_FLAG}=1) but the docker daemon is not reachable:\n${daemon.output}`,
    ).toBe(0);

    // The tag is unique per test process: two checkouts of this repository
    // (a worktree beside the main one, a CI job beside a local run) build
    // with the same daemon at the same time, and a shared tag makes them
    // delete each other's image — the second `docker image inspect` then
    // fails on an image the other run has already removed.
    const tag = `darthub:dockerignore-test-${process.pid}`;

    // The images that carry a repository:tag belong to the daemon and to the
    // builds that run at the same time; they are never removed.
    const taggedImageIds = listTaggedImageIds();

    // The build runs as a killable child process: the runner gives it a
    // deadline, terminates it when the deadline passes and guarantees that
    // it is gone when the promise settles.
    let build = await runDockerBuild({
      tag,
      timeoutMs: FIRST_ATTEMPT_TIMEOUT_MS,
      cwd: process.cwd(),
      env: process.env,
    });

    try {
      if (!build.started) {
        throw new Error(`the live docker build did not start: ${build.reason ?? "unknown reason"}`);
      }
      if (build.timedOut) {
        throw new Error(
          `the docker build exceeded its deadline of ${FIRST_ATTEMPT_TIMEOUT_MS} ms and was terminated:\n${build.output}`,
        );
      }

      // A build can fail for a reason that has nothing to do with the
      // .dockerignore file: the daemon shares its image store with the other
      // worktrees on this machine, and the legacy builder's cache is a chain
      // of images. When another build removes an image, the store can take
      // the snapshot of a cached layer away, and the next build that uses
      // that cache entry dies with "NotFound: parent snapshot ... does not
      // exist". A build that fails that way gets one retry: the broken
      // chain is removed with it, so the retry runs the steps again from the
      // base image — and the first attempt leaves nothing behind.
      //
      // This is the one path on which a CACHED image is removed: the chain
      // it belongs to is already broken, so it is useless to every build that
      // would use it. Everywhere else the cached images stay.
      if (build.exitCode !== 0 && isBrokenCacheChain(build.output)) {
        removeImageIds(taggedImageIds, brokenChainImageIds(build.output));
        removeBuildContainers(parseBuildContainerIds(build.output));

        build = await runDockerBuild({
          tag,
          timeoutMs: RETRY_ATTEMPT_TIMEOUT_MS,
          cwd: process.cwd(),
          env: process.env,
        });
      }

      expect(build.exitCode, `docker build exited with ${build.exitCode}:\n${build.output}`).toBe(
        0,
      );

      const size = runDockerCli(["image", "inspect", "-f", "{{.Size}}", tag]);
      expect(size.exitCode, `image inspection failed:\n${size.output}`).toBe(0);
      const sizeBytes = Number.parseInt(size.output.trim(), 10);
      expect(Number.isNaN(sizeBytes), `unexpected image size '${size.output}'`).toBe(false);
      expect(sizeBytes, `image size ${sizeBytes} bytes must stay below 200 MB`).toBeLessThan(
        200 * 1024 * 1024,
      );
    } finally {
      runDockerCli(["rmi", tag]);
      if (isBuildKitBuildOutput(build.output)) {
        // BuildKit prints neither the "Step n/m :" headlines nor the
        // "---> <id>" lines of the legacy builder, so there is nothing to
        // clean up: it leaves no intermediate images behind. The cleanup
        // below is simply a no-op here — said out loud, so nobody reads the
        // empty removal as a broken cleanup.
        console.info(
          "[dockerignore] the build ran with BuildKit: it leaves no intermediate images behind, so the legacy image cleanup does not apply to it",
        );
      }
      // The images the build created go with it. They are untagged images
      // that only an explicit removal deletes, and each build leaves
      // several gigabytes of them behind — the disk runs full after a
      // handful of runs and the next build fails with "no space left on
      // device". The images the build took from the cache stay: they are
      // the shared cache of the daemon and the builds that run at the same
      // time use them.
      removeImageIds(taggedImageIds, parseCreatedImageIds(build.output));
      removeBuildContainers(parseBuildContainerIds(build.output));
    }
  });
});

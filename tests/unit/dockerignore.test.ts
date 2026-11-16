import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { runCommand } from "../support/run-command";

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

// --- Docker image hygiene ---------------------------------------------------
//
// The builder commits every stage of the Dockerfile as an own image and keeps
// it: after the build the intermediate stages are untagged images on the
// daemon, and nothing but an explicit `docker rmi` removes them. A build of
// this Dockerfile leaves several gigabytes of intermediate layers behind (the
// `npm ci` stage alone is larger than the final image), so a handful of runs
// fill the disk — and the next build then dies with "no space left on
// device". That fails this test for a reason that has nothing to do with the
// .dockerignore file.
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

/** The blocks the builder printed per step, without the step headline. */
const parseBuildSteps = (buildOutput: string): string[] =>
  buildOutput.split(/^Step \d+\/\d+ : /m).slice(1);

/** The id of the image a step ended with, if the step produced one. */
const stepImageId = (step: string): string | undefined => {
  const ids = [...step.matchAll(/^\s*--->\s+([0-9a-f]{12,64})\s*$/gm)].map((match) => match[1]);
  return ids.at(-1);
};

/** The ids of the images the build took from the cache. */
const parseCachedImageIds = (buildOutput: string): string[] =>
  parseBuildSteps(buildOutput)
    .filter((step) => step.includes("Using cache"))
    .map(stepImageId)
    .filter((id): id is string => id !== undefined);

/** The ids of the images the build created itself. */
const parseCreatedImageIds = (buildOutput: string): string[] =>
  parseBuildSteps(buildOutput)
    .filter((step) => !step.includes("Using cache"))
    .map(stepImageId)
    .filter((id): id is string => id !== undefined);

/**
 * The ids of the containers the build created. The builder removes the
 * container of a successful step itself, but a failed step leaves its
 * container behind, and with it the writable layer of the step.
 */
const parseBuildContainerIds = (buildOutput: string): string[] => {
  const ids: string[] = [];
  for (const match of buildOutput.matchAll(/^\s*--->\s+Running in ([0-9a-f]{12,64})\s*$/gm)) {
    const id = match[1];
    if (id !== undefined && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
};

/** The ids of the tagged images — a shared base image is never removed. */
const listTaggedImageIds = (): string[] => {
  const ids = runCommand("docker image ls -q")
    .output.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return [...new Set(ids)];
};

/** A tagged image belongs to the daemon, not to this build. */
const isSharedImage = (taggedImageIds: string[], id: string): boolean =>
  taggedImageIds.some((tagged) => tagged === id || tagged.startsWith(id) || id.startsWith(tagged));

/** Removes the given image ids, newest first, and ignores the ones that go. */
const removeImageIds = (taggedImageIds: string[], ids: string[]): void => {
  for (const id of [...new Set(ids)].reverse()) {
    if (isSharedImage(taggedImageIds, id)) {
      continue;
    }
    runCommand(`docker rmi ${id}`);
  }
};

/** Removes the containers a build left behind. */
const removeBuildContainers = (buildOutput: string): void => {
  for (const id of parseBuildContainerIds(buildOutput)) {
    runCommand(`docker rm ${id}`);
  }
};

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

  it(
    "docker build respects the ignore file and image size stays below 200 MB",
    // The live build is slow: this daemon has no buildx plugin, so the legacy
    // builder runs. Its cache only helps for the steps whose chain is still
    // on the daemon; the test removes the images it created, so the `npm ci`
    // stage — the container downloads and unpacks the whole dependency tree
    // — is rebuilt on every run.
    //
    // Measured on this machine (2 CPUs, 3.8 GB RAM):
    //   * 422 s and 575 s without another build on the same daemon
    //   * 836 s with one concurrent build, 923 s with one concurrent build
    //     while the rest of the test suite competes for the same CPUs
    // The budget covers the cold path plus a concurrent build and the one
    // retry a build gets when another build breaks the shared cache chain;
    // it is an execution budget, not an assertion about the image.
    { timeout: 2_100_000 },
    () => {
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

      // Live level of verification: only runnable when a Docker daemon is
      // reachable. `docker --version` only proves the CLI is installed — the
      // build needs a running daemon, so probe the daemon and skip the live
      // checks when it is unavailable. In environments without Docker the
      // structural checks above are the available verification level and the
      // task file records that the live build/size check is deferred.
      const docker = runCommand("docker info");
      if (docker.exitCode !== 0) {
        return;
      }

      // The tag is unique per test process: two checkouts of this repository
      // (a worktree beside the main one, a CI job beside a local run) build
      // with the same daemon at the same time, and a shared tag makes them
      // delete each other's image — the second `docker image inspect` then
      // fails on an image the other run has already removed.
      const tag = `darthub:dockerignore-test-${process.pid}`;
      const taggedImageIds = listTaggedImageIds();

      // The build can fail for a reason that has nothing to do with the
      // .dockerignore file: the daemon shares its image store with the other
      // worktrees on this machine, and the legacy builder's cache is a chain
      // of images. When another build removes an image, the store can take
      // the snapshot of a cached layer away, and the next build that uses
      // that cache entry dies with "NotFound: parent snapshot ... does not
      // exist". A build that fails that way gets one retry: the broken chain
      // is removed with it, so the retry runs the steps again from the base
      // image.
      const brokenCacheChain = (output: string): boolean =>
        /parent snapshot .* does not exist/.test(output);

      let build = runCommand(`docker build -t ${tag} .`);
      if (build.exitCode !== 0 && brokenCacheChain(build.output)) {
        removeImageIds(taggedImageIds, [
          ...parseCachedImageIds(build.output),
          ...parseCreatedImageIds(build.output),
        ]);
        removeBuildContainers(build.output);
        build = runCommand(`docker build -t ${tag} .`);
      }

      try {
        expect(build.exitCode, `docker build exited with ${build.exitCode}:\n${build.output}`).toBe(
          0,
        );

        const size = runCommand(`docker image inspect -f {{.Size}} ${tag}`);
        expect(size.exitCode, `image inspection failed:\n${size.output}`).toBe(0);
        const sizeBytes = Number.parseInt(size.output.trim(), 10);
        expect(Number.isNaN(sizeBytes), `unexpected image size '${size.output}'`).toBe(false);
        expect(sizeBytes, `image size ${sizeBytes} bytes must stay below 200 MB`).toBeLessThan(
          200 * 1024 * 1024,
        );
      } finally {
        runCommand(`docker rmi ${tag}`);
        // The images the build created go with it. They are untagged images
        // that only an explicit removal deletes, and each build leaves
        // several gigabytes of them behind — the disk runs full after a
        // handful of runs and the next build fails with "no space left on
        // device". The images the build took from the cache stay: they are
        // the shared cache of the daemon and the builds that run at the same
        // time use them.
        removeImageIds(taggedImageIds, parseCreatedImageIds(build.output));
        removeBuildContainers(build.output);
      }
    },
  );
});

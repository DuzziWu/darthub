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

  it("docker build respects the ignore file and image size stays below 200 MB", () => {
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

    const build = runCommand("docker build -t darthub:dockerignore-test .");
    expect(build.exitCode, `docker build exited with ${build.exitCode}:\n${build.output}`).toBe(0);

    const size = runCommand("docker image inspect -f {{.Size}} darthub:dockerignore-test");
    expect(size.exitCode, `image inspection failed:\n${size.output}`).toBe(0);
    const sizeBytes = Number.parseInt(size.output.trim(), 10);
    expect(Number.isNaN(sizeBytes), `unexpected image size '${size.output}'`).toBe(false);
    expect(sizeBytes, `image size ${sizeBytes} bytes must stay below 200 MB`).toBeLessThan(
      200 * 1024 * 1024,
    );
    runCommand("docker rmi darthub:dockerignore-test");
  });
});

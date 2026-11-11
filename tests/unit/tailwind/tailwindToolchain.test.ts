import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runCommand } from "../../support/run-command";

const root = process.cwd();

const readJson = (relativePath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf-8")) as Record<string, unknown>;

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");

const devDependencies = (packageJson.devDependencies ?? {}) as Record<string, string>;
const lockPackages = (packageLock.packages ?? {}) as Record<string, { version?: string }>;

// Next.js 16 builds with Turbopack by default and emits CSS chunks into
// `.next/static/chunks`; a webpack build emits them into `.next/static/css`.
// Both directories are covered so the assertions hold for either bundler.
const cssDirs = [resolve(root, ".next/static/css"), resolve(root, ".next/static/chunks")];

const compiledCssFiles = (): string[] =>
  cssDirs.flatMap((dir) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".css"))
          .map((f) => resolve(dir, f))
      : [],
  );

const readCompiledCss = (): string => {
  const files = compiledCssFiles();
  expect(files.length, "no compiled stylesheet found in .next/static").toBeGreaterThan(0);
  return files.map((file) => readFileSync(file, "utf-8")).join("\n");
};

let cachedBuild: { output: string } | undefined;

const runProductionBuild = (): string => {
  if (!cachedBuild) {
    try {
      cachedBuild = {
        output: execSync("npm run build", {
          cwd: root,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 600_000,
        }),
      };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string };
      cachedBuild = { output: `${String(err.stdout ?? "")}${String(err.stderr ?? "")}` };
    }
  }
  return cachedBuild.output;
};

describe("tailwind toolchain", () => {
  it("installs tailwindcss and @tailwindcss/postcss as devDependencies and keeps package-lock.json in sync", () => {
    const tailwindRange = devDependencies["tailwindcss"];
    const postcssRange = devDependencies["@tailwindcss/postcss"];
    expect(tailwindRange).toBeDefined();
    expect(postcssRange).toBeDefined();

    const majorOf = (range: string | undefined): string => /^([0-9]+)/.exec(range ?? "")?.[1] ?? "";
    expect(majorOf(postcssRange)).toBe(majorOf(tailwindRange));

    expect(lockPackages["node_modules/tailwindcss"]?.version).toBeDefined();
    expect(lockPackages["node_modules/@tailwindcss/postcss"]?.version).toBeDefined();

    const lockRoot = lockPackages[""] as unknown as { devDependencies?: Record<string, string> };
    expect(lockRoot.devDependencies?.["tailwindcss"]).toBe(tailwindRange);
    expect(lockRoot.devDependencies?.["@tailwindcss/postcss"]).toBe(postcssRange);

    expect(existsSync(resolve(root, "tailwind.config.js"))).toBe(false);
    expect(existsSync(resolve(root, "tailwind.config.ts"))).toBe(false);
    expect(existsSync(resolve(root, "tailwind.config.cjs"))).toBe(false);
    expect(existsSync(resolve(root, "tailwind.config.mjs"))).toBe(false);

    // `npm ci` (Dockerfile deps stage, CI workflow) hard-fails when package.json
    // and package-lock.json are out of sync.
    const { exitCode, output } = runCommand("npm ci --dry-run");
    expect(exitCode, `npm ci --dry-run exited with ${exitCode}:\n${output}`).toBe(0);
  });

  it("compiles the Tailwind pipeline during a production build", { timeout: 600_000 }, () => {
    const output = runProductionBuild();

    expect(output).toContain("Compiled successfully");
    // Tailwind's own theme layer emits `--tw-*` custom properties; a plain
    // CSS bundle without the plugin would not contain them.
    expect(readCompiledCss()).toMatch(/--tw-[a-z-]+:/);
  });

  it("emits a compiled stylesheet into .next/static/css", { timeout: 600_000 }, () => {
    runProductionBuild();

    const files = compiledCssFiles();
    expect(files.length).toBeGreaterThan(0);

    // The stylesheet must actually be linked from the built page, not just
    // dumped into the output directory.
    const page = readFileSync(resolve(root, ".next/server/app/game-center.html"), "utf-8");
    const cssFileNames = files.map((file) => file.split(/[\\/]/).pop());
    expect(
      cssFileNames.some((name) => name !== undefined && page.includes(name)),
      "built page does not link any compiled stylesheet",
    ).toBe(true);
  });

  it("emits the utilities the pages use into the compiled stylesheet", { timeout: 600_000 }, () => {
    runProductionBuild();
    const css = readCompiledCss();

    expect(css).toContain(".bg-board");
    expect(css).toContain(".text-ink");
    expect(css).toContain(".min-h-screen");
    expect(css).toContain(".grid-cols-1");
  });

  it("emits the semantic utilities the token layer publishes", { timeout: 600_000 }, () => {
    runProductionBuild();
    const css = readCompiledCss();

    for (const utility of [
      ".bg-board",
      ".text-ink",
      ".bg-surface",
      ".border-edge",
      ".font-display",
      ".font-body",
      ".font-label",
      ".font-caption",
      ".font-mono",
      ".text-display",
      ".text-body",
      ".text-caption",
      ".text-score-md",
      ".rounded-sm",
      ".rounded-md",
      ".p-md",
      ".gap-lg",
      ".space-y-2xl",
      ".duration-fast",
      ".ease-standard",
    ]) {
      expect(css, `the compiled stylesheet must contain ${utility}`).toContain(utility);
    }
  });

  it("applies the dark base theme and the font stack to the body", { timeout: 600_000 }, () => {
    runProductionBuild();
    const css = readCompiledCss();

    const bodyRule = css.match(/(?:^|[},])\s*body\s*\{([^}]*)\}/);
    expect(bodyRule, "compiled stylesheet has no body rule").not.toBeNull();

    const body = bodyRule?.[1] ?? "";
    expect(body).toMatch(/font-family/);
    expect(body).toMatch(/background-color:\s*var\(--color-board\)/);
    expect(body).toMatch(/color:\s*var\(--color-ink\)/);

    expect(css).toMatch(/--font-sans:[^;]*sans-serif/);
    expect(css).toMatch(/color-scheme:\s*dark/);
  });
});

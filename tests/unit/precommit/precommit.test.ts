import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "../../support/run-command";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const hookPath = path.join(repoRoot, ".husky", "pre-commit");
// The sandbox lives outside the repository (os.tmpdir) so its create/delete
// cycle can never disturb concurrent lint runs that walk the repo tree.
const sandboxDir = path.join(tmpdir(), "darthub-precommit-scratch");
const repoNodeModules = path.join(repoRoot, "node_modules");

/**
 * Runs the pre-commit hook the way git does: through POSIX sh, from the
 * working directory git would give it (here: a sandbox directory outside the
 * repo, so pass/fail scenarios stay hermetic against other files being edited
 * in the repository while the tests run). npx resolves the repo's binaries
 * through a sandbox "node_modules" link, and ESLint picks up a
 * self-contained sandbox config because the repo's flat config's imports
 * cannot be resolved from outside the repo tree.
 */
const runHook = (): { exitCode: number; output: string } => {
  try {
    const output = execSync(`sh "${hookPath.replace(/\\/g, "/")}"`, {
      cwd: sandboxDir,
      encoding: "utf-8",
      shell: "sh",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    return { exitCode: 0, output };
  } catch (error) {
    const err = error as { status?: number; stdout?: unknown; stderr?: unknown };
    return {
      exitCode: err.status ?? 1,
      output: `${String(err.stdout ?? "")}${String(err.stderr ?? "")}`,
    };
  }
};

beforeEach(() => {
  rmSync(sandboxDir, { recursive: true, force: true });
  mkdirSync(sandboxDir, { recursive: true });
  // Junction/symlink (never a copy) so npx resolves the repo's binaries from
  // the sandbox; removal deletes only the link, not the target directory.
  symlinkSync(
    repoNodeModules,
    path.join(sandboxDir, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  // Self-contained flat config so `eslint .` works in the sandbox without the
  // repo's tooling tree. The probes are plain JavaScript, so the bundled
  // parser is enough; `no-unused-vars` keeps the failing probe failing.
  writeFileSync(
    path.join(sandboxDir, "eslint.config.mjs"),
    [
      "export default [",
      "  {",
      '    ignores: ["node_modules/**", ".next/**", "coverage/**"],',
      '    files: ["**/*.ts"],',
      '    languageOptions: { sourceType: "module", ecmaVersion: "latest" },',
      '    rules: { "no-unused-vars": "error" },',
      "  },",
      "];",
      "",
    ].join("\n"),
    "utf-8",
  );
});

afterAll(() => {
  rmSync(sandboxDir, { recursive: true, force: true });
});

/** Writes a file that passes both ESLint and Prettier into the sandbox. */
const writeCleanProbe = (): void => {
  writeFileSync(path.join(sandboxDir, "clean-probe.ts"), "export const lintProbe = 1;\n", "utf-8");
};

describe("pre-commit hook", () => {
  it("executes eslint --max-warnings=0 and prettier --check", { timeout: 240_000 }, () => {
    const hook = readFileSync(hookPath, "utf-8");
    expect(hook).toMatch(/eslint[^|\n]*--max-warnings=0/);
    expect(hook).toMatch(/prettier[^|\n]*--check/);

    // A file that passes both ESLint and Prettier: the hook runs both checks
    // and succeeds.
    writeCleanProbe();

    const { exitCode, output } = runHook();
    expect(exitCode, `hook exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).toMatch(/eslint/i);
    expect(output).toMatch(/prettier/i);
  });

  it("prevents commit when linting fails", { timeout: 240_000 }, () => {
    // A file violating @typescript-eslint/no-unused-vars (an error rule):
    // the hook must abort with a non-zero exit code, which is what makes git
    // block the commit.
    writeFileSync(
      path.join(sandboxDir, "lint-error-probe.ts"),
      "const unusedLintProbe = 1;\n",
      "utf-8",
    );

    const { exitCode, output } = runHook();
    expect(exitCode, `hook unexpectedly passed:\n${output}`).not.toBe(0);
    expect(output).toMatch(/ESLint failed/i);
    expect(output).toMatch(/abort/i);
  });

  it("works on Windows and Unix environments", { timeout: 240_000 }, () => {
    const hook = readFileSync(hookPath, "utf-8");

    // POSIX sh entry point so the same script runs under Git for Windows'
    // bundled sh and any Unix /bin/sh, with no Windows-only shell syntax.
    expect(hook.startsWith("#!/bin/sh")).toBe(true);
    expect(hook).not.toContain("\r");
    expect(hook).not.toMatch(/\.cmd|\.ps1|%[A-Za-z_]+%/);

    // Runs successfully under the same POSIX sh this platform's git uses.
    writeCleanProbe();
    const { exitCode, output } = runHook();
    expect(exitCode, `hook exited with ${exitCode}:\n${output}`).toBe(0);

    // Wired up: local git is pointed at the hook directory, and fresh
    // installs re-wire it automatically via the npm prepare script.
    const wired = runCommand("git config core.hooksPath");
    expect(wired.exitCode).toBe(0);
    expect(wired.output.trim()).toBe(".husky");

    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf-8");
    expect(pkg).toMatch(/"prepare"[^}]*core\.hooksPath/s);
  });
});

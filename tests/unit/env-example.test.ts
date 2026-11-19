import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { KNOWN_PLACEHOLDER_SECRETS } from "@/auth/session";

const envExamplePath = resolve(process.cwd(), ".env.example");
const envExample = readFileSync(envExamplePath, "utf-8");
const gitignorePath = resolve(process.cwd(), ".gitignore");
const gitignore = readFileSync(gitignorePath, "utf-8");

/** Required variables every developer must configure (or copy) from the template. */
const REQUIRED_VARS = ["DATABASE_URL", "AUTH_SECRET", "POSTGRES_PASSWORD", "PORT"] as const;

/** Lines that assign a variable, e.g. `PORT=3000`. */
const isAssignment = (line: string): boolean => /^[A-Z][A-Z0-9_]*=/.test(line.trim());

/** Commented-out assignment used to document an optional variable. */
const isCommentedAssignment = (line: string): boolean => /^#\s*[A-Z][A-Z0-9_]*=/.test(line.trim());

/**
 * Minimal gitignore semantics: last matching pattern wins, `!` negates.
 * Sufficient for the simple flat patterns used in this repository.
 */
function isIgnoredByGitignore(path: string): boolean {
  let ignored = false;
  for (const rawLine of gitignore.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const negated = line.startsWith("!");
    const pattern = negated ? line.slice(1) : line;
    const regex = new RegExp(
      `^${pattern
        .replace(/[.+^$(){}[\]\\|]/g, "\\$&")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")}$`,
    );
    if (regex.test(path)) {
      ignored = !negated;
    }
  }
  return ignored;
}

describe(".env.example", () => {
  it("it includes DATABASE_URL, AUTH_SECRET, REDIS_URL (optional), and PORT", () => {
    const lines = envExample.split("\n");

    for (const variable of REQUIRED_VARS) {
      expect(
        lines.some((line) => line.trim().startsWith(`${variable}=`)),
        `.env.example must define ${variable}`,
      ).toBe(true);
    }

    // REDIS_URL is optional: it must be present but commented out so the
    // app starts without Redis configured.
    expect(
      lines.some((line) => isCommentedAssignment(line) && line.includes("REDIS_URL=")),
      "REDIS_URL must be present but commented out (optional)",
    ).toBe(true);
  });

  it("comments explain each variable", () => {
    const lines = envExample.split("\n");

    const variableLines = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => isAssignment(line));

    expect(variableLines.length).toBeGreaterThan(0);

    for (const { line, index } of variableLines) {
      const variable = line.split("=")[0];
      // The contiguous comment block directly above the variable must
      // contain explanatory prose (not only decorative section headers).
      const commentBlock: string[] = [];
      for (let i = index - 1; i >= 0; i--) {
        const previous = (lines[i] ?? "").trim();
        if (!previous.startsWith("#")) break;
        commentBlock.push(previous);
      }
      const explains = commentBlock.some(
        (comment) => /#/.test(comment) && comment.replace(/^#+\s*/, "").length > 4,
      );
      expect(
        explains,
        `expected a comment directly above the ${variable} assignment explaining it`,
      ).toBe(true);
    }
  });

  it("the file is excluded from version-controlled secrets (.gitignore)", () => {
    // Real env files are ignored…
    expect(isIgnoredByGitignore(".env")).toBe(true);
    expect(isIgnoredByGitignore(".env.production")).toBe(true);
    // …while the template itself stays tracked.
    expect(isIgnoredByGitignore(".env.example")).toBe(false);
    // The un-ignore must be explicit so `.env.*` style patterns cannot swallow it.
    expect(gitignore).toMatch(/^[ \t]*!\.env\.example/m);
  });

  it("names only the secret the code actually reads", () => {
    // AUTH_SECRET is the one name the session code reads
    // (src/auth/session.ts). The template must not offer a second name for
    // the same secret: two names invite the two to drift apart, and the one
    // that drifts is the one that signs.
    expect(envExample).not.toMatch(/^\s*JWT_SECRET=/m);
    expect(envExample).toMatch(/^\s*AUTH_SECRET=/m);
  });

  it("ships a placeholder that the application refuses to run with", () => {
    // The placeholder is long enough to pass the length check — so the
    // length check alone cannot be what stops a deployment from running
    // with a published secret. The code refuses it by name, and this test
    // keeps the template and that list in step.
    const placeholder = envExample
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("AUTH_SECRET="))
      ?.slice("AUTH_SECRET=".length);

    expect(placeholder).toBeDefined();
    expect(placeholder).not.toBe("");
    expect(placeholder?.length ?? 0).toBeGreaterThanOrEqual(32);
    expect(KNOWN_PLACEHOLDER_SECRETS).toContain(placeholder);
  });
});

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const DOCS_DIR = resolve(import.meta.dirname, "../../../docs");
const REPO_ROOT = resolve(DOCS_DIR, "..");
const DEPLOYMENT_DOC = join(DOCS_DIR, "DEPLOYMENT.md");

/** GitHub-style heading slug (mirrors the anchor generation used in the docs). */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Headings of DEPLOYMENT.md, skipping lines inside fenced code blocks. */
function headings(markdown: string): { level: number; text: string; slug: string }[] {
  const result: { level: number; text: string; slug: string }[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const text = (match[2] ?? "").trim();
      result.push({
        level: (match[1] ?? "").length,
        text,
        slug: slugifyHeading(text),
      });
    }
  }
  return result;
}

describe("DEPLOYMENT.md", () => {
  it("contains sections: prerequisites, environment variables, docker compose commands, data migration", () => {
    expect(existsSync(DEPLOYMENT_DOC), "docs/DEPLOYMENT.md must exist").toBe(true);
    const markdown = readFileSync(DEPLOYMENT_DOC, "utf8");
    const found = headings(markdown);
    for (const required of [
      "Prerequisites",
      "Environment Variables",
      "Docker Compose Commands",
      "Data Migration",
    ]) {
      const slug = slugifyHeading(required);
      expect(
        found.some((h) => h.level === 2 && h.slug === slug),
        `DEPLOYMENT.md must have an "## ${required}" section`,
      ).toBe(true);
    }
  });

  it("provides a rollback guide", () => {
    const markdown = readFileSync(DEPLOYMENT_DOC, "utf8");
    const found = headings(markdown);
    expect(
      found.some((h) => h.level === 2 && /^rollback(-| |$)/.test(h.slug)),
      'DEPLOYMENT.md must have a "## Rollback" section',
    ).toBe(true);
  });

  it("lists required ports and firewall rules", () => {
    const markdown = readFileSync(DEPLOYMENT_DOC, "utf8");
    const found = headings(markdown);
    const section = found.some((h) => h.level === 2 && /ports|firewall/.test(h.slug));
    expect(section, 'DEPLOYMENT.md must have a "Ports and Firewall Rules" section').toBe(true);
    expect(markdown).toContain("3000");
    expect(markdown).toContain("5432");
  });

  it("has no broken relative links", () => {
    const markdown = readFileSync(DEPLOYMENT_DOC, "utf8");
    const found = headings(markdown);
    const broken: string[] = [];
    let inFence = false;
    for (const line of markdown.split("\n")) {
      if (line.trimStart().startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(line)) !== null) {
        const target = match[2] ?? "";
        if (/^[a-z]+:|^\/\//i.test(target)) continue;
        if (target.startsWith("#")) {
          const slug = target.slice(1).toLowerCase();
          if (!found.some((h) => h.slug === slug)) broken.push(target);
          continue;
        }
        const resolved = target.startsWith("/")
          ? join(REPO_ROOT, target.slice(1))
          : join(DOCS_DIR, target);
        if (!existsSync(resolved)) broken.push(target);
      }
    }
    expect(broken, "all relative links must resolve").toEqual([]);
  });

  it("is lint-checked for Markdown style", () => {
    const markdown = readFileSync(DEPLOYMENT_DOC, "utf8");
    const problems: string[] = [];
    const lines = markdown.split("\n");

    let lastLevel = 0;
    let h1Count = 0;
    let inFence = false;
    lines.forEach((line, index) => {
      const n = index + 1;
      if (/\s$/.test(line)) problems.push(`${n}: trailing whitespace`);
      if (line.trimStart().startsWith("```")) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (!match) return;
      const level = (match[1] ?? "").length;
      if (level === 1) h1Count++;
      if (/\s#+\s*$/.test(line)) problems.push(`${n}: heading must be ATX style`);
      if (lastLevel > 0 && level > lastLevel + 1)
        problems.push(`${n}: heading level skips from ${lastLevel} to ${level}`);
      lastLevel = level;
    });
    if (h1Count !== 1) problems.push(`expected exactly one h1, found ${h1Count}`);
    expect(problems, "Markdown lint problems").toEqual([]);
  });
});

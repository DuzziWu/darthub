import { readFileSync, existsSync } from "node:fs";
import { join, resolve, posix } from "node:path";
import { describe, it, expect } from "vitest";

const DOCS_DIR = resolve(import.meta.dirname, "../../../docs");

const REQUIRED_DOCS = [
  "PRD.md",
  "ARCHITECTURE.md",
  "DATABASE.md",
  "API.md",
  "ROADMAP.md",
  "TESTING.md",
  "SECURITY.md",
  "COSTS.md",
  "DECISIONS.md",
] as const;

const MODULES_UNDER_SRC = [
  "components",
  "pages",
  "app",
  "services",
  "repositories",
  "dto",
  "domain",
  "infrastructure",
  "auth",
  "game",
  "realtime",
  "ai",
  "camera",
  "privacy",
  "career",
];

type Heading = { level: number; text: string; slug: string };

function readDoc(name: string): string {
  return readFileSync(join(DOCS_DIR, name), "utf8");
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)(\s+#+\s*)?$/.exec(line);
    if (match) {
      const text = (match[2] ?? "").trim();
      headings.push({ level: (match[1] ?? "").length, text, slug: slugify(text) });
    }
  }
  return headings;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Extracts the [link](target) pairs appearing inside the Table of Contents. */
function extractTocLinks(markdown: string): { text: string; anchor: string }[] {
  const lines = markdown.split("\n");
  const tocLines: string[] = [];
  let inToc = false;
  for (const line of lines) {
    if (/^##\s+Table of Contents\s*$/.test(line)) {
      inToc = true;
      continue;
    }
    if (inToc && /^#{1,6}\s+/.test(line)) break;
    if (inToc) tocLines.push(line);
  }
  const links: { text: string; anchor: string }[] = [];
  for (const line of tocLines) {
    const match = /^\s*[-*]?\s*\[([^\]]+)\]\(#([^)]+)\)/.exec(line);
    if (match) links.push({ text: match[1] ?? "", anchor: match[2] ?? "" });
  }
  return links;
}

/** Resolves an intra-document anchor to a heading slug. */
function anchorResolves(anchor: string, headings: Heading[]): boolean {
  const normalized = anchor.toLowerCase();
  return headings.some((h) => h.slug === normalized);
}

describe("docs documentation set", () => {
  it("includes a table of contents with correct links", () => {
    for (const doc of REQUIRED_DOCS) {
      const markdown = readDoc(doc);
      const headings = extractHeadings(markdown);
      const tocLinks = extractTocLinks(markdown);
      expect(tocLinks.length, `${doc} should have TOC links`).toBeGreaterThan(0);
      for (const link of tocLinks) {
        expect(
          anchorResolves(link.anchor, headings),
          `${doc} TOC link #${link.anchor} must resolve to a heading`,
        ).toBe(true);
      }
    }
  });

  it("references the latest architecture diagram (to be added later)", () => {
    const markdown = readDoc("ARCHITECTURE.md");
    expect(markdown).toMatch(/^##\s+.*Architecture Diagram.*$/m);
    expect(markdown.toLowerCase()).toContain("to be added");
  });

  it("describes all modules and their responsibilities", () => {
    const markdown = readDoc("ARCHITECTURE.md");
    const moduleRows = markdown
      .split("\n")
      .filter((line) => line.startsWith("|"))
      .map((line) => line.split("|").map((cell) => cell.trim()));
    for (const module of MODULES_UNDER_SRC) {
      const pathToken = posix.join("src", module);
      const row = moduleRows.find((cells) =>
        cells.some((cell) => cell.includes(`\`${pathToken}/\``) || cell === `\`${pathToken}/\``),
      );
      expect(row, `ARCHITECTURE.md must document src/${module}`).toBeDefined();
      const description = row!.slice(1).join(" ");
      expect(
        description.replace(/[-|\s]/g, "").length,
        `module src/${module} needs a responsibility description`,
      ).toBeGreaterThan(20);
    }
  });

  it("lists open decisions and rationales", () => {
    const markdown = readDoc("DECISIONS.md");
    const openSection = /(^|\n)##\s+Open Decisions\b/.exec(markdown);
    expect(openSection, "DECISIONS.md must have an 'Open Decisions' section").toBeTruthy();
    const after = markdown.slice((openSection?.index ?? 0) + (openSection?.[1]?.length ?? 1));
    const nextSection = after.indexOf("\n## ");
    const body = nextSection === -1 ? after : after.slice(0, nextSection);
    const entries = body.match(/^###\s+/gm) ?? [];
    expect(entries.length, "at least one open decision entry").toBeGreaterThan(0);
    const rationales = body.match(/\bRationale:/g) ?? [];
    expect(
      rationales.length,
      "each opened decision must provide its rationale",
    ).toBeGreaterThanOrEqual(entries.length);
  });

  it("passes markdown linting", () => {
    const problems: string[] = [];
    for (const doc of REQUIRED_DOCS) {
      lintDoc(doc, readDoc(doc), problems);
    }
    expect(problems).toEqual([]);
  });
});

function lintDoc(name: string, markdown: string, problems: string[]): void {
  const lines = markdown.split("\n");

  // Pre-compute fence ranges so text rules skip code blocks.
  const fenced = new Set<number>();
  let inFenceScan = false;
  lines.forEach((line, index) => {
    if (line.trimStart().startsWith("```")) {
      fenced.add(index + 1);
      inFenceScan = !inFenceScan;
      return;
    }
    if (inFenceScan) fenced.add(index + 1);
  });

  function inCodeFence(lineNumber: number): boolean {
    return fenced.has(lineNumber);
  }

  const headings = extractHeadings(markdown);
  const slugCounts = new Map<string, number>();
  for (const h of headings) {
    slugCounts.set(h.slug, (slugCounts.get(h.slug) ?? 0) + 1);
  }

  lines.forEach((line, index) => {
    const n = index + 1;
    if (/\s$/.test(line)) problems.push(`${name}:${n} trailing whitespace (MD009)`);
    if (/\S\s{2,}\S/.test(line.trim()) && !inCodeFence(n) && !line.trimStart().startsWith("|"))
      problems.push(`${name}:${n} multiple consecutive internal spaces (MD005-like)`);
  });

  let lastLevel = 1;
  let h1Count = 0;
  let lastNonBlankWasHeading = false;
  let inFence = false;
  let fenceLanguage = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const n = i + 1;

    if (line.trimStart().startsWith("```")) {
      if (!inFence) {
        fenceLanguage = line.trim().slice(3).trim();
        if (fenceLanguage === "")
          problems.push(`${name}:${n} fenced code block missing language (MD040)`);
        inFence = true;
      } else {
        inFence = false;
      }
      lastNonBlankWasHeading = false;
      continue;
    }
    if (inFence) continue;
    if (line.trim() === "") {
      lastNonBlankWasHeading = false;
      continue;
    }
    lastNonBlankWasHeading = false;

    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const level = (heading[1] ?? "").length;
      if (level === 1) h1Count++;
      if (level > lastLevel + 1)
        problems.push(`${name}:${n} heading level skips from ${lastLevel} to ${level} (MD001)`);
      if (lastNonBlankWasHeading)
        problems.push(`${name}:${n} heading directly after heading without blank line (MD022)`);
      const prev = i > 0 ? (lines[i - 1] ?? "") : "";
      if (
        i > 0 &&
        prev.trim() !== "" &&
        !prev.trimStart().startsWith("```") &&
        !/^(#{1,6})\s+/.test(prev)
      )
        problems.push(`${name}:${n} heading needs blank line before (MD022)`);
      const next = lines[i + 1] ?? "";
      if (i + 1 < lines.length && next.trim() !== "" && !/^(#{1,6})\s+/.test(next))
        problems.push(`${name}:${n} heading needs blank line after (MD022)`);
      lastLevel = level;
      lastNonBlankWasHeading = true;

      const slug = slugify((heading[2] ?? "").trim());
      if ((slugCounts.get(slug) ?? 0) > 1)
        problems.push(`${name}:${n} duplicate heading slug #${slug} (MD024)`);
      continue;
    }

    const listItem = /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
    if (listItem) {
      const prev = i > 0 ? (lines[i - 1] ?? "") : "";
      const prevIsListItem =
        /^\s*[-*+]\s+/.test(prev) || /^\s*\d+\.\s+/.test(prev) || /^\s+\S/.test(prev);
      if (
        i > 0 &&
        prev.trim() !== "" &&
        !prevIsListItem &&
        !/^(#{1,6})\s+/.test(prev) &&
        !/^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(prev)
      )
        problems.push(`${name}:${n} list needs blank line before start (MD032)`);
    }

    // Internal links must resolve.
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(line)) !== null) {
      const target = match[2] ?? "";
      if (target.startsWith("#")) {
        if (!anchorResolves(target.slice(1), headings))
          problems.push(`${name}:${n} broken internal anchor link: #${target.slice(1)} (MD051)`);
      } else if (/\.md/.test(target)) {
        const parts = target.split("#");
        const file = parts[0] ?? "";
        const hash = parts[1];
        const resolved = join(DOCS_DIR, file);
        const repoRoot = resolve(DOCS_DIR, "..");
        const candidates = [resolved, join(repoRoot, file)];
        const existing = candidates.find((c) => existsSync(c));
        if (!existing) {
          problems.push(`${name}:${n} broken file link: ${target}`);
        } else if (hash) {
          const linked = readFileSync(existing, "utf8");
          const linkedHeadings = extractHeadings(linked);
          if (!anchorResolves(hash, linkedHeadings))
            problems.push(`${name}:${n} broken anchor in link: ${target} (MD051)`);
        }
      }
    }
  }

  if (h1Count !== 1) problems.push(`${name}: expected exactly one h1, found ${h1Count} (MD025)`);
}

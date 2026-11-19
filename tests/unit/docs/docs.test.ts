import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, posix } from "node:path";
import { describe, it, expect } from "vitest";
import { runCommand } from "../../support/run-command";

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

const SRC_DIR = resolve(import.meta.dirname, "../../../src");

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const E2E_DIR = join(REPO_ROOT, "e2e");

/** Every Playwright spec file that exists in `e2e/`. The list is read from
 * disk rather than hard-coded, so the roadmap check can never drift away
 * from the suite it describes. */
const E2E_SPEC_FILES = readdirSync(E2E_DIR)
  .filter((name) => name.endsWith(".spec.ts"))
  .sort();

/** Counts the `test.skip(...)` placeholders a spec file carries. */
const countSkippedTests = (fileName: string): number =>
  readFileSync(join(E2E_DIR, fileName), "utf8")
    .split("\n")
    .filter((line) => /^\s*test\.skip\(/.test(line)).length;

/** Every module directory that actually exists under `src/`. The list is read
 * from disk rather than hard-coded so the documentation check can never drift
 * away from the repository layout again. */
const MODULES_UNDER_SRC = readdirSync(SRC_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

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

describe("ROADMAP delivery status", () => {
  it("states the real number of skipped end-to-end placeholders", () => {
    const roadmap = readDoc("ROADMAP.md");

    const row = /^\|\s*`test\.skip` placeholders in `e2e\/`\s*\|(.*)\|\s*$/m.exec(roadmap);
    expect(row, "ROADMAP.md must carry a row for the test.skip placeholders").toBeTruthy();
    const cell = row?.[1] ?? "";

    const statedTotal = Number(/\*\*(\d+)\*\*/.exec(cell)?.[1] ?? "NaN");
    expect(Number.isNaN(statedTotal), "the row must state a total count").toBe(false);

    const statedPerFile = new Map<string, number>();
    for (const match of cell.matchAll(/`(e2e\/[\w.-]+\.spec\.ts)`\s*\((\d+)\)/g)) {
      statedPerFile.set(match[1] ?? "", Number(match[2]));
    }

    // The counts the roadmap claims, read back from the disk.
    const actualPerFile = new Map<string, number>();
    for (const name of E2E_SPEC_FILES) {
      actualPerFile.set(`e2e/${name}`, countSkippedTests(name));
    }
    const actualTotal = [...actualPerFile.values()].reduce((sum, count) => sum + count, 0);

    expect(statedTotal, "ROADMAP.md must state the real number of skipped placeholders").toBe(
      actualTotal,
    );

    // Every spec file that carries a placeholder is named with its count, and
    // every spec file without one is not named at all.
    for (const [file, count] of actualPerFile) {
      if (count === 0) {
        expect(statedPerFile.has(file), `ROADMAP.md must not claim placeholders in ${file}`).toBe(
          false,
        );
      } else {
        expect(
          statedPerFile.get(file),
          `ROADMAP.md must state the placeholder count of ${file}`,
        ).toBe(count);
      }
    }
    expect(
      [...statedPerFile.keys()].every((file) => actualPerFile.has(file)),
      "ROADMAP.md must only name spec files that exist",
    ).toBe(true);
  });

  it("states the real number of end-to-end spec files", () => {
    const roadmap = readDoc("ROADMAP.md");

    const row = /^\|\s*Playwright specs\s*\|(.*)\|\s*$/m.exec(roadmap);
    expect(row, "ROADMAP.md must carry a row for the Playwright specs").toBeTruthy();
    const cell = row?.[1] ?? "";

    const match =
      /\*\*(\d+) spec files\*\*\s*in `e2e\/`\s*—\s*(\d+) active,\s*(\d+) fully skipped/.exec(cell);
    expect(
      match,
      "the row must state the total, the active and the fully skipped spec files",
    ).toBeTruthy();

    const total = Number(match?.[1]);
    const active = Number(match?.[2]);
    const skipped = Number(match?.[3]);

    const skippedFiles = E2E_SPEC_FILES.filter((name) => countSkippedTests(name) > 0).length;

    expect(total, "ROADMAP.md must state the real number of spec files").toBe(
      E2E_SPEC_FILES.length,
    );
    expect(skipped, "ROADMAP.md must state the real number of fully skipped spec files").toBe(
      skippedFiles,
    );
    expect(active, "ROADMAP.md must state the real number of active spec files").toBe(
      E2E_SPEC_FILES.length - skippedFiles,
    );
  });

  it("names a HEAD commit that exists in the repository", () => {
    const roadmap = readDoc("ROADMAP.md");

    const match = /at commit `([0-9a-f]{7,40})`/.exec(roadmap);
    expect(match, "ROADMAP.md must name the commit it was measured against").toBeTruthy();
    const sha = match?.[1] ?? "";

    // A shallow clone — the CI checkout uses `fetch-depth: 1` — carries only
    // the tip commit, so the named object can legitimately be missing there.
    // The full-history case is the one that can actually be checked.
    const shallow = runCommand("git rev-parse --is-shallow-repository").output.trim() === "true";
    if (shallow) {
      expect(sha, "the named commit must be a hex object name").toMatch(/^[0-9a-f]{7,40}$/);
      return;
    }

    const exists = runCommand(`git cat-file -e '${sha}^{commit}'`);
    expect(
      exists.exitCode,
      `ROADMAP.md names commit ${sha}, which does not exist in this repository`,
    ).toBe(0);
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

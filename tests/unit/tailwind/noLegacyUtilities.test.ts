import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const SOURCE_DIRS = ["app", "src"];

const LEGACY_UTILITY_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "bg-gradient-to-*", pattern: /\bbg-gradient-to-[a-z]+\b/ },
  { name: "flex-grow-*", pattern: /\bflex-grow(?:-[a-z0-9]+)?\b/ },
  { name: "flex-shrink-*", pattern: /\bflex-shrink(?:-[a-z0-9]+)?\b/ },
  { name: "overflow-ellipsis", pattern: /\boverflow-ellipsis\b/ },
  { name: "decoration-slice", pattern: /\bdecoration-slice\b/ },
];

const listSourceFiles = (dir: string): string[] => {
  const absolute = resolve(root, dir);
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(absolute);
  return out;
};

const allSourceFiles = SOURCE_DIRS.flatMap(listSourceFiles);

describe("tailwind v4 utility migration", () => {
  it("contains no legacy Tailwind utility names in app/ and src/", () => {
    expect(allSourceFiles.length, "no source files found to scan").toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of allSourceFiles) {
      const contents = readFileSync(file, "utf-8");
      contents.split("\n").forEach((line, index) => {
        for (const { name, pattern } of LEGACY_UTILITY_PATTERNS) {
          if (pattern.test(line)) {
            offenders.push(
              `${file.slice(root.length + 1)}:${index + 1} uses legacy utility ${name}`,
            );
          }
        }
      });
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("keeps the game center free of gradient utilities", () => {
    const page = readFileSync(resolve(root, "app/game-center/page.tsx"), "utf-8");

    // The rule sheet is ruled lines, not gradient cards: the modes differ by
    // their rules, never by their colour.
    expect(page).not.toContain("bg-linear-to-br");
    expect(page).not.toContain("bg-gradient-to-br");
    expect(page).not.toMatch(/\b(?:from|to|via)-(?:red|blue|green|purple|amber|yellow|orange)-\d+/);
  });
});

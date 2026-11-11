import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The token layer is the contract: the components and pages reference the
 * design tokens as utilities and never as raw palette utilities. A palette
 * utility here would put a Tailwind default colour back into the product.
 *
 * The scan covers **every** component and every page, not just the shared
 * game components: a rule that only holds where someone remembered to
 * apply it is not a rule. The board was the counter-example — it carried its
 * own hex values until this scan was widened.
 */

const root = process.cwd();

/** The trees a UI file can live in. */
const ROOTS = ["src/components", "src/ui", "app"];

/** Every Tailwind default colour name, in the utility positions we use. */
const PALETTE_NAMES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";

const PALETTE_UTILITY = new RegExp(
  `\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|accent|decoration|caret|divide|placeholder)-(${PALETTE_NAMES})-\\d+`,
  "g",
);

/** An arbitrary colour value, e.g. `bg-[#1e1e23]`. */
const ARBITRARY_COLOUR = /\b(?:bg|text|border|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g;

/** A raw hex colour, e.g. `#1e1e23`. */
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;

/**
 * An emoji or a dingbat used as an icon.
 *
 * The design system bans emoji as icons; the pictographic planes are the
 * ones that matter. The arrows and the middle dot are punctuation, not
 * icons, and are left alone.
 */
const EMOJI_ICON =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F000}-\u{1F2FF}]/u;

/** Every UI file: components and pages, one `.tsx`/`.ts` each. */
function uiFiles(): string[] {
  const files: string[] = [];

  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      let isDirectory = false;
      try {
        isDirectory = readdirSync(path) !== null && !name.includes(".");
      } catch {
        isDirectory = false;
      }
      if (isDirectory && !name.includes(".")) {
        walk(path);
      } else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) {
        files.push(path);
      }
    }
  };

  for (const tree of ROOTS) {
    const directory = resolve(root, tree);
    try {
      readdirSync(directory);
    } catch {
      continue;
    }
    walk(directory);
  }

  return files;
}

describe("the token layer", () => {
  it("uses only semantic tokens and no palette utilities, raw hex or emoji", () => {
    const files = uiFiles();
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, "utf-8");
      contents.split("\n").forEach((line, index) => {
        const where = `${relative(root, file)}:${index + 1} ${line.trim()}`;
        if (PALETTE_UTILITY.test(line)) offenders.push(`palette: ${where}`);
        if (ARBITRARY_COLOUR.test(line)) offenders.push(`arbitrary colour: ${where}`);
        if (RAW_HEX.test(line)) offenders.push(`raw hex: ${where}`);
        if (EMOJI_ICON.test(line)) offenders.push(`emoji: ${where}`);
        // The regexes are global: reset them for the next line.
        PALETTE_UTILITY.lastIndex = 0;
        ARBITRARY_COLOUR.lastIndex = 0;
      });
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("references the token layer rather than raw values", () => {
    /** Any colour-bearing utility at all: a file that uses one is coloured. */
    const CARRIES_COLOUR = /\b(?:bg|text|border|fill|stroke)-/;

    for (const file of uiFiles()) {
      // The type and class modules hold no markup, so they have no utility.
      if (!file.endsWith(".tsx")) continue;
      const contents = readFileSync(file, "utf-8");
      // A file with no colour utility is a leaf: a type module, a constants
      // module or a helper such as a visually-hidden wrapper. It has nothing
      // to colour.
      if (!CARRIES_COLOUR.test(contents)) continue;
      expect(
        /bg-(?:surface|raised|sunken|board|brass)|text-(?:ink|brass|treble|double)/.test(contents),
        `${relative(root, file)} does not use the token layer`,
      ).toBe(true);
    }
  });
});

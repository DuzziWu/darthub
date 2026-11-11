import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compile } from "tailwindcss";

const root = process.cwd();

const globalsCss = () => readFileSync(resolve(root, "app/globals.css"), "utf8");
const layoutTs = () => readFileSync(resolve(root, "app/layout.tsx"), "utf8");

/**
 * Compiles the token layer alone, with the utilities the design system
 * publishes, and returns the emitted CSS. Compiling app/globals.css directly
 * (rather than the whole app) keeps the assertion about the token layer, not
 * about whichever page happens to use a utility today.
 */
const compileTokenLayer = async (candidates: string[]): Promise<string> => {
  const compiler = await compile(globalsCss(), {
    base: resolve(root, "app"),
    async loadStylesheet(id, base) {
      const file =
        id === "tailwindcss"
          ? resolve(root, "node_modules/tailwindcss/index.css")
          : resolve(base, id);
      return {
        path: file,
        base: file.slice(0, file.lastIndexOf("/")),
        content: readFileSync(file, "utf8"),
      };
    },
  });
  return compiler.build(candidates);
};

/** The class names emitted in the compiled CSS, including `:where(...)` selectors. */
const emittedClasses = (css: string): Set<string> =>
  new Set([...css.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1] ?? ""));

/** The declaration block of a single emitted utility. */
const utilityRule = (css: string, className: string): string =>
  css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

describe("design token layer", () => {
  it("defines every colour, type, spacing, radius and motion token from MASTER.md in @theme", () => {
    const expected: Record<string, string> = {
      // colour
      "--color-board": "#0c0c0e",
      "--color-surface": "#16161a",
      "--color-raised": "#1e1e23",
      "--color-sunken": "#08080a",
      "--color-rule": "#2a2a31",
      "--color-edge": "#6b6b78",
      "--color-ink": "#f2ede4",
      "--color-ink-muted": "#b9b2a6",
      "--color-ink-faint": "#8c857a",
      "--color-brass": "#e3a64f",
      "--color-brass-deep": "#8a6220",
      "--color-treble": "#59d6ae",
      "--color-double": "#e85c4a",
      // board material
      "--board-sisal-dark": "#141416",
      "--board-sisal-light": "#d9cfba",
      "--board-red": "#a32b22",
      "--board-green": "#1b6b47",
      "--board-bull-inner": "#1b6b47",
      "--board-bull-outer": "#e4dac4",
      "--board-ring": "#0e0e10",
      "--board-numeral": "#e8e2d4",
      "--board-wire": "#7a7a82",
      "--board-steel": "#33333a",
      // score-sheet chrome
      "--sheet-row-rule": "1px solid var(--color-rule)",
      "--sheet-col-gutter": "var(--color-ink-faint)",
      "--sheet-active-rail": "2px solid var(--color-brass)",
      // type scale
      "--text-display": "2rem",
      "--text-display--line-height": "2.25rem",
      "--text-title": "1.5rem",
      "--text-title--line-height": "1.875rem",
      "--text-heading": "1.125rem",
      "--text-heading--line-height": "1.5rem",
      "--text-body": "0.9375rem",
      "--text-body--line-height": "1.5rem",
      "--text-label": "0.8125rem",
      "--text-label--line-height": "1.25rem",
      "--text-caption": "0.75rem",
      "--text-caption--line-height": "1.125rem",
      "--text-score-xl": "3rem",
      "--text-score-xl--line-height": "3rem",
      "--text-score-lg": "2rem",
      "--text-score-lg--line-height": "2.25rem",
      "--text-score-md": "1.5rem",
      "--text-score-md--line-height": "1.875rem",
      "--text-score-sm": "1.125rem",
      "--text-score-sm--line-height": "1.5rem",
      // spacing — the token names and the utility-generating aliases
      "--space-xs": "2px",
      "--space-sm": "4px",
      "--space-md": "8px",
      "--space-lg": "12px",
      "--space-xl": "16px",
      "--space-2xl": "24px",
      "--space-3xl": "32px",
      "--space-4xl": "48px",
      "--spacing-xs": "2px",
      "--spacing-sm": "4px",
      "--spacing-md": "8px",
      "--spacing-lg": "12px",
      "--spacing-xl": "16px",
      "--spacing-2xl": "24px",
      "--spacing-3xl": "32px",
      "--spacing-4xl": "48px",
      // radius
      "--radius-xs": "2px",
      "--radius-sm": "3px",
      "--radius-md": "4px",
      "--radius-full": "9999px",
      // motion
      "--duration-instant": "80ms",
      "--duration-fast": "120ms",
      "--duration-base": "200ms",
      "--transition-duration-instant": "80ms",
      "--transition-duration-fast": "120ms",
      "--transition-duration-base": "200ms",
      "--ease-out": "cubic-bezier(0.2, 0, 0, 1)",
      "--ease-in": "cubic-bezier(0.4, 0, 1, 1)",
      "--ease-standard": "cubic-bezier(0.4, 0, 0.2, 1)",
      // elevation
      "--shadow-overlay": "0 16px 40px -12px rgb(0 0 0 / 0.7)",
    };

    const themeBlock = globalsCss().slice(
      globalsCss().indexOf("@theme"),
      globalsCss().indexOf("@utility"),
    );

    for (const [token, value] of Object.entries(expected)) {
      expect(themeBlock, `${token} must be declared in @theme`).toMatch(
        // Hex case is not significant; MASTER.md writes it upper case.
        new RegExp(`${token}:\\s*${value.replace(/[()]/g, "\\$&")}\\s*;`, "i"),
      );
    }
  });

  it("generates the semantic colour utilities from the token layer", async () => {
    const css = await compileTokenLayer([]);
    const classes = emittedClasses(css);

    for (const utility of [
      "bg-board",
      "bg-surface",
      "bg-raised",
      "bg-sunken",
      "text-ink",
      "text-ink-muted",
      "text-ink-faint",
      "border-rule",
      "border-edge",
      "bg-brass",
      "text-brass",
      "text-board",
      "text-treble",
      "text-double",
    ]) {
      expect(classes.has(utility), `the token layer must generate .${utility}`).toBe(true);
    }

    // The board material tokens are consumed by var() on the SVG nodes, so they
    // generate no utility — they must still be present in :root.
    expect(css).toMatch(/--board-red:\s*#a32b22/i);
  });

  it("generates the spacing and duration utilities, not only the custom properties", async () => {
    const css = await compileTokenLayer([]);
    const classes = emittedClasses(css);

    for (const utility of [
      "p-xs",
      "p-sm",
      "p-md",
      "p-lg",
      "p-xl",
      "p-2xl",
      "p-3xl",
      "p-4xl",
      "gap-xs",
      "gap-sm",
      "gap-md",
      "gap-lg",
      "gap-xl",
      "gap-2xl",
      "gap-3xl",
      "gap-4xl",
      "space-y-xs",
      "space-y-sm",
      "space-y-md",
      "space-y-lg",
      "space-y-xl",
      "space-y-2xl",
      "space-y-3xl",
      "space-y-4xl",
      "duration-instant",
      "duration-fast",
      "duration-base",
      "ease-out",
      "ease-in",
      "ease-standard",
    ]) {
      expect(classes.has(utility), `the token layer must generate .${utility}`).toBe(true);
    }

    // There is no bare `space-*` utility in Tailwind v4 — only the axis
    // variants exist.
    expect(classes.has("space-2xl")).toBe(false);
  });

  it("generates the role font utilities with their weights", async () => {
    const css = await compileTokenLayer([]);

    expect(utilityRule(css, "font-body")).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(utilityRule(css, "font-body")).toMatch(/font-weight:\s*400/);
    expect(utilityRule(css, "font-label")).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(utilityRule(css, "font-label")).toMatch(/font-weight:\s*500/);
    expect(utilityRule(css, "font-caption")).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(utilityRule(css, "font-caption")).toMatch(/font-weight:\s*500/);
  });

  it("applies the next font variable class to the html element", () => {
    const layout = layoutTs();

    // The variable classes must be applied to <html>, not <body>: the @theme
    // tokens are declared on :root, and :root is <html>.
    expect(layout).toMatch(/<html[^>]*className=\{`\$\{display\.variable\}/);
    expect(layout).not.toMatch(/<body[^>]*className=/);
  });

  it("self-hosts Barlow Condensed, Barlow and JetBrains Mono without a runtime Google Fonts request", () => {
    const layout = layoutTs();

    expect(layout).toMatch(/from "next\/font\/google"/);
    for (const family of ["Barlow_Condensed", "Barlow", "JetBrains_Mono"]) {
      expect(layout, `${family} must be loaded through next/font`).toMatch(
        new RegExp(`\\b${family}\\(\\{`),
      );
    }
    for (const weights of ['["600", "700"]', '["400", "500", "600"]', '["400", "500", "700"]']) {
      expect(layout).toContain(`weight: ${weights}`);
    }
    expect(layout).toContain('display: "swap"');

    // No runtime request to Google Fonts — the fonts are served from the build.
    expect(layout).not.toMatch(/fonts\.googleapis\.com/);
    expect(layout).not.toMatch(/fonts\.gstatic\.com/);
    expect(layout).not.toMatch(/<link[^>]*fonts\.google/);
  });

  it("maps the font families onto the display, sans and mono font utilities", async () => {
    const css = await compileTokenLayer([]);

    expect(utilityRule(css, "font-display")).toMatch(/var\(--font-barlow-condensed\)/);
    expect(utilityRule(css, "font-display")).toMatch(/"Arial Narrow"/);
    expect(utilityRule(css, "font-sans")).toMatch(/var\(--font-barlow\)/);
    expect(utilityRule(css, "font-mono")).toMatch(/var\(--font-jetbrains-mono\)/);

    // The next/font variable names must stay distinct from the @theme token
    // names, or one would silently overwrite the other.
    expect(css).not.toMatch(/--font-display:\s*var\(--font-display\)/);
    expect(layoutTs()).not.toMatch(/variable:\s*"--font-display"/);
    expect(layoutTs()).not.toMatch(/variable:\s*"--font-sans"/);
    expect(layoutTs()).not.toMatch(/variable:\s*"--font-mono"/);
  });

  it("renders the base surface and ink colours from the tokens rather than from palette utilities", async () => {
    const css = await compileTokenLayer([]);
    const body = css.match(/(?:^|[},])\s*body\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(body).toMatch(/background-color:\s*var\(--color-board\)/);
    expect(body).toMatch(/color:\s*var\(--color-ink\)/);
    expect(body).not.toMatch(/slate/);
    expect(globalsCss()).not.toMatch(/bg-slate-900/);
    expect(globalsCss()).not.toMatch(/text-slate-100/);
  });

  it("rejects a palette utility used in a component file", () => {
    // The palette families the codebase actually uses. A size or role utility
    // such as `text-xs` or `text-ink-muted` is not a palette utility and must
    // not trip this scan.
    const paletteFamilies = ["slate", "green", "purple", "blue", "amber", "red", "yellow"];
    const paletteUtility = new RegExp(
      `(?:^|[^\\w-])((?:bg|text|border|ring|outline|decoration|divide|from|via|to|fill|stroke|shadow|accent|caret|placeholder)-(?:${paletteFamilies.join("|")})-\\d{2,3})(?![-\\w])`,
      "g",
    );

    const paletteUtilitiesIn = (source: string): string[] =>
      [...source.matchAll(paletteUtility)].map((match) => match[1] ?? "");

    // Files still pending migration, enumerated. Each entry names the task that
    // removes it; an unenumerated allow-list is a test that passes for the
    // wrong reason.
    const pendingMigration = new Set([
      "app/career/page.tsx", // task 009
      "app/dashboard/page.tsx", // task 009
      "app/game-center/page.tsx", // task 006
      "app/game/around-the-clock/page.tsx", // task 008
      "app/game/cricket/page.tsx", // task 008
      "app/game/shanghai/page.tsx", // task 008
      "app/lobby/page.tsx", // task 009
      "src/components/game/GameResultBanner.tsx", // task 007
      "src/components/game/PlayerSetup.tsx", // task 007
      "src/components/game/ScoreDisplay.tsx", // task 007
      "src/components/game/ThrowInputPad.tsx", // task 007
    ]);

    const sourceFiles = (dir: string): string[] => {
      const absolute = resolve(root, dir);
      if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory()) return [];
      return readdirSync(absolute).flatMap((entry) => {
        const full = resolve(absolute, entry);
        if (statSync(full).isDirectory()) return sourceFiles(relative(root, full));
        return /\.(tsx?|css)$/.test(entry) ? [relative(root, full).replace(/\\/g, "/")] : [];
      });
    };

    const scanned = [...sourceFiles("app"), ...sourceFiles("src")];

    // The scan must be able to fail: a palette utility in a file this task owns
    // is reported.
    expect(paletteUtilitiesIn(`<div className="bg-blue-800 text-slate-100" />`)).toEqual([
      "bg-blue-800",
      "text-slate-100",
    ]);
    // ...and it must not report a legitimate utility.
    expect(paletteUtilitiesIn(`<div className="text-xs text-ink-muted p-md" />`)).toEqual([]);

    const violations: string[] = [];
    for (const file of scanned) {
      if (pendingMigration.has(file)) continue;
      const found = paletteUtilitiesIn(readFileSync(resolve(root, file), "utf8"));
      if (found.length > 0) violations.push(`${file}: ${found.join(", ")}`);
    }

    expect(violations, "raw palette utilities must be replaced by the token layer").toEqual([]);
  });
});

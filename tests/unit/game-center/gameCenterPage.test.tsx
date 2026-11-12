// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MODE_RULES, OUT_RULE_CHOICES, type ModeRuleEntry } from "@/game-engine/modes/registry";
import {
  Standard501Mode,
  Standard301Mode,
  type StandardMode,
} from "@/game-engine/modes/StandardMode";
import type { MutableMatchState, OutRuleId, ThrowSegment } from "@/game-engine/types";
import GameCenterPage from "../../../app/game-center/page";

/** The rule that does not apply to a mode is shown as an em dash. */
const NOT_APPLICABLE = "—";

/** The sheet's rows, as the text of their cells. */
function sheetRows(container: HTMLElement): string[][] {
  return [...container.querySelectorAll("tbody tr")].map((row) =>
    [...row.querySelectorAll("th, td")].map((cell) => cell.textContent?.trim() ?? ""),
  );
}

/** The cells a mode's row must carry, read from the registry. */
function expectedCells(rule: ModeRuleEntry): string[] {
  return [
    rule.name,
    rule.start ?? NOT_APPLICABLE,
    rule.winCondition,
    rule.checkout ?? NOT_APPLICABLE,
    rule.targets ?? NOT_APPLICABLE,
  ];
}

afterEach(() => {
  cleanup();
});

/** Does the mode accept this dart as the finish of a leg? */
function acceptsFinish(mode: StandardMode, segment: ThrowSegment, points: number): boolean {
  const draft: MutableMatchState = {
    matchId: "probe",
    status: "inProgress",
    players: [{ id: "p", totalPoints: 0 }],
    currentPlayerId: "p",
    throwsInCurrentTurn: 0,
    throwCount: 0,
    throws: [],
    corrections: [],
  };
  mode.initializeMatch(draft);
  draft.players[0]!.totalPoints = points;
  try {
    mode.applyThrow(draft, { playerId: "p", points, segment });
    return true;
  } catch {
    return false;
  }
}

/** The checkout rule the mode actually enforces, probed from its behaviour. */
function ruleInForce(mode: StandardMode): OutRuleId {
  if (acceptsFinish(mode, "single", 1)) {
    return "straight";
  }
  if (acceptsFinish(mode, "bull", 50)) {
    return "master";
  }
  return "double";
}

describe("Game Center rule sheet", () => {
  it("lists every game mode with its start score, win condition and targets", () => {
    const { container } = render(<GameCenterPage />);

    const rows = sheetRows(container);
    expect(rows).toHaveLength(MODE_RULES.length);
    expect(rows.map((row) => row[0])).toEqual(MODE_RULES.map((rule) => rule.name));
    expect(rows.map((row) => row[1])).toEqual(
      MODE_RULES.map((rule) => rule.start ?? NOT_APPLICABLE),
    );
    expect(rows.map((row) => row[2])).toEqual(MODE_RULES.map((rule) => rule.winCondition));
    expect(rows.map((row) => row[4])).toEqual(
      MODE_RULES.map((rule) => rule.targets ?? NOT_APPLICABLE),
    );
  });

  it("shows the checkout rule in force for the x01 modes", () => {
    const { container } = render(<GameCenterPage />);
    const rows = sheetRows(container);

    // The vocabulary of the checkout column.
    const labels: Record<OutRuleId, string> = {
      double: "Double out",
      master: "Master out",
      straight: "Straight out",
    };
    const checkoutOf = (id: string) => rows[MODE_RULES.findIndex((rule) => rule.id === id)]?.[3];

    // The sheet must name the rule the engine enforces, not the one it used to.
    expect(checkoutOf("501")).toBe(labels[ruleInForce(new Standard501Mode())]);
    expect(checkoutOf("301")).toBe(labels[ruleInForce(new Standard301Mode())]);
  });

  it("generates the rule values from the mode registry rather than from literals", () => {
    // The sheet is the shared component the home route renders too, so the
    // source that must read the registry is the component, not the page.
    const source = readFileSync(
      join(process.cwd(), "src", "components", "game", "RuleSheet.tsx"),
      "utf8",
    );

    // The sheet reads the registry ...
    expect(source).toContain("MODE_RULES");

    // ... and types none of the rule values itself.
    for (const rule of MODE_RULES) {
      for (const value of [rule.start, rule.winCondition, rule.checkout, rule.targets]) {
        if (value === null) {
          continue;
        }
        expect(source, `the sheet must not hard-code "${value}"`).not.toContain(value);
      }
    }
    for (const choice of OUT_RULE_CHOICES) {
      expect(source, `the sheet must not hard-code "${choice.label}"`).not.toContain(choice.label);
    }

    // The rendered sheet is the registry, cell for cell.
    const { container } = render(<GameCenterPage />);
    expect(sheetRows(container)).toEqual(MODE_RULES.map(expectedCells));
  });

  it("does not distinguish the modes by colour", () => {
    const { container } = render(<GameCenterPage />);

    // No palette colour and no gradient: the modes differ by their rules.
    const palette =
      /(?:bg|text|border|from|to|via|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-|\/|$)/;
    const gradient = /linear-to-|gradient-to-|linear-gradient/;
    for (const element of container.querySelectorAll("*")) {
      const className = element.getAttribute("class") ?? "";
      expect(palette.test(className), `"${className}" must not carry a palette colour`).toBe(false);
      expect(gradient.test(className), `"${className}" must not carry a gradient`).toBe(false);
      expect(element.getAttribute("style"), "a mode must not be coloured inline").toBeNull();
    }

    // Every mode is drawn by the same rules: identical rows, identical links.
    const rowClasses = new Set(
      [...container.querySelectorAll("tbody tr")].map((row) => row.getAttribute("class")),
    );
    expect(rowClasses.size).toBe(1);
    const linkClasses = new Set(
      [...container.querySelectorAll("tbody a")].map((link) => link.getAttribute("class")),
    );
    expect(linkClasses.size).toBe(1);
  });

  it("renders the rule sheet without a horizontal scrollbar at 390 pixels", () => {
    const { container } = render(<GameCenterPage />);

    // Below the md breakpoint the table is replaced by the stacked list, so
    // the wide element is never laid out on a narrow screen.
    const table = container.querySelector("table");
    expect(table?.className).toContain("hidden");
    expect(table?.className).toContain("md:table");
    const list = container.querySelector("dl");
    expect(list?.className).toContain("md:hidden");

    // Nothing in the sheet may force a sideways scroll.
    for (const element of container.querySelectorAll("*")) {
      const className = element.getAttribute("class") ?? "";
      expect(className).not.toMatch(/overflow-x-(auto|scroll)/);
      expect(className).not.toContain("whitespace-nowrap");
      for (const match of className.matchAll(/(?<![\w-])(?:min-)?w-\[(\d+)px\]/g)) {
        expect(Number(match[1]), `"${className}" must fit a 390px screen`).toBeLessThanOrEqual(390);
      }
    }

    // The stacked list carries every value the table carries.
    const listText = list?.textContent ?? "";
    for (const rule of MODE_RULES) {
      for (const value of [rule.start, rule.winCondition, rule.checkout, rule.targets]) {
        if (value === null) {
          continue;
        }
        expect(listText).toContain(value);
      }
    }
  });
});

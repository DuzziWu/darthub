// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import CricketPage from "../../../app/game/cricket/page";
import AroundTheClockPage from "../../../app/game/around-the-clock/page";
import ShanghaiPage from "../../../app/game/shanghai/page";

/**
 * The three non-x01 match views, migrated onto the shared components.
 *
 * Cricket, Around the Clock and Shanghai share a shape but not a model: they
 * have no remaining score, so each one shows what its mode actually has —
 * marks, a target and its progress, a round and its marks.
 *
 * The three modes read the *point value* of a dart and ignore its segment.
 * The inner bull (50) is therefore two cricket marks and the outer bull (25)
 * is one, and the views must not collapse the two.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const PAGE_FILES = [
  join("app", "game", "cricket", "page.tsx"),
  join("app", "game", "around-the-clock", "page.tsx"),
  join("app", "game", "shanghai", "page.tsx"),
];

const sourceOf = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

/** Every Tailwind default colour name, in the utility positions we use. */
const PALETTE_NAMES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";

const PALETTE_UTILITY = new RegExp(
  `\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|accent|decoration|caret|divide|placeholder)-(${PALETTE_NAMES})-\\d+`,
  "g",
);

const ARBITRARY_COLOUR = /\b(?:bg|text|border|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g;

afterEach(() => {
  cleanup();
});

/** Fills the setup form and starts the match. */
function startMatch(name = "Carol"): void {
  fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Start match" }));
}

/** The board's own keyboard grid, scoped so the pad's keys cannot match. */
function board(): HTMLElement {
  return screen.getByRole("group", { name: "Dartboard" });
}

/** Throws a dart on the board, by the outcome the board names it with. */
function throwOnBoard(outcome: string): void {
  fireEvent.click(within(board()).getByRole("button", { name: outcome }));
}

describe("the non-x01 match views", () => {
  it("uses the shared game components instead of a private copy", () => {
    for (const file of PAGE_FILES) {
      const source = sourceOf(file);

      // The views are built from the shared components, not from copies of them.
      expect(source, `${file} must import the shared components`).toMatch(
        /from "@\/components\/game\//,
      );
      expect(source, `${file} must import the shared board`).toMatch(/from "@\/components\/board"/);

      // A page that declares its own component has forked a shared one.
      // (The page's own default export is the one component it may declare.)
      expect(source, `${file} must not declare a component`).not.toMatch(
        /^\s*function [A-Z]\w*\s*\(/m,
      );
      expect(source, `${file} must not declare a component`).not.toMatch(
        /const [A-Z][a-z]\w* = \(/,
      );
    }

    // And the shared components are really on the surface.
    render(<CricketPage />);
    startMatch();
    expect(screen.getByRole("group", { name: "Dartboard" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Dart pad" })).toBeTruthy();
  });

  it("shows the cricket targets and their mark counts", () => {
    render(<CricketPage />);
    startMatch();

    for (const target of ["20", "19", "18", "17", "16", "15", "BULL"]) {
      expect(screen.getByLabelText(`${target}, 0 of 3 marks`)).toBeTruthy();
    }
  });

  it("counts the inner bull as two marks and the outer bull as one", () => {
    const { unmount } = render(<CricketPage />);
    startMatch();
    // The inner bull is 50 points, which the mode reads as two bull marks.
    throwOnBoard("Inner bull, 50 points");
    expect(screen.getByLabelText("BULL, 2 of 3 marks")).toBeTruthy();
    unmount();
    cleanup();

    render(<CricketPage />);
    startMatch();
    // The outer bull is 25 points: one bull mark.
    throwOnBoard("Outer bull, 25 points");
    expect(screen.getByLabelText("BULL, 1 of 3 marks")).toBeTruthy();
  });

  it("shows the current target and the progress in around the clock", () => {
    const { container } = render(<AroundTheClockPage />);
    startMatch("Dave");

    expect(container.querySelector("[data-current-target]")?.textContent).toBe("1");
    expect(screen.getByText("Progress 0 / 21")).toBeTruthy();
  });

  it("shows the round and its marks in shanghai", () => {
    render(<ShanghaiPage />);
    startMatch("Eve");

    expect(screen.getByText("Round 1 / 7")).toBeTruthy();
    expect(screen.getByLabelText("Round 1, target 1, 0 marks")).toBeTruthy();

    throwOnBoard("Single 1, 1 points");
    expect(screen.getByLabelText("Round 1, target 1, 1 marks")).toBeTruthy();
  });

  it("uses only semantic tokens and no palette utilities", () => {
    const offenders: string[] = [];
    for (const file of PAGE_FILES) {
      sourceOf(file)
        .split("\n")
        .forEach((line, index) => {
          if (PALETTE_UTILITY.test(line) || ARBITRARY_COLOUR.test(line)) {
            offenders.push(`${file}:${index + 1} ${line.trim()}`);
          }
          PALETTE_UTILITY.lastIndex = 0;
          ARBITRARY_COLOUR.lastIndex = 0;
        });
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("accepts a board throw and applies it to the mode", () => {
    // Cricket: one mark on the 20.
    const cricket = render(<CricketPage />);
    startMatch();
    throwOnBoard("Single 20, 20 points");
    expect(screen.getByLabelText("20, 1 of 3 marks")).toBeTruthy();
    cricket.unmount();
    cleanup();

    // Around the clock: the target advances.
    const clock = render(<AroundTheClockPage />);
    startMatch("Dave");
    throwOnBoard("Single 1, 1 points");
    expect(screen.getByText("Progress 1 / 21")).toBeTruthy();
    clock.unmount();
    cleanup();

    // Shanghai: the dart is worth one mark in the round.
    render(<ShanghaiPage />);
    startMatch("Eve");
    throwOnBoard("Single 1, 1 points");
    expect(screen.getByLabelText("Round 1, target 1, 1 marks")).toBeTruthy();
  });

  it("shows the win state when the match is over", () => {
    render(<AroundTheClockPage />);
    startMatch("Dave");

    // Every target from 1 to 20, then the bull.
    const pad = screen.getByRole("region", { name: "Dart pad" });
    for (let target = 1; target <= 20; target += 1) {
      fireEvent.click(
        within(pad).getByRole("button", { name: `Single ${target}, ${target} points` }),
      );
    }
    fireEvent.click(within(pad).getByRole("button", { name: "Outer bull, 25 points" }));

    expect(screen.getByRole("region", { name: "Match result" })).toBeTruthy();
    expect(screen.getByText("Dave wins")).toBeTruthy();
  });

  it("closes every cricket target and shows the win state", () => {
    render(<CricketPage />);
    startMatch("Carol");

    const pad = screen.getByRole("region", { name: "Dart pad" });
    const treble = within(pad).getByRole("radio", { name: "3× Treble" });
    const single = within(pad).getByRole("radio", { name: "1× Single" });

    // A treble closes the 20 in one dart.
    fireEvent.click(treble);
    fireEvent.click(within(pad).getByRole("button", { name: "Treble 20, 60 points" }));

    // The rest need three singles each.
    fireEvent.click(single);
    for (const target of [19, 18, 17, 16, 15]) {
      for (let mark = 0; mark < 3; mark += 1) {
        fireEvent.click(
          within(pad).getByRole("button", { name: `Single ${target}, ${target} points` }),
        );
      }
    }

    // The bull takes an outer bull (one mark) and an inner bull (two).
    fireEvent.click(within(pad).getByRole("button", { name: "Outer bull, 25 points" }));
    fireEvent.click(within(pad).getByRole("button", { name: "Inner bull, 50 points" }));

    expect(screen.getByRole("region", { name: "Match result" })).toBeTruthy();
    expect(screen.getByText("Carol wins")).toBeTruthy();
  });

  it("shows a cricket score sheet per player", () => {
    render(<CricketPage />);

    // Two players are seated: the ids come from the names the setup
    // collected, so every name owns a sheet.
    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText("Player 2"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // One section per player, each named by its owner.
    const alice = screen.getByLabelText("Alice cricket targets");
    const bob = screen.getByLabelText("Bob cricket targets");
    expect(alice).toBeTruthy();
    expect(bob).toBeTruthy();

    // The name is its own element, so it is found by name — scoped to the
    // sheet, because the overview above names the players as well.
    expect(within(alice).getByText("Alice")).toBeTruthy();
    expect(within(bob).getByText("Bob")).toBeTruthy();

    // The target label now matches twice — once per sheet — so it is read
    // per player.
    expect(within(alice).getByLabelText("20, 0 of 3 marks")).toBeTruthy();
    expect(within(bob).getByLabelText("20, 0 of 3 marks")).toBeTruthy();

    // The player on turn is marked on their own sheet, and on no other.
    expect(within(alice).getByText(/on turn/i)).toBeTruthy();
    expect(within(bob).queryByText(/on turn/i)).toBeNull();
  });

  it("shows an around the clock score sheet per player and announces a miss", () => {
    render(<AroundTheClockPage />);

    // Two players are seated: the ids come from the names the setup
    // collected, so every name owns a sheet.
    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText("Player 2"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // One section per player, each named by its owner.
    const alice = screen.getByLabelText("Alice around the clock");
    const bob = screen.getByLabelText("Bob around the clock");
    expect(alice).toBeTruthy();
    expect(bob).toBeTruthy();

    // The name is its own element, so it is found by name — scoped to the
    // sheet, because the overview above names the players as well.
    expect(within(alice).getByText("Alice")).toBeTruthy();
    expect(within(bob).getByText("Bob")).toBeTruthy();

    // The progress readout lives in the player's own section: with two
    // players an unscoped lookup finds two of them.
    expect(within(alice).getByText("Progress 0 / 21")).toBeTruthy();
    expect(within(bob).getByText("Progress 0 / 21")).toBeTruthy();

    // The player on turn is marked on their own sheet, and on no other.
    expect(within(alice).getByText(/on turn/i)).toBeTruthy();
    expect(within(bob).queryByText(/on turn/i)).toBeNull();

    // Every player has their own target: Alice's hit moves Alice's target
    // and leaves Bob's alone.
    throwOnBoard("Single 1, 1 points");
    expect(within(alice).getByText("Progress 1 / 21")).toBeTruthy();
    expect(within(bob).getByText("Progress 0 / 21")).toBeTruthy();
    expect(alice.querySelector("[data-current-target]")?.textContent).toBe("2");
    expect(bob.querySelector("[data-current-target]")?.textContent).toBe("1");

    // A dart on the wrong target is a visible miss: the dart is consumed
    // and the view says so instead of swallowing it.
    throwOnBoard("Single 5, 5 points");
    expect(screen.getByRole("status").textContent).toContain("Miss");
    expect(within(alice).getByText("Progress 1 / 21")).toBeTruthy();
  });

  it("shows a shanghai row per player and the marks of every round", () => {
    render(<ShanghaiPage />);

    // Two players are seated: the ids come from the names the setup
    // collected, so every name owns a row of the table.
    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText("Player 2"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // The sheet is one table: a row per player, a column per round.
    const table = screen.getByRole("table");
    const aliceRow = within(table).getByText("Alice").closest("tr") as HTMLElement;
    const bobRow = within(table).getByText("Bob").closest("tr") as HTMLElement;
    expect(aliceRow).toBeTruthy();
    expect(bobRow).toBeTruthy();

    // The player on turn is marked on their own row, and on no other.
    expect(within(aliceRow).getByText(/on turn/i)).toBeTruthy();
    expect(within(bobRow).queryByText(/on turn/i)).toBeNull();

    // Alice throws the three darts of the first round: a single 1 is one
    // mark, the two darts off the target score nothing.
    throwOnBoard("Single 1, 1 points");
    throwOnBoard("Single 20, 20 points");
    throwOnBoard("Single 20, 20 points");
    // Bob throws the three darts of the same round: a treble 1 is three
    // marks.
    throwOnBoard("Treble 1, 3 points");
    throwOnBoard("Single 20, 20 points");
    throwOnBoard("Single 20, 20 points");

    // The round is over when every player has thrown three darts.
    expect(screen.getByText("Round 2 / 7")).toBeTruthy();

    // The marks of the finished round are still in the table, and they
    // belong to the player who threw them: Alice scored one, Bob three.
    expect(within(aliceRow).getByLabelText("Round 1, target 1, 1 marks")).toBeTruthy();
    expect(within(bobRow).getByLabelText("Round 1, target 1, 3 marks")).toBeTruthy();

    // The next dart lands in the round in play: the table follows the
    // mode's rounds, not the index of the dart in the ledger.
    throwOnBoard("Single 2, 2 points");
    expect(within(aliceRow).getByLabelText("Round 2, target 2, 1 marks")).toBeTruthy();
    expect(within(bobRow).getByLabelText("Round 2, target 2, 0 marks")).toBeTruthy();
  });

  it("shows the shanghai segments after the match is won", () => {
    render(<ShanghaiPage />);
    startMatch("Eve");

    // The single, the double and the treble of the target in one round is
    // a Shanghai, and it ends the match on the spot.
    throwOnBoard("Single 1, 1 points");
    throwOnBoard("Double 1, 2 points");
    throwOnBoard("Treble 1, 3 points");

    // The match is over, so there is no player on turn any more — the
    // strip still reports the segments the winner hit.
    const sheet = screen.getByRole("region", { name: "Shanghai rounds" });
    expect(within(sheet).getByLabelText("Single, hit")).toBeTruthy();
    expect(within(sheet).getByLabelText("Double, hit")).toBeTruthy();
    expect(within(sheet).getByLabelText("Triple, hit")).toBeTruthy();
    expect(within(sheet).queryAllByLabelText(/missed/)).toHaveLength(0);

    // And the round in play is announced as the win it is.
    expect(within(sheet).getByText("Shanghai")).toBeTruthy();
  });
});

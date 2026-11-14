// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import CricketPage from "../../../app/game/cricket/page";
import AroundTheClockPage from "../../../app/game/around-the-clock/page";
import ShanghaiPage from "../../../app/game/shanghai/page";
import GamePage from "../../../app/game/page";
import Game301Page from "../../../app/game/301/page";

/**
 * Every mode offers the undo.
 *
 * The engine has always been able to undo; the gap was in the wiring. A
 * mode that cannot undo a mistyped dart forces the player to restart the
 * match, so each mode has to offer the control and it has to work.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/game",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/font/google", () => ({
  Barlow_Condensed: () => ({ variable: "--font-barlow-condensed", className: "font-display" }),
  Barlow: () => ({ variable: "--font-barlow", className: "font-body" }),
  JetBrains_Mono: () => ({ variable: "--font-mono", className: "font-mono" }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The board's own keyboard grid, scoped so the pad's keys cannot match. */
function board(): HTMLElement {
  return screen.getByRole("group", { name: "Dartboard" });
}

/** Throws a dart on the board, by the outcome the board names it with. */
function throwOnBoard(outcome: string): void {
  fireEvent.click(within(board()).getByRole("button", { name: outcome }));
}

/** The undo control, which every mode offers once a dart is in the ledger. */
function undoButton(): HTMLElement {
  return screen.getByRole("button", { name: /undo/i });
}

/** The chips of the visit in progress, named after the dart they show. */
function visitChips(): HTMLElement[] {
  return screen
    .getAllByRole("button")
    .filter((button) => (button.getAttribute("aria-label") ?? "").startsWith("Dart "));
}

describe("every mode offers the undo", () => {
  const MODES = [
    { name: "501", render: () => render(<GamePage />) },
    { name: "301", render: () => render(<Game301Page />) },
    { name: "cricket", render: () => render(<CricketPage />) },
    { name: "around the clock", render: () => render(<AroundTheClockPage />) },
    { name: "shanghai", render: () => render(<ShanghaiPage />) },
  ];

  for (const mode of MODES) {
    it(`${mode.name} undoes the dart it has just recorded`, () => {
      mode.render();
      fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
      fireEvent.click(screen.getByRole("button", { name: "Start match" }));

      throwOnBoard("Single 20, 20 points");

      // The dart is on the sheet before the undo.
      expect(visitChips().length).toBeGreaterThan(0);

      fireEvent.click(undoButton());

      // And it is gone afterwards.
      expect(visitChips()).toHaveLength(0);
    });
  }

  it("disables the undo before the first dart", () => {
    render(<CricketPage />);
    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    expect(undoButton().hasAttribute("disabled")).toBe(true);
  });

  it("undoes one dart at a time", () => {
    render(<CricketPage />);
    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    throwOnBoard("Single 20, 20 points");
    throwOnBoard("Single 20, 20 points");
    expect(visitChips().length).toBeGreaterThan(1);

    fireEvent.click(undoButton());

    expect(visitChips().length).toBe(1);
  });
});

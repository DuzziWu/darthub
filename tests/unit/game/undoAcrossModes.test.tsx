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
  // The 501 needs two players — a game with a single participant is not a
  // 501 game — so it is filled with two names. The other modes accept one.
  const MODES = [
    { name: "501", render: () => render(<GamePage />), names: ["Ann", "Bo"] },
    { name: "301", render: () => render(<Game301Page />), names: ["Ann"] },
    { name: "cricket", render: () => render(<CricketPage />), names: ["Ann"] },
    { name: "around the clock", render: () => render(<AroundTheClockPage />), names: ["Ann"] },
    { name: "shanghai", render: () => render(<ShanghaiPage />), names: ["Ann"] },
  ];

  for (const mode of MODES) {
    it(`${mode.name} undoes the dart it has just recorded`, () => {
      mode.render();
      mode.names.forEach((name, index) => {
        fireEvent.change(screen.getByLabelText(`Player ${index + 1}`), {
          target: { value: name },
        });
      });
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

/**
 * Whether the player on turn is low enough that a treble of 20 busts.
 *
 * The 501 starts at 501, so the score sheet has to be read to find out.
 */
function canBust(): boolean {
  const sheet = screen.getByRole("region", { name: "Score sheet" });
  const onTurn = within(sheet)
    .getAllByRole("listitem")
    .find((row) => row.textContent?.includes("ON TURN"));
  const remaining = onTurn?.textContent?.match(/(\d+)$/)?.[1];
  return remaining !== undefined && Number(remaining) <= 60;
}

/**
 * The finished-visit confirmation, reachable in the product.
 *
 * A visit ends when the turn advances and when a dart busts. The throw
 * strip shows the darts of the turn in progress, so a dart of a finished
 * visit is only on screen when the turn itself spans two visits — which
 * is what a bust does: the bust closes the visit, and the dart after it
 * opens the next one. x01 is the mode that busts, so the 501 view is
 * where the confirmation has to be reachable.
 */
describe("the finished-visit confirmation", () => {
  it("asks for confirmation before correcting a dart of a finished visit", () => {
    render(<GamePage />);
    // The 501 needs two players.
    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Player 2"), { target: { value: "Bo" } });
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // Trebles of 20 until Ann is low enough to bust.
    for (let dart = 0; dart < 40 && !canBust(); dart += 1) {
      throwOnBoard("Treble 20, 60 points");
    }
    // The trebles overshoot and bust, which closes the visit.
    throwOnBoard("Treble 20, 60 points");

    // The bust closed the visit, so the turn still shows a dart of it.
    const chips = visitChips();
    expect(chips.length).toBeGreaterThan(1);

    fireEvent.click(chips[0]!);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Finished visit");

    // And the confirmation arms the dart once it is confirmed.
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Correcting/)).toBeTruthy();
  });
});

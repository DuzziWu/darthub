// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * The finished-visit confirmation, reachable in the product.
 *
 * A visit ends when the turn advances and when a dart busts. The throw
 * strip shows the darts of the turn in progress, so a dart of a finished
 * visit is only on screen when the turn itself spans two visits — which
 * is what a bust does: the bust closes the visit, and the dart after it
 * opens the next one. x01 is the mode that busts, so the 501 view is
 * where the confirmation has to be reachable.
 *
 * The other three views are wired the same way (the test below reads their
 * source), but their modes never bust: there the turn and the visit are
 * the same group, and a visit that is over belongs to a turn that is over
 * as well — its darts are no longer on the strip.
 */

/** The match views that show the throw strip. */
const MATCH_VIEWS = [
  join("app", "game", "cricket", "page.tsx"),
  join("app", "game", "around-the-clock", "page.tsx"),
  join("app", "game", "shanghai", "page.tsx"),
  join("src", "components", "x01", "X01MatchView.tsx"),
];

describe("the finished-visit confirmation", () => {
  it("asks for confirmation before correcting a dart of a finished visit", () => {
    render(<GamePage />);
    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // Eight trebles of 20 leave 21 points; the ninth overshoots and busts.
    for (let dart = 0; dart < 8; dart += 1) {
      throwOnBoard("Treble 20, 60 points");
    }
    throwOnBoard("Treble 20, 60 points"); // the bust

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

  it("wires the confirmation through every match view", () => {
    for (const file of MATCH_VIEWS) {
      const source = readFileSync(join(process.cwd(), file), "utf8");

      // The strip needs the flag and the handler, or the confirmation can
      // never appear — however good the hook and the component are.
      expect(source, `${file} must pass awaitingConfirmation on`).toMatch(
        /awaitingConfirmation=\{history\.awaitingConfirmation\}/,
      );
      expect(source, `${file} must pass onConfirm on`).toMatch(
        /onConfirm=\{history\.confirmCorrection\}/,
      );
    }
  });
});

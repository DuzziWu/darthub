// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { X01MatchView } from "@/components/x01/X01MatchView";
import { PLAYER_ERROR_TEXTS } from "@/components/game/playerErrors";

/**
 * The x01 view and a refused correction.
 *
 * The correction flow is the one place where the engine refuses a dart on
 * purpose, and the view has to answer that refusal with the player's text
 * — the German sentence of the error's **code**, never the engine's English
 * message, and never a bust that did not happen.
 *
 * The journey is the one the correction flow exists for: a bust in the
 * middle of a turn, corrected afterwards.
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
  JetBrains_Mono: () => ({ variable: "--font-jetbrains-mono", className: "font-mono" }),
}));

/** The dart pad: the armed band, the sectors and the bulls. */
function pad() {
  return within(screen.getByRole("region", { name: "Dart pad" }));
}

/** Arms the pad's band: 1×, 2× or 3×. */
function armBand(band: "Single" | "Double" | "Treble"): void {
  fireEvent.click(pad().getByRole("radio", { name: new RegExp(band, "i") }));
}

/** Throws a treble 20 with the pad. */
function throwTreble20(): void {
  armBand("Treble");
  fireEvent.click(pad().getByRole("button", { name: "Treble 20, 60 points" }));
}

/** Throws a single of the sector with the pad. */
function throwSingle(sector: number): void {
  armBand("Single");
  fireEvent.click(pad().getByRole("button", { name: `Single ${sector}, ${sector} points` }));
}

/**
 * The match's status line — the `role="status"` region of `MatchStatus`.
 *
 * The strip names the armed dart in a status region of its own, so the
 * announcement is picked out by its element: the status line is the
 * paragraph.
 */
function statusLine(): HTMLElement {
  const line = screen.getAllByRole("status").find((region) => region.tagName === "P");
  if (line === undefined) {
    throw new Error("the match status line is not in the document");
  }
  return line;
}

/** Starts a 501 with the checkout rule that accepts any finish. */
function startMatch(): void {
  render(<X01MatchView startScore={501} modeName="501" />);
  fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Dave" } });
  fireEvent.click(screen.getByRole("radio", { name: /straight out/i }));
  fireEvent.click(screen.getByRole("button", { name: /start match/i }));
}

/**
 * The journey: eight treble 20s, a busting treble 20 and three singles.
 *
 * 501 − 480 leaves 21, so the ninth treble 20 busts. The three singles
 * then bring the score down to 10 — and they are the reason the
 * correction of the bust is refused: counting the bust would move them
 * into another turn of the ledger.
 */
function throwTheJourney(): void {
  for (let dart = 0; dart < 8; dart += 1) {
    throwTreble20();
  }
  throwTreble20();
  throwSingle(7);
  throwSingle(3);
  throwSingle(1);
}

/** Arms the busting dart as the correction target and confirms it. */
function armTheBust(): void {
  fireEvent.click(screen.getByRole("button", { name: /^Dart \d+: BUST$/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
}

describe("the x01 view and a refused correction", () => {
  it("shows the player's text when the engine refuses the correction", () => {
    startMatch();
    throwTheJourney();
    armTheBust();

    // The engine refuses: counting the bust would move the later darts
    // into another turn of the ledger.
    throwSingle(7);

    // The status line reads the sentence of the error's code.
    expect(statusLine().textContent).toBe(PLAYER_ERROR_TEXTS.TURN_ROTATION_CHANGED);

    // The engine's own message never reaches the player.
    expect(screen.queryByText(/The correction would change the turn order/)).toBeNull();
    expect(document.body.textContent).not.toContain("turn order");
  });

  it("does not announce a bust when it refuses a correction", () => {
    startMatch();
    throwTheJourney();
    armTheBust();

    // This value busts the corrected dart itself. The view's own bust
    // computation is meaningless while a correction is armed — it is
    // computed from the score that is left now, not from the score the
    // corrected dart was thrown at — so the refusal must not be announced
    // as a bust: nothing busted, and nothing changed.
    throwTreble20();

    expect(statusLine().textContent).toBe(PLAYER_ERROR_TEXTS.CORRECTION_WOULD_BUST);
    expect(statusLine().textContent).not.toContain("Bust");
    expect(screen.queryByText(/Bust\./)).toBeNull();
  });

  it("keeps the armed target after a refusal, so the player can try again", () => {
    startMatch();
    throwTheJourney();
    armTheBust();

    throwSingle(7);

    // The refusal changed nothing: the ledger holds the same four darts,
    // and the bust is still the armed correction target.
    const chips = screen
      .getAllByRole("button")
      .filter((button) => (button.getAttribute("aria-label") ?? "").startsWith("Dart"));
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "Dart 1: BUST",
      "Dart 2: S7",
      "Dart 3: S3",
      "Dart 4: S1",
    ]);
    expect(chips[0]?.getAttribute("aria-pressed")).toBe("true");
  });
});

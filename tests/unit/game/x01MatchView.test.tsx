// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { X01MatchView } from "@/components/x01/X01MatchView";
import { GameEngine } from "@/game-engine/GameEngine";
import GamePage from "../../../app/game/page";

/**
 * The x01 match view: the board, the dart pad, the score sheet and the
 * checkout rule.
 *
 * The view is what makes the advertised rule real — the segment of every dart
 * reaches the engine, so a double can finish a leg that a single cannot, and
 * a bust leaves the score alone.
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The board's own keyboard grid, where every cell is a real button. */
function board() {
  return within(screen.getByRole("group", { name: "Dartboard" }));
}

/** The dart pad: the armed band, the sectors and the bulls. */
function pad() {
  return within(screen.getByRole("region", { name: "Dart pad" }));
}

/** The score sheet. */
function sheet() {
  return within(screen.getByRole("region", { name: "Score sheet" }));
}

/** The strip along the top of the match. */
function header() {
  return within(screen.getByRole("region", { name: "Match header" }));
}

/** Starts a match of `startScore` points, optionally choosing a checkout rule. */
function startMatch(startScore: number, rule?: "double" | "master" | "straight") {
  render(<X01MatchView startScore={startScore} modeName="501" />);
  fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Dave" } });
  if (rule) {
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(rule, "i") }));
  }
  fireEvent.click(screen.getByRole("button", { name: /start match/i }));
}

/** Arms the pad's band: 1×, 2× or 3×. */
function armBand(band: "Single" | "Double" | "Treble") {
  fireEvent.click(pad().getByRole("radio", { name: new RegExp(band, "i") }));
}

describe("the x01 match view", () => {
  it("submits the segment with every throw", () => {
    const recordThrow = vi.spyOn(GameEngine.prototype, "recordThrow");
    startMatch(501);

    // A bed of the board: the double 16.
    fireEvent.click(board().getByRole("button", { name: "Double 16, 32 points" }));
    expect(recordThrow).toHaveBeenLastCalledWith(
      expect.objectContaining({ points: 32, segment: "double" }),
    );

    // The dart pad: the treble 20.
    armBand("Treble");
    fireEvent.click(pad().getByRole("button", { name: "Treble 20, 60 points" }));
    expect(recordThrow).toHaveBeenLastCalledWith(
      expect.objectContaining({ points: 60, segment: "triple" }),
    );

    // The bulls are segments too.
    fireEvent.click(pad().getByRole("button", { name: "Inner bull, 50 points" }));
    expect(recordThrow).toHaveBeenLastCalledWith(
      expect.objectContaining({ points: 50, segment: "bull" }),
    );
  });

  it("lets a double finish the leg when the dart pad is used", () => {
    startMatch(40);

    armBand("Double");
    fireEvent.click(pad().getByRole("button", { name: "Double 20, 40 points" }));

    // The leg is over, and the result says who won it.
    expect(screen.getByRole("region", { name: "Match result" })).toBeTruthy();
    expect(screen.getByText("Dave wins")).toBeTruthy();
  });

  it("passes the chosen checkout rule to the match configuration", () => {
    const startMatchSpy = vi.spyOn(GameEngine.prototype, "startMatch");

    startMatch(501, "master");

    expect(startMatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ playerIds: ["player1"], outRule: "master" }),
    );
  });

  it("records a miss as a legal throw", () => {
    const recordThrow = vi.spyOn(GameEngine.prototype, "recordThrow");
    startMatch(501);

    fireEvent.click(pad().getByRole("button", { name: "Miss, 0 points" }));

    // A miss scores nothing and carries no segment — the engine rejects a
    // segment on a zero-scoring throw.
    expect(recordThrow).toHaveBeenLastCalledWith(expect.objectContaining({ points: 0 }));
    expect(recordThrow.mock.calls.at(-1)?.[0]).not.toHaveProperty("segment");

    // It is a legal throw: the score is unchanged and the dart was counted.
    expect(sheet().getByText("501")).toBeTruthy();
    expect(sheet().getByText("MISS")).toBeTruthy();
  });

  it("shows the resolved segment in the throw history", () => {
    startMatch(501);

    fireEvent.click(board().getByRole("button", { name: "Double 16, 32 points" }));

    // The visit is named by where the dart landed, not only by its score.
    expect(sheet().getByText("D16")).toBeTruthy();
    expect(header().getByText("D16")).toBeTruthy();
  });

  it("shows a bust chip when a throw busts and leaves the score unchanged", () => {
    startMatch(20);

    // A single of 20 would finish the leg, but only a double may.
    armBand("Single");
    fireEvent.click(pad().getByRole("button", { name: "Single 20, 20 points" }));

    expect(sheet().getByText("BUST")).toBeTruthy();
    // The bust consumed no dart and took no score.
    expect(sheet().getByText("20")).toBeTruthy();
  });

  it("shows the board source in the match header", () => {
    startMatch(501);

    expect(header().getByText("Virtual Board")).toBeTruthy();
  });

  it("renders inside the shell's main landmark", async () => {
    const { default: RootLayout } = await import("../../../app/layout");

    const { container } = render(
      <RootLayout>
        <GamePage />
      </RootLayout>,
    );

    const mains = container.querySelectorAll("main");
    expect(mains.length).toBe(1);
    expect(mains[0]?.id).toBe("main");
  });
});

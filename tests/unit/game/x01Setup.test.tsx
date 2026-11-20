// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { outRuleChoices } from "@/game-engine/modes/registry";
import { AI_AVERAGE_LEVELS, DEFAULT_AI_AVERAGE } from "@/ai/averages";
import { X01MatchView } from "@/components/x01/X01MatchView";
import GamePage from "../../../app/game/page";
import Game301Page from "../../../app/game/301/page";

/**
 * The setup of the 501: the participants, the seat kinds, the checkout rule
 * and the match format.
 *
 * The 501 is the mode with seats and with a minimum of two players, so its
 * setup differs from the other modes. The 301 shares the view and must keep
 * what it has.
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
  Barlow_Condensed: () => ({ variable: "--font-barclay-condensed", className: "font-display" }),
  Barlow: () => ({ variable: "--font-barclay", className: "font-body" }),
  JetBrains_Mono: () => ({ variable: "--font-jetbrains-mono", className: "font-mono" }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The radio group of the match format, by the value of its radio. */
function formatValues(): (string | null)[] {
  const group = screen.getByRole("radiogroup", { name: /match format/i });
  return Array.from(group.querySelectorAll("input")).map((input) => input.getAttribute("value"));
}

describe("the 501 setup", () => {
  it("needs two players and offers up to four", () => {
    render(<GamePage />);

    // Two seats to start with, and the seats can grow to four. Each seat
    // carries a radio group for its kind — "Sitzplatz 1: Typ".
    expect(screen.getAllByRole("radiogroup", { name: /typ/i })).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Spieler hinzufügen/ }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("refuses to start with a single player and says so", () => {
    render(<GamePage />);

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("At least 2");
  });

  it("starts with two players", () => {
    render(<GamePage />);

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Player 2"), { target: { value: "Bo" } });
    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    // The match is under way: the pad is the input.
    expect(screen.getByRole("region", { name: "Dart pad" })).toBeTruthy();
  });

  it("offers straight out and double out, and no master out", () => {
    render(<GamePage />);

    expect(screen.getByRole("radio", { name: /straight out/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /double out/i })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /master out/i })).toBeNull();
  });

  it("offers the five match formats of the requirement", () => {
    render(<GamePage />);

    expect(formatValues()).toEqual(["single", "bo3", "bo5", "bo7", "bo9"]);
  });

  it("marks the AI seats on the score sheet", () => {
    render(<GamePage />);

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Player 2"), { target: { value: "Bo" } });
    // The second seat is the AI.
    fireEvent.click(screen.getAllByRole("radio", { name: "KI" })[1]!);
    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    // The player overview says who sits where.
    const overview = screen.getByRole("region", { name: "Player overview" });
    const rows = Array.from(overview.querySelectorAll("li")).map((row) => row.textContent ?? "");
    // The person is a person, the AI is marked and carries its average.
    expect(rows.some((row) => row.includes("Ann") && row.includes("Mensch"))).toBe(true);
    expect(rows.some((row) => row.includes("KI") && row.includes("40"))).toBe(true);
  });

  it("keeps the order of the seats as the order of the visits", () => {
    render(<GamePage />);

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Player 2"), { target: { value: "Bo" } });
    // Bo moves in front of Ann.
    fireEvent.click(screen.getByRole("button", { name: "Bo nach oben" }));
    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    const overview = screen.getByRole("region", { name: "Player overview" });
    const rows = Array.from(overview.querySelectorAll("li")).map((row) => row.textContent ?? "");
    // The overview lists the players in the order they play.
    expect(rows[0]).toContain("Bo");
    expect(rows[1]).toContain("Ann");
  });
});

describe("the configuration of a match", () => {
  it("survives a restart of the match", () => {
    // A short match, so the leg can be won in a single dart.
    render(
      <X01MatchView
        startScore={40}
        modeName="501"
        minPlayers={2}
        seatConfig={{ averages: AI_AVERAGE_LEVELS, defaultAverage: DEFAULT_AI_AVERAGE }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText("Player 2"), { target: { value: "Bo" } });
    // The second seat is the AI.
    fireEvent.click(screen.getAllByRole("radio", { name: "KI" })[1]!);
    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    // The double finishes the leg.
    const pad = within(screen.getByRole("region", { name: "Dart pad" }));
    fireEvent.click(pad.getByRole("radio", { name: /double/i }));
    fireEvent.click(pad.getByRole("button", { name: "Double 20, 40 points" }));

    expect(screen.getByRole("region", { name: "Match result" })).toBeTruthy();

    // The replay keeps the table: the same names in the same order, and the
    // AI is still the AI.
    fireEvent.click(screen.getByRole("button", { name: /play again/i }));

    const overview = screen.getByRole("region", { name: "Player overview" });
    const rows = Array.from(overview.querySelectorAll("li")).map((row) => row.textContent ?? "");
    expect(rows[0]).toContain("Ann");
    expect(rows[1]).toContain("Bo");
    expect(rows[1]).toContain("KI");
  });
});

describe("the 301 setup", () => {
  it("keeps every checkout rule and its three match formats", () => {
    render(<Game301Page />);

    expect(screen.getByRole("radio", { name: /double out/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /master out/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /straight out/i })).toBeTruthy();
    expect(formatValues()).toEqual(["single", "bo3", "bo5"]);
  });

  it("keeps its plain name fields and no seats", () => {
    render(<Game301Page />);

    expect(screen.getByLabelText("Player 1")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "KI" })).toBeNull();
  });
});

describe("outRuleChoices", () => {
  it("keeps the order of the full list", () => {
    expect(outRuleChoices(["straight", "double"]).map((choice) => choice.id)).toEqual([
      "double",
      "straight",
    ]);
  });

  it("leaves out the rules that are not asked for", () => {
    const chosen = outRuleChoices(["master"]);
    expect(chosen).toHaveLength(1);
    expect(chosen[0]!.id).toBe("master");
  });
});

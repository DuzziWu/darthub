// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GameResultBanner } from "@/components/game/GameResultBanner";
import CricketPage from "../../../app/game/cricket/page";

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

afterEach(cleanup);

function startMatch(name = "Carol"): void {
  fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Start match" }));
}

function pad(): HTMLElement {
  return screen.getByRole("region", { name: "Dart pad" });
}

/** Throws a treble 20 with the dart pad. */
function throwTreble20(): void {
  const p = pad();
  fireEvent.click(within(p).getByRole("radio", { name: "3× Treble" }));
  fireEvent.click(within(p).getByRole("button", { name: "Treble 20, 60 points" }));
}

describe("cricket correction & undo", () => {
  it("taps a recorded dart, replaces its value, and replays the marks", () => {
    render(<CricketPage />);
    startMatch();
    throwTreble20();

    // The dart is on the strip and closed the 20.
    expect(screen.getByRole("button", { name: "Dart 1: T20" })).toBeTruthy();
    expect(screen.getByLabelText("20, 3 of 3 marks, closed")).toBeTruthy();

    // Tap the dart: it becomes the correction target.
    fireEvent.click(screen.getByRole("button", { name: "Dart 1: T20" }));
    expect(screen.getByText(/correcting t20/i)).toBeTruthy();

    // Enter the replacement with the same pad.
    fireEvent.click(within(pad()).getByRole("button", { name: "Inner bull, 50 points" }));

    // Replaced, not appended: one dart on the strip, now the double bull.
    const chips = screen
      .getAllByRole("button")
      .filter((b) => (b.getAttribute("aria-label") ?? "").startsWith("Dart"));
    expect(chips).toHaveLength(1);
    expect(chips[0]?.getAttribute("aria-label")).toBe("Dart 1: BULL 50");
    // The whole match re-derived: the 20 is open again, the bull has two marks.
    expect(screen.getByLabelText("20, 0 of 3 marks")).toBeTruthy();
    expect(screen.getByLabelText("BULL, 2 of 3 marks")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dart 1: BULL 50" })).toBeTruthy();
  });

  it("undo restores the state before the dart", () => {
    render(<CricketPage />);
    startMatch();
    throwTreble20();
    expect(screen.getByLabelText("20, 3 of 3 marks, closed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    const chips = screen
      .getAllByRole("button")
      .filter((b) => (b.getAttribute("aria-label") ?? "").startsWith("Dart"));
    expect(chips).toHaveLength(0);
    expect(screen.getByLabelText("20, 0 of 3 marks")).toBeTruthy();
  });

  it("undo is protected on an empty ledger", () => {
    render(<CricketPage />);
    startMatch();

    // No dart entered: the button is disabled, so there is nothing to undo
    // and nothing to crash on.
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("region", { name: "Dart pad" })).toBeTruthy();
  });

  it("an arm-cancel-arm cycle never loses or duplicates a dart", () => {
    render(<CricketPage />);
    startMatch();
    throwTreble20();

    fireEvent.click(screen.getByRole("button", { name: "Dart 1: T20" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Dart 1: T20" }));
    fireEvent.click(within(pad()).getByRole("button", { name: "Inner bull, 50 points" }));

    const chips = screen
      .getAllByRole("button")
      .filter((b) => (b.getAttribute("aria-label") ?? "").startsWith("Dart"));
    expect(chips).toHaveLength(1);
    expect(chips[0]?.getAttribute("aria-label")).toBe("Dart 1: BULL 50");
  });

  it("cancelling a correction changes nothing", () => {
    render(<CricketPage />);
    startMatch();
    throwTreble20();

    fireEvent.click(screen.getByRole("button", { name: "Dart 1: T20" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/correcting t20/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Dart 1: T20" })).toBeTruthy();
    expect(screen.getByLabelText("20, 3 of 3 marks, closed")).toBeTruthy();
  });
});

describe("the result banner offers an undo of the winning dart", () => {
  it("renders and fires the undo action when given one", () => {
    const onUndo = vi.fn();
    render(
      <GameResultBanner
        winnerId="carol"
        players={[{ id: "carol", totalPoints: 40 }]}
        playerNames={{ carol: "Carol" }}
        onPlayAgain={() => {}}
        onBackToHub={() => {}}
        onUndo={onUndo}
      />,
    );
    const undo = screen.getByRole("button", { name: /undo last dart/i });
    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("stays unchanged when no undo is offered", () => {
    render(
      <GameResultBanner
        winnerId="carol"
        players={[{ id: "carol", totalPoints: 40 }]}
        playerNames={{ carol: "Carol" }}
        onPlayAgain={() => {}}
        onBackToHub={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /undo last dart/i })).toBeNull();
  });
});

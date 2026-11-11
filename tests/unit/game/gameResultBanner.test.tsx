// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameResultBanner } from "@/components/game/GameResultBanner";

/**
 * The result state: the display face, the leg it took, the final scores as
 * a mini sheet, and two actions. No emoji, and no invented statistic.
 */

afterEach(() => {
  cleanup();
});

const PLAYERS = [
  { id: "p1", totalPoints: 32 },
  { id: "p2", totalPoints: 140 },
];

const NAMES = { p1: "Dave", p2: "Sam" };

describe("GameResultBanner", () => {
  it("names the winner and the leg in the display face", () => {
    const { container } = render(
      <GameResultBanner
        winnerId="p1"
        players={PLAYERS}
        playerNames={NAMES}
        onPlayAgain={vi.fn()}
        onBackToHub={vi.fn()}
        leg={{ current: 2, total: 5 }}
      />,
    );

    const headline = container.querySelector("[data-result-headline]");
    expect(headline?.textContent).toContain("Dave");
    expect(headline?.textContent).toContain("leg 2");
    expect(headline?.className).toContain("font-display");
    // No emoji: the trophy is a Lucide icon, and it is decorative.
    expect(headline?.textContent).not.toContain("🏆");
    expect(headline?.textContent).not.toContain("👑");
  });

  it("marks the winning row with the word WIN, not with colour alone", () => {
    const { container } = render(
      <GameResultBanner
        winnerId="p1"
        players={PLAYERS}
        playerNames={NAMES}
        onPlayAgain={vi.fn()}
        onBackToHub={vi.fn()}
      />,
    );

    const winner = container.querySelector('[data-result-row="p1"]');
    expect(winner?.textContent).toContain("WIN");
    expect(container.querySelector('[data-result-row="p2"]')?.textContent).toContain("2ND");
  });

  it("states the margin from the engine state", () => {
    const { container } = render(
      <GameResultBanner
        winnerId="p1"
        players={PLAYERS}
        playerNames={NAMES}
        onPlayAgain={vi.fn()}
        onBackToHub={vi.fn()}
      />,
    );

    // Dave finished with 32 left, Sam with 140: a margin of 108.
    expect(container.textContent?.toLowerCase()).toContain("won by 108 points");
  });

  it("offers the two actions", () => {
    const onPlayAgain = vi.fn();
    const onBackToHub = vi.fn();
    render(
      <GameResultBanner
        winnerId="p1"
        players={PLAYERS}
        playerNames={NAMES}
        onPlayAgain={onPlayAgain}
        onBackToHub={onBackToHub}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /game center/i }));
    expect(onBackToHub).toHaveBeenCalledTimes(1);
  });

  it("gives both actions a focus ring and a disabled state", () => {
    render(
      <GameResultBanner
        winnerId="p1"
        players={PLAYERS}
        playerNames={NAMES}
        onPlayAgain={vi.fn()}
        onBackToHub={vi.fn()}
      />,
    );

    screen.getAllByRole("button").forEach((button) => {
      expect(button.className).toContain("focus-visible:");
      expect(button.className).toContain("disabled:");
      expect(button.className).toContain("h-11");
    });
  });
});

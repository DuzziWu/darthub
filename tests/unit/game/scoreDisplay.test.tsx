// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ScoreDisplay } from "@/components/game/ScoreDisplay";

/**
 * The score sheet is read mid-turn, so every state it carries has to survive
 * with the colour removed: a counted visit says so, a bust says BUST, and
 * the remaining score is a tabular figure that never moves.
 */

afterEach(() => {
  cleanup();
});

const PLAYERS = [
  { id: "p1", totalPoints: 140 },
  { id: "p2", totalPoints: 132 },
];

const NAMES = { p1: "Dave", p2: "Sam" };

describe("ScoreDisplay", () => {
  it("marks a counted visit and a bust with a label and not with colour alone", () => {
    const { container } = render(
      <ScoreDisplay
        players={PLAYERS}
        currentPlayerId="p1"
        playerNames={NAMES}
        throwHistory={[
          { playerId: "p1", points: 60, remaining: 140, segment: "triple" },
          { playerId: "p1", points: 0, remaining: 140, bust: true },
        ]}
      />,
    );

    const counted = container.querySelector('[data-visit="counted"]');
    expect(counted).not.toBeNull();
    // The badge names the outcome and carries an icon, so the state is not
    // carried by the green alone.
    expect(counted?.textContent).toContain("T20");
    expect(counted?.querySelector("svg")).not.toBeNull();

    const bust = container.querySelector('[data-visit="bust"]');
    expect(bust).not.toBeNull();
    expect(bust?.textContent).toContain("BUST");
    expect(bust?.querySelector("svg")).not.toBeNull();
  });

  it("renders the remaining score in tabular figures", () => {
    const { container } = render(
      <ScoreDisplay players={PLAYERS} currentPlayerId="p1" playerNames={NAMES} />,
    );

    const score = container.querySelector('[data-score="p1"]');
    expect(score).not.toBeNull();
    expect(score?.textContent).toBe("140");
    expect(score?.className).toContain("font-mono");
    expect(score?.className).toContain("tabular-nums");
    // A fixed column: the score does not reflow as it falls.
    expect(score?.className).toContain("min-w-[3ch]");
  });

  it("names the player on turn in text", () => {
    const { container } = render(
      <ScoreDisplay players={PLAYERS} currentPlayerId="p1" playerNames={NAMES} />,
    );

    const row = container.querySelector('[data-row="p1"]');
    expect(row?.textContent).toContain("ON TURN");
    expect(container.querySelector('[data-row="p2"]')?.textContent).not.toContain("ON TURN");
  });

  it("states the leg and set progress", () => {
    const { container } = render(
      <ScoreDisplay
        players={PLAYERS}
        currentPlayerId="p1"
        playerNames={NAMES}
        leg={{ current: 2, total: 5 }}
        set={{ current: 1, total: 3 }}
      />,
    );

    expect(container.textContent).toContain("Leg 2/5");
    expect(container.textContent).toContain("Set 1/3");
  });
});

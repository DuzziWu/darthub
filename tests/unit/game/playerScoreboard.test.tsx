// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PlayerScoreboard } from "@/components/game/PlayerScoreboard";
import type { ScoreboardData, ScoreboardPlayer } from "@/components/game/types";

/**
 * The player overview is read mid-turn, in bad light, on a phone.
 *
 * Every state it carries therefore has to survive with the colour removed:
 * the player on throw is marked by a rail **and** by words, the number is a
 * fixed column of tabular figures, and the caption says what the number
 * means — which is the one thing that differs between the modes.
 */

afterEach(cleanup);

const PLAYERS: ScoreboardPlayer[] = [
  { id: "p1", name: "Dave", value: 140, isCurrent: true },
  { id: "p2", name: "Sam", value: 132, isCurrent: false },
];

const X01: ScoreboardData = { kind: "x01", checkoutLabel: "Double out" };

describe("PlayerScoreboard", () => {
  it("marks the player on turn with a rail and with words", () => {
    const { container } = render(<PlayerScoreboard players={PLAYERS} data={X01} />);

    const active = container.querySelector('[data-active-player="true"]');
    expect(active).not.toBeNull();
    // The rail is one of two markers; the words are the other, so the state
    // never depends on colour alone.
    expect(active?.className).toContain("border-l-2");
    expect(active?.className).toContain("border-l-brass");
    expect(active?.textContent).toContain("AM ZUG");

    const passive = container.querySelector('[data-active-player="false"]');
    expect(passive?.textContent).not.toContain("AM ZUG");
  });

  it("renders the number in a fixed column of tabular figures", () => {
    const { container } = render(<PlayerScoreboard players={PLAYERS} data={X01} />);

    const score = container.querySelector('[data-remaining="p1"]');
    expect(score?.textContent).toBe("140");
    expect(score?.className).toContain("font-mono");
    expect(score?.className).toContain("tabular-nums");
    // A fixed column: the number does not reflow as it falls.
    expect(score?.className).toContain("min-w-[3ch]");
  });

  it("carries the data-score marker, so the score is named in one place", () => {
    const { container } = render(<PlayerScoreboard players={PLAYERS} data={X01} />);

    // The overview leads: it states how much each player has left, and it
    // is the only surface that does. The marker follows the number, so a
    // lookup finds exactly one element per player.
    const scores = container.querySelectorAll("[data-score]");
    expect(scores).toHaveLength(2);
    expect(container.querySelector('[data-score="p1"]')?.textContent).toBe("140");
  });

  it("keeps the players in their seating order", () => {
    const { container } = render(<PlayerScoreboard players={PLAYERS} data={X01} />);

    const rows = [...container.querySelectorAll("li")];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Dave");
    expect(rows[1]?.textContent).toContain("Sam");
  });

  it("names the caption after the mode", () => {
    const { container, rerender } = render(<PlayerScoreboard players={PLAYERS} data={X01} />);
    expect(container.textContent).toContain("Remaining");

    rerender(
      <PlayerScoreboard
        players={PLAYERS}
        data={{
          kind: "aroundTheClock",
          currentTarget: 3,
          targetIndex: 2,
          targetCount: 21,
          playerProgress: {},
        }}
      />,
    );
    expect(container.textContent).toContain("Hit");

    rerender(
      <PlayerScoreboard
        players={PLAYERS}
        data={{ kind: "shanghai", currentRound: 2, totalRounds: 7, target: 2, roundRecords: {} }}
      />,
    );
    expect(container.textContent).toContain("Marks");
  });

  it("has no score column in cricket, where the targets are the score", () => {
    const { container } = render(
      <PlayerScoreboard
        players={PLAYERS}
        data={{ kind: "cricket", marks: {}, targets: [20, 19], marksToClose: 3 }}
      />,
    );

    expect(container.querySelector("[data-remaining]")).toBeNull();
    expect(container.textContent).not.toContain("Remaining");
  });

  it("counts the closed cricket targets of every player", () => {
    const { container } = render(
      <PlayerScoreboard
        players={PLAYERS}
        data={{
          kind: "cricket",
          marks: {
            p1: { "20": 3, "19": 1 },
            p2: { "20": 3 },
          },
          targets: [20, 19],
          marksToClose: 3,
        }}
      />,
    );

    const rows = [...container.querySelectorAll("li")];
    expect(rows[0]?.textContent).toContain("1 / 2 closed");
    expect(rows[1]?.textContent).toContain("1 / 2 closed");
  });

  it("shows the progress of every player in around the clock", () => {
    const { container } = render(
      <PlayerScoreboard
        players={PLAYERS}
        data={{
          kind: "aroundTheClock",
          currentTarget: 3,
          targetIndex: 2,
          targetCount: 21,
          playerProgress: { p1: 2, p2: 0 },
        }}
      />,
    );

    const rows = [...container.querySelectorAll("li")];
    expect(rows[0]?.textContent).toContain("2 / 21 targets hit");
    expect(rows[1]?.textContent).toContain("0 / 21 targets hit");
  });

  it("shows the round and the segments hit in shanghai", () => {
    const { container } = render(
      <PlayerScoreboard
        players={PLAYERS}
        data={{
          kind: "shanghai",
          currentRound: 3,
          totalRounds: 7,
          target: 3,
          roundRecords: { p1: { marks: 3, hitSingle: true, hitDouble: true, hitTriple: true } },
        }}
      />,
    );

    // The round and the target belong to the Shanghai sheet, which already
    // states both. The overview names the length of the match and the
    // segments the player has hit — it does not say "Round 3 / 7" a second
    // time, or the same words end up on the screen twice.
    expect(container.textContent).toContain("7 rounds");
    expect(container.textContent).not.toContain("Round 3 / 7");
    const rows = [...container.querySelectorAll("li")];
    expect(rows[0]?.textContent).toContain("S D T");
    expect(rows[0]?.textContent).toContain("3 marks");
  });

  it("states the leg and the set when the match has them", () => {
    const { container } = render(
      <PlayerScoreboard
        players={PLAYERS}
        data={{
          kind: "x01",
          checkoutLabel: "Double out",
          leg: { current: 2, total: 5 },
          set: { current: 1, total: 3 },
        }}
      />,
    );

    expect(container.textContent).toContain("Leg 2/5");
    expect(container.textContent).toContain("Set 1/3");
  });
});

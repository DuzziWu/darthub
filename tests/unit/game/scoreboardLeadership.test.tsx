// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlayerScoreboard } from "@/components/game/PlayerScoreboard";
import { ScoreDisplay } from "@/components/game/ScoreDisplay";

/**
 * The leading number: one per player, in one place.
 *
 * The 501 shows every player with the score they have left. The overview
 * leads with that number; the score sheet shows what every player just
 * threw. Two surfaces showing the same number would leave the player
 * wondering which of them is the truth — so this test holds both apart.
 */
const PLAYERS = [
  { id: "p1", name: "Ann", value: 140, isCurrent: true },
  { id: "p2", name: "Bo", value: 220, isCurrent: false },
];

const NAMES = { p1: "Ann", p2: "Bo" };

const X01 = { kind: "x01" as const, checkoutLabel: "Double out" };

afterEach(cleanup);

/** The player overview, with the queries scoped to it. */
function overview() {
  return within(screen.getByRole("region", { name: "Player overview" }));
}

/** The score sheet, with the queries scoped to it. */
function sheet() {
  return within(screen.getByRole("region", { name: "Score sheet" }));
}

describe("the leading number", () => {
  it("stands in the player overview, once per player", () => {
    const { container } = render(<PlayerScoreboard players={PLAYERS} data={X01} />);

    const scores = container.querySelectorAll("[data-score]");
    expect(scores).toHaveLength(2);
    expect(container.querySelector('[data-score="p1"]')?.textContent).toBe("140");
    expect(container.querySelector('[data-score="p2"]')?.textContent).toBe("220");
  });

  it("is not repeated in the score sheet", () => {
    const { container } = render(
      <ScoreDisplay players={PLAYERS} currentPlayerId="p1" playerNames={NAMES} />,
    );

    // The sheet shows what every player just threw — not a second copy of
    // the number.
    expect(container.querySelector("[data-score]")).toBeNull();
    expect(container.querySelector("[data-remaining]")).toBeNull();
  });

  it("the overview is above the score sheet on the screen", () => {
    render(
      <>
        <PlayerScoreboard players={PLAYERS} data={X01} />
        <ScoreDisplay players={PLAYERS} currentPlayerId="p1" playerNames={NAMES} />
      </>,
    );

    // The overview stands first: it is where the player looks for the
    // number that decides whether the next dart is safe.
    const regions = screen
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label"));
    expect(regions.indexOf("Player overview")).toBeLessThan(regions.indexOf("Score sheet"));
  });

  it("names the player on turn by a rail and by words", () => {
    const { container } = render(<PlayerScoreboard players={PLAYERS} data={X01} />);

    // The rail is the marker, the words are the caption: the player is
    // recognisable without relying on colour.
    const rows = [...container.querySelectorAll("li")];
    expect(rows[0]?.getAttribute("data-active-player")).toBe("true");
    expect(rows[0]?.textContent).toContain("AM ZUG");
    expect(rows[0]?.className).toContain("border-l-2");
    expect(rows[1]?.getAttribute("data-active-player")).toBe("false");
    expect(rows[1]?.textContent).not.toContain("AM ZUG");
  });

  it("names every player with the score they have left", () => {
    render(<PlayerScoreboard players={PLAYERS} data={X01} />);

    const rows = overview().getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Ann");
    expect(rows[0]?.textContent).toContain("140");
    expect(rows[1]?.textContent).toContain("Bo");
    expect(rows[1]?.textContent).toContain("220");
  });

  it("the active player is the one with the larger figure", () => {
    const { container } = render(<PlayerScoreboard players={PLAYERS} data={X01} />);

    // The player on throw is promoted, so the eye finds it before it
    // reads the number.
    const active = container.querySelector('[data-active-player="true"]');
    expect(active?.className).toContain("min-h-16");
    expect(active?.querySelector("[data-score]")?.className).toContain("text-score-xl");
  });

  it("keeps the score sheet free of a number column of its own", () => {
    const { container } = render(
      <ScoreDisplay players={PLAYERS} currentPlayerId="p1" playerNames={NAMES} />,
    );

    // The sheet's header names the players and the leg, and the rows carry
    // the visit — but no figure of its own.
    expect(container.querySelector("[data-score]")).toBeNull();
    expect(sheet().getByText("Players")).toBeTruthy();
  });
});

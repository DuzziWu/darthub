// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchHistory } from "@/components/game/MatchHistory";
import type { MatchHistoryProps } from "@/components/game/MatchHistory";
import type { MatchVisit } from "@/game-engine/types";

/**
 * The history of the match: every visit it has seen.
 *
 * The list comes from the engine, so the test builds the visits the way the
 * engine does — grouped, oldest first, each visit naming its player.
 */
const VISITS: MatchVisit[] = [
  {
    index: 0,
    playerId: "p1",
    throws: [{ playerId: "p1", points: 60, segment: "triple", bust: false }],
  },
  {
    index: 1,
    playerId: "p2",
    throws: [
      { playerId: "p2", points: 40, segment: "double", bust: false },
      { playerId: "p2", points: 20, bust: true },
    ],
  },
];

const NAMES = { p1: "Ann", p2: "Bo" };

const EMPTY_PROPS: MatchHistoryProps = {
  visits: VISITS,
  playerNames: NAMES,
  correctionTarget: null,
  expanded: false,
  onToggle: () => {},
  onSelectThrow: () => {},
};

/** Renders the history with spies for every event. */
function setup(props: Partial<MatchHistoryProps> = {}) {
  const onSelectThrow = vi.fn();
  const onToggle = vi.fn();
  const utils = render(
    <MatchHistory {...EMPTY_PROPS} onSelectThrow={onSelectThrow} onToggle={onToggle} {...props} />,
  );
  return { onSelectThrow, onToggle, ...utils };
}

/** The history's own region, with the queries scoped to it. */
function history() {
  return within(screen.getByRole("region", { name: "Match history" }));
}

/** The dart buttons of the history, by their accessible name. */
function historyDarts() {
  return history()
    .getAllByRole("button")
    .filter((button) => (button.getAttribute("aria-label") ?? "").startsWith("History dart"));
}

afterEach(cleanup);

describe("MatchHistory", () => {
  it("shows the visit in progress and not the whole match", () => {
    setup();

    // Two visits are there, but only the last one is shown: a whole
    // evening of darts would be unreadable as one wall of chips.
    expect(history().getByText("2 visits")).toBeTruthy();
    expect(historyDarts()).toHaveLength(2);
    // The name and the marker stand next to each other, so the text of the
    // row names both.
    expect(history().getByText(/Bo/)).toBeTruthy();
    expect(history().getByText(/current visit/)).toBeTruthy();
    // The earlier visit is not on the screen yet.
    expect(history().queryByText("Ann")).toBeNull();
  });

  it("opens the whole match on demand", () => {
    const { onToggle } = setup();
    const toggle = history().getByRole("button", { name: /all visits/i });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("names the switch after what it will show", () => {
    setup({ expanded: true });

    // Open: the switch offers the short list again.
    const toggle = history().getByRole("button", { name: /current visit/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(historyDarts()).toHaveLength(3);
    // Both players are named, in the order they played.
    expect(history().getByText(/Ann/)).toBeTruthy();
    expect(history().getByText(/Bo/)).toBeTruthy();
  });

  it("reports the ledger index of a dart, not its position in the list", () => {
    const { onSelectThrow } = setup({ expanded: true });

    // The fourth dart of the match is the third button of the list.
    fireEvent.click(historyDarts()[2]!);
    expect(onSelectThrow).toHaveBeenCalledWith(2);
  });

  it("a dart of an earlier visit keeps its ledger index", () => {
    const { onSelectThrow } = setup({ expanded: true });

    // The first dart of the match is the first button of the list.
    fireEvent.click(historyDarts()[0]!);
    expect(onSelectThrow).toHaveBeenCalledWith(0);
  });

  it("distinguishes counted darts and busts without colour alone", () => {
    setup({ expanded: true });

    const bust = history().getByRole("button", { name: /History dart 3: BUST/ });
    expect(bust.getAttribute("data-visit")).toBe("bust");
    expect(bust.textContent).toContain("BUST");

    const counted = history().getByRole("button", { name: /History dart 2/ });
    expect(counted.getAttribute("data-visit")).toBe("counted");
    expect(counted.textContent).toContain("D20");
  });

  it("marks the armed dart by its ledger index", () => {
    setup({ expanded: true, correctionTarget: 1 });

    expect(
      history()
        .getByRole("button", { name: /History dart 2/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      history()
        .getByRole("button", { name: /History dart 1/ })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("darts are not tappable once the match is over", () => {
    setup({ expanded: true, correctionsDisabled: true });

    expect(historyDarts()[0]?.hasAttribute("disabled")).toBe(true);
  });

  it("carries no confirmation of its own, so the screen has one alert", () => {
    setup({ expanded: true });

    // The confirmation lives in the turn tracker: it is one alert for the
    // whole screen, and the tracker stands above the fold, next to the
    // input the player is correcting.
    expect(history().queryByRole("alert")).toBeNull();
  });

  it("names a player without a name by its id", () => {
    setup({
      visits: [{ index: 0, playerId: "p9", throws: [{ playerId: "p9", points: 20, bust: false }] }],
      playerNames: {},
    });

    expect(history().getByText(/p9/)).toBeTruthy();
  });

  it("counts the darts of every visit", () => {
    setup({ expanded: true });

    expect(history().getByText("1 dart")).toBeTruthy();
    expect(history().getByText("2 darts")).toBeTruthy();
  });
});

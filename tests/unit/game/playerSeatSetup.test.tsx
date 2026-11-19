// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PlayerSeatSetup } from "@/components/game/PlayerSeatSetup";
import { AI_AVERAGE_LEVELS, DEFAULT_AI_AVERAGE } from "@/ai/averages";
import type { PlayerSeat } from "@/components/game/types";

/**
 * The seat list of the 501: a person or the AI in each seat, the AI's
 * average, and the order the seats play in.
 *
 * The list is the 501's own preparation step — the other modes keep their
 * plain name fields — so it is tested on its own.
 */

afterEach(() => {
  cleanup();
});

const CONFIG = { averages: AI_AVERAGE_LEVELS, defaultAverage: DEFAULT_AI_AVERAGE };

/** The seats a fresh 501 starts with: the fewest the match accepts. */
function initialSeats(count = 2): PlayerSeat[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `seat-${index + 1}`,
    name: "",
    kind: "human" as const,
  }));
}

/**
 * Renders the list as a controlled component.
 *
 * The list is controlled: it reports a change, and the owner holds the
 * seats. The harness plays that owner, so a change is visible right away
 * — the way the setup form behaves.
 */
function renderSeats(seats: PlayerSeat[] = initialSeats()) {
  // The list is controlled: it reports a change, and the owner holds the
  // seats. The harness plays that owner, so a change is visible right away
  // — the way the setup form behaves.
  const onChange = vi.fn();

  function Harness({ initial }: { initial: PlayerSeat[] }) {
    const [current, setCurrent] = useState<readonly PlayerSeat[]>(initial);
    return (
      <PlayerSeatSetup
        seats={current}
        onChange={(next) => {
          onChange(next);
          setCurrent(next);
        }}
        config={CONFIG}
        minPlayers={2}
        maxPlayers={4}
      />
    );
  }

  const utils = render(<Harness initial={seats} />);
  return { ...utils, onChange };
}

describe("PlayerSeatSetup", () => {
  it("offers a person or the AI for every seat", () => {
    renderSeats();

    // Two seats, each with both kinds.
    expect(screen.getAllByRole("radio", { name: "Mensch" })).toHaveLength(2);
    expect(screen.getAllByRole("radio", { name: "KI" })).toHaveLength(2);
    expect(screen.getAllByRole("radiogroup")).toHaveLength(2);
  });

  it("names an AI seat and offers the average for it", () => {
    const { onChange } = renderSeats();

    // The first seat becomes the AI.
    fireEvent.click(screen.getAllByRole("radio", { name: "KI" })[0]!);

    const seats = onChange.mock.calls[0]![0] as PlayerSeat[];
    expect(seats[0]!.kind).toBe("ai");
    // The name is filled in, and it is the seat's own name.
    expect(seats[0]!.name).toBe("KI 1");
    // The average falls back to the default, so the seat can always play.
    expect(seats[0]!.average).toBe(DEFAULT_AI_AVERAGE);

    // And the average is offered for that seat alone.
    const averages = screen.getByLabelText("Average") as HTMLSelectElement;
    expect(Array.from(averages.options).map((option) => option.value)).toEqual(
      AI_AVERAGE_LEVELS.map(String),
    );
  });

  it("offers the average of an AI seat only", () => {
    renderSeats();

    // A person has no strength to set.
    expect(screen.queryByLabelText("Average")).toBeNull();

    fireEvent.click(screen.getAllByRole("radio", { name: "KI" })[0]!);
    expect(screen.getByLabelText("Average")).toBeTruthy();
  });

  it("takes the average the player chooses", () => {
    const { onChange } = renderSeats();

    fireEvent.click(screen.getAllByRole("radio", { name: "KI" })[0]!);
    const seats = onChange.mock.calls[0]![0] as PlayerSeat[];
    const withAverage = { ...seats[0]!, average: 85 };

    render(
      <PlayerSeatSetup
        seats={withAverage ? [withAverage] : []}
        onChange={onChange}
        config={CONFIG}
        minPlayers={2}
        maxPlayers={4}
      />,
    );
    fireEvent.change(screen.getByLabelText("Average"), { target: { value: "85" } });

    const changed = onChange.mock.calls.at(-1)![0] as PlayerSeat[];
    expect(changed[0]!.average).toBe(85);
  });

  it("moves a seat up and down, and names the move for the player", () => {
    const { onChange } = renderSeats([
      { id: "seat-1", name: "Ann", kind: "human" },
      { id: "seat-2", name: "Bo", kind: "human" },
    ]);

    // The button says whose seat moves and which way.
    expect(screen.getByRole("button", { name: "Ann nach oben" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bo nach unten" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Bo nach oben" }));

    const seats = onChange.mock.calls[0]![0] as PlayerSeat[];
    expect(seats.map((seat) => seat.name)).toEqual(["Bo", "Ann"]);
  });

  it("does not move the first seat up or the last one down", () => {
    renderSeats([
      { id: "seat-1", name: "Ann", kind: "human" },
      { id: "seat-2", name: "Bo", kind: "human" },
    ]);

    expect(screen.getByRole("button", { name: "Ann nach oben" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Bo nach unten" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("adds a seat up to the maximum the match accepts", () => {
    const { onChange } = renderSeats(initialSeats(2));

    fireEvent.click(screen.getByRole("button", { name: /Spieler hinzufügen/ }));

    const seats = onChange.mock.calls[0]![0] as PlayerSeat[];
    expect(seats).toHaveLength(3);
  });

  it("does not undercut the fewest players the match accepts", () => {
    const { onChange } = renderSeats(initialSeats(2));

    // With the minimum reached, the seat cannot be removed.
    const removals = screen.getAllByRole("button", { name: /entfernen/ });
    expect(removals).toHaveLength(2);
    removals.forEach((button) => {
      expect(button.hasAttribute("disabled")).toBe(true);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the names the player types", () => {
    const { onChange } = renderSeats();

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });

    const seats = onChange.mock.calls[0]![0] as PlayerSeat[];
    expect(seats[0]!.name).toBe("Ann");
  });

  it("takes the AI name away when the seat becomes a person's again", () => {
    const { onChange } = renderSeats();

    // The seat becomes the AI and is named.
    fireEvent.click(screen.getAllByRole("radio", { name: "KI" })[0]!);
    expect((onChange.mock.calls.at(-1)![0] as PlayerSeat[])[0]!.name).toBe("KI 1");

    // And back to a person.
    fireEvent.click(screen.getAllByRole("radio", { name: "Mensch" })[0]!);
    const seats = onChange.mock.calls.at(-1)![0] as PlayerSeat[];
    expect(seats[0]!.kind).toBe("human");
    // The name of an AI is wrong for a person, so it goes.
    expect(seats[0]!.name).toBe("");
  });

  it("keeps a name the player chose when the seat changes kind", () => {
    const { onChange } = renderSeats();

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Ann" } });
    fireEvent.click(screen.getAllByRole("radio", { name: "KI" })[0]!);

    const seats = onChange.mock.calls.at(-1)![0] as PlayerSeat[];
    expect(seats[0]!.name).toBe("Ann");
    expect(seats[0]!.kind).toBe("ai");
  });

  it("labels the seat kind for the screen reader", () => {
    renderSeats();

    const groups = screen.getAllByRole("radiogroup");
    expect(within(groups[0]!).getByText("Sitzplatz 1: Typ")).toBeTruthy();
  });
});

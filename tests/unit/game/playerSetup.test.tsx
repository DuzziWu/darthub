// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlayerSetup } from "@/components/game/PlayerSetup";

/**
 * The setup form: visible labels, the board source and the checkout rule.
 * Nothing here may be placeholder-only, and the choices are real state.
 */

afterEach(() => {
  cleanup();
});

function renderSetup(props: Partial<React.ComponentProps<typeof PlayerSetup>> = {}) {
  const onStart = vi.fn();
  const utils = render(
    <PlayerSetup
      modeName="501"
      modeDescription="Start at 501 and count down to zero."
      minPlayers={1}
      maxPlayers={2}
      onStart={onStart}
      {...props}
    />,
  );
  return { ...utils, onStart };
}

describe("PlayerSetup", () => {
  it("labels the player inputs visibly rather than with a placeholder alone", () => {
    const { container } = renderSetup();

    const label = container.querySelector('label[for="player-name-0"]');
    expect(label).not.toBeNull();
    expect(label?.textContent).toContain("Player 1");

    const input = container.querySelector("#player-name-0");
    expect(input).not.toBeNull();
    // The label is the accessible name; the placeholder is only a hint.
    expect(input?.getAttribute("aria-label")).toBeNull();
    expect(input?.getAttribute("aria-labelledby")).toBeNull();
    expect(screen.getByLabelText("Player 1")).toBe(input);
  });

  it("offers the checkout rule and the board source", () => {
    renderSetup();

    expect(screen.getByRole("radiogroup", { name: /checkout/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /double out/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /master out/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /straight out/i })).toBeTruthy();

    // The board source comes from task 006 and is rendered by the setup form.
    expect(screen.getByRole("radio", { name: "Virtual Board" })).toBeTruthy();
  });

  it("starts the match with the chosen names and rules", () => {
    const { onStart } = renderSetup();

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Dave" } });
    fireEvent.click(screen.getByRole("radio", { name: /master out/i }));
    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    expect(onStart).toHaveBeenCalledTimes(1);
    const [names, options] = onStart.mock.calls[0] as unknown as [string[], Record<string, string>];
    expect(names).toEqual(["Dave"]);
    expect(options.outRule).toBe("master");
    expect(options.boardSource).toBe("virtual");
  });

  it("refuses to start without enough players", () => {
    const { onStart } = renderSetup({ minPlayers: 2 });

    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("At least 2");
  });

  it("gives the fields and the start button a focus ring and a disabled state", () => {
    const { container } = renderSetup();

    const input = container.querySelector("#player-name-0");
    expect(input?.className).toContain("focus-visible:");
    expect(input?.className).toContain("disabled:");
    // The field is a 44px target.
    expect(input?.className).toContain("h-11");

    const start = screen.getByRole("button", { name: /start match/i });
    expect(start.className).toContain("focus-visible:");
    expect(start.className).toContain("disabled:");
    expect(start.className).toContain("h-11");
  });
});

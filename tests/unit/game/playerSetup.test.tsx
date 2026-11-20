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

  it("scrolls to the top when the match starts", () => {
    // The form disappears, and the browser would keep the scroll position
    // of the button that was pressed — on a phone that is below the fold,
    // where the remaining score is not to be seen.
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      renderSetup();
      fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Dave" } });
      fireEvent.click(screen.getByRole("button", { name: /start match/i }));

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
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

  it("offers the match format and reports the chosen one", () => {
    const { onStart } = renderSetup({
      matchFormat: [
        { id: "single", label: "Single leg" },
        { id: "bo3", label: "Best of 3 legs", legs: 3 },
      ],
    });

    expect(screen.getByRole("radiogroup", { name: /match format/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /single leg/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /best of 3 legs/i })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Alice" } });
    fireEvent.click(screen.getByRole("radio", { name: /best of 3 legs/i }));
    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    expect(onStart).toHaveBeenCalledTimes(1);
    const [, options] = onStart.mock.calls[0] as unknown as [string[], Record<string, unknown>];
    expect(options.legs).toBe(3);
    // The format has no sets, so the match reports none.
    expect(options.sets).toBeUndefined();
  });

  it("reports no legs when the first format is a single leg", () => {
    const { onStart } = renderSetup({
      matchFormat: [
        { id: "single", label: "Single leg" },
        { id: "bo3", label: "Best of 3 legs", legs: 3 },
      ],
    });

    fireEvent.change(screen.getByLabelText("Player 1"), { target: { value: "Alice" } });
    fireEvent.click(screen.getByRole("button", { name: /start match/i }));

    const [, options] = onStart.mock.calls[0] as unknown as [string[], Record<string, unknown>];
    expect(options.legs).toBeUndefined();
    expect(options.sets).toBeUndefined();
  });

  it("offers no match format when the mode has none", () => {
    renderSetup();

    // The modes without a leg structure keep the setup they had: the
    // checkout rule is the only radio group on the form.
    expect(screen.queryByRole("radiogroup", { name: /match format/i })).toBeNull();
    expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
  });
});

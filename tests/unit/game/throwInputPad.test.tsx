// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";

/**
 * The pad is the conformant path to every throw: arm a band, then pick a
 * sector. It must be able to express a double (the flat 0-60 grid could
 * not), and a miss must arrive without a segment or the engine rejects it.
 */

afterEach(() => {
  cleanup();
});

function renderPad(props: Partial<React.ComponentProps<typeof ThrowInputPad>> = {}) {
  const onThrow = vi.fn();
  const onArmedSegmentChange = vi.fn();
  const utils = render(
    <ThrowInputPad
      throwsInCurrentTurn={0}
      armedSegment="single"
      onArmedSegmentChange={onArmedSegmentChange}
      onThrow={onThrow}
      {...props}
    />,
  );
  return { ...utils, onThrow, onArmedSegmentChange };
}

describe("ThrowInputPad", () => {
  it("sends the armed band and the number as a segment and a score", () => {
    const { onThrow } = renderPad({ armedSegment: "double" });

    fireEvent.click(screen.getByRole("button", { name: "Double 16, 32 points" }));

    expect(onThrow).toHaveBeenCalledTimes(1);
    expect(onThrow).toHaveBeenCalledWith({ points: 32, segment: "double" });
  });

  it("sends a miss with no segment", () => {
    const { onThrow } = renderPad();

    fireEvent.click(screen.getByRole("button", { name: /miss/i }));

    expect(onThrow).toHaveBeenCalledTimes(1);
    expect(onThrow).toHaveBeenCalledWith({ points: 0 });
    // A miss with a segment is a validation error, not a zero-scoring throw.
    expect(onThrow.mock.calls[0]?.[0]).not.toHaveProperty("segment");
  });

  it("sends two different scores for two different pad keys", () => {
    const { onThrow } = renderPad({ armedSegment: "single" });

    fireEvent.click(screen.getByRole("button", { name: "Single 16, 16 points" }));
    fireEvent.click(screen.getByRole("button", { name: "Single 20, 20 points" }));

    expect(onThrow).toHaveBeenCalledTimes(2);
    const [first, second] = onThrow.mock.calls.map((call) => call[0]);
    expect(first).not.toEqual(second);
    expect(first).toEqual({ points: 16, segment: "single" });
    expect(second).toEqual({ points: 20, segment: "single" });
  });

  it("sends the two bulls as bull throws", () => {
    const { onThrow } = renderPad();

    fireEvent.click(screen.getByRole("button", { name: "Inner bull, 50 points" }));
    expect(onThrow).toHaveBeenLastCalledWith({ points: 50, segment: "bull" });

    fireEvent.click(screen.getByRole("button", { name: "Outer bull, 25 points" }));
    expect(onThrow).toHaveBeenLastCalledWith({ points: 25, segment: "bull" });
  });

  it("arms a band from the segment radio group", () => {
    const { onArmedSegmentChange } = renderPad({ armedSegment: "single" });

    const group = screen.getByRole("radiogroup", { name: /segment/i });
    expect(group).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "2× Double" }));
    expect(onArmedSegmentChange).toHaveBeenCalledWith("double");

    fireEvent.click(screen.getByRole("radio", { name: "3× Treble" }));
    expect(onArmedSegmentChange).toHaveBeenLastCalledWith("triple");
  });

  it("names the armed band in text, so the state never depends on colour", () => {
    renderPad({ armedSegment: "triple" });

    const group = screen.getByRole("radiogroup", { name: /segment/i });
    expect(group.textContent).toContain("Treble");
    expect(group.textContent).toContain("×3");
  });

  it("meets the 44 pixel minimum target size", () => {
    const { container } = renderPad();

    const keys = screen.getAllByRole("button");
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => {
      // 44px = 2.75rem = h-11, and the key is never narrower than it is tall.
      expect(key.className).toContain("h-11");
      expect(key.className).toContain("min-w-11");
    });

    // The keys are at least 8px apart (gap-md).
    const grids = [...container.querySelectorAll(".gap-md")];
    expect(grids.length).toBeGreaterThan(0);
  });

  it("gives every control a visible focus ring and a disabled state", () => {
    renderPad({ disabled: true });

    const controls = [...screen.getAllByRole("button"), ...screen.getAllByRole("radio")];
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((control) => {
      expect(control.className).toContain("focus-visible:");
      expect(control.className).toContain("disabled:");
    });
  });

  it("throws nothing while it is disabled", () => {
    const { onThrow } = renderPad({ disabled: true });

    fireEvent.click(screen.getByRole("button", { name: "Single 20, 20 points" }));

    expect(onThrow).not.toHaveBeenCalled();
  });
});

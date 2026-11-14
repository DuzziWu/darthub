// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InputModeSwitch } from "@/components/game/InputModeSwitch";
import { SegmentControl } from "@/components/game/SegmentControl";

/**
 * The switch between the two ways of entering a dart.
 *
 * It is a view concern: the mode says which surface takes the tap and
 * nothing else. The armed band is shared state between the pad and the
 * board, so the switch must not disturb it either.
 */

afterEach(() => {
  cleanup();
});

describe("InputModeSwitch", () => {
  it("is a radio group with the two modes", () => {
    render(<InputModeSwitch mode="manual" onChange={vi.fn()} />);

    const group = screen.getByRole("radiogroup", { name: "Input mode" });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("marks the chosen mode as checked and the other as not", () => {
    render(<InputModeSwitch mode="board" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /^Board/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /^Manual/ }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("fires onChange with the mode that was tapped", () => {
    const onChange = vi.fn();
    render(<InputModeSwitch mode="manual" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /^Board/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("board");
  });

  it("keeps a roving tabindex: only the checked radio is in the tab order", () => {
    render(<InputModeSwitch mode="manual" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /^Manual/ }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("radio", { name: /^Board/ }).getAttribute("tabindex")).toBe("-1");
  });

  it("moves the selection with the arrow keys", () => {
    const onChange = vi.fn();
    render(<InputModeSwitch mode="manual" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("radio", { name: /^Manual/ }), { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("board");
  });

  it("moves the selection back with the left arrow key", () => {
    const onChange = vi.fn();
    render(<InputModeSwitch mode="board" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("radio", { name: /^Board/ }), { key: "ArrowLeft" });

    expect(onChange).toHaveBeenCalledWith("manual");
  });
});

describe("SegmentControl", () => {
  it("is a radio group naming the armed band", () => {
    render(
      <SegmentControl
        armedSegment="triple"
        onArmedSegmentChange={vi.fn()}
        idPrefix="test-segment"
      />,
    );

    const group = screen.getByRole("radiogroup");
    expect(group.getAttribute("aria-labelledby")).toBe("test-segment-label");
    expect(screen.getByText(/Treble ×3/)).toBeTruthy();
  });

  it("fires onChange with the band that was tapped", () => {
    const onArmedSegmentChange = vi.fn();
    render(
      <SegmentControl
        armedSegment="single"
        onArmedSegmentChange={onArmedSegmentChange}
        idPrefix="test-segment"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "3× Treble" }));

    expect(onArmedSegmentChange).toHaveBeenCalledWith("triple");
  });

  it("moves the armed band with the arrow keys", () => {
    const onArmedSegmentChange = vi.fn();
    render(
      <SegmentControl
        armedSegment="single"
        onArmedSegmentChange={onArmedSegmentChange}
        idPrefix="test-segment"
      />,
    );

    fireEvent.keyDown(screen.getByRole("radio", { name: "1× Single" }), { key: "ArrowRight" });

    expect(onArmedSegmentChange).toHaveBeenCalledWith("double");
  });

  it("gives each instance its own ids, so two controls can stand side by side", () => {
    render(
      <>
        <SegmentControl
          armedSegment="single"
          onArmedSegmentChange={vi.fn()}
          idPrefix="pad-segment"
        />
        <SegmentControl
          armedSegment="single"
          onArmedSegmentChange={vi.fn()}
          idPrefix="board-segment"
        />
      </>,
    );

    expect(document.getElementById("pad-segment-single")).toBeTruthy();
    expect(document.getElementById("board-segment-single")).toBeTruthy();
  });
});

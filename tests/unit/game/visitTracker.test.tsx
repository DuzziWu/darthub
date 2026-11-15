// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VisitTracker } from "@/components/game/VisitTracker";
import { ThrowHistoryControls } from "@/components/game/ThrowHistoryControls";

/**
 * The turn tracker stands in the input area, not in the header.
 *
 * The undo used to sit in the sticky strip, some 900 px above the pad where
 * the mistake happens. It now sits next to the darts of the turn, and it is
 * the **only** undo on the screen: the end-to-end suite addresses it by the
 * exact name "Undo", and a second one would make that lookup ambiguous.
 */

afterEach(cleanup);

/** The tracker with the dart list in it, as the views render it. */
function setup(props: { canUndo?: boolean; darts?: number } = {}) {
  const onUndo = vi.fn();
  const darts = Array.from({ length: props.darts ?? 0 }, (_unused, index) => ({
    playerId: "a",
    points: 20,
    segment: "single" as const,
    bust: false,
    index,
  }));
  const utils = render(
    <VisitTracker canUndo={props.canUndo ?? true} onUndo={onUndo}>
      <ThrowHistoryControls
        throws={darts}
        correctionTarget={null}
        awaitingConfirmation={false}
        onSelectThrow={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </VisitTracker>,
  );
  return { onUndo, ...utils };
}

describe("VisitTracker", () => {
  it("carries exactly one undo, named exactly Undo", () => {
    setup();

    const undo = screen.getAllByRole("button", { name: /undo/i });
    expect(undo).toHaveLength(1);
    expect(undo[0]?.getAttribute("aria-label")).toBe("Undo");
  });

  it("reports the availability of the undo and calls onUndo", () => {
    const { onUndo, unmount } = setup();
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo.hasAttribute("disabled")).toBe(false);
    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledOnce();
    unmount();

    setup({ canUndo: false });
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
  });

  it("holds exactly one list of the current visit", () => {
    setup({ darts: 2 });

    expect(screen.getAllByRole("list", { name: "Current visit" })).toHaveLength(1);
  });

  it("reserves a slot for every dart of the turn that is still to come", () => {
    setup({ darts: 1 });

    // A thrown dart is a chip, an unthrown one is a placeholder that says so.
    expect(screen.getByRole("button", { name: "Dart 1: S20" })).toBeTruthy();
    expect(screen.getByLabelText("Dart 2: not thrown")).toBeTruthy();
    expect(screen.getByLabelText("Dart 3: not thrown")).toBeTruthy();
  });

  it("gives the undo a 44 pixel target and a visible focus ring", () => {
    setup();

    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo.className).toContain("h-11");
    expect(undo.className).toContain("min-w-11");
    expect(undo.className).toContain("focus-visible:");
    expect(undo.className).toContain("disabled:");
  });
});

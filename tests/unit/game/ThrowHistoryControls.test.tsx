// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThrowHistoryControls } from "@/components/game/ThrowHistoryControls";
import type { ThrowHistoryControlsProps } from "@/components/game/ThrowHistoryControls";

const DARTS = [
  { playerId: "a", points: 60, segment: "triple" as const, bust: false },
  { playerId: "a", points: 20, bust: true },
];

const EMPTY_PROPS: ThrowHistoryControlsProps = {
  throws: [],
  correctionTarget: null,
  awaitingConfirmation: false,
  canUndo: false,
  onSelectThrow: () => {},
  onUndo: () => {},
  onConfirm: () => {},
  onCancel: () => {},
};

/** Renders the controls with spies for every event; each test renders once. */
function setup(props: Partial<ThrowHistoryControlsProps> = {}) {
  const onSelectThrow = vi.fn();
  const onUndo = vi.fn();
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ThrowHistoryControls
      {...EMPTY_PROPS}
      throws={DARTS}
      canUndo={true}
      onSelectThrow={onSelectThrow}
      onUndo={onUndo}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSelectThrow, onUndo, onConfirm, onCancel, ...utils };
}

afterEach(cleanup);

describe("ThrowHistoryControls", () => {
  it("renders one tappable button per dart, naming busts without colour", () => {
    setup();
    const darts = screen
      .getAllByRole("button")
      .filter((b) => (b.getAttribute("aria-label") ?? "").startsWith("Dart"));
    expect(darts).toHaveLength(2);
    expect(darts[0]?.getAttribute("aria-label")).toBe("Dart 1: T20");
    expect(darts[1]?.textContent).toContain("BUST");
    expect(darts[1]?.getAttribute("data-visit")).toBe("bust");
    expect(darts[0]?.getAttribute("aria-pressed")).toBe("false");
  });

  it("tapping a dart fires onSelectThrow with its index", () => {
    const { onSelectThrow } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Dart 2: BUST" }));
    expect(onSelectThrow).toHaveBeenCalledWith(1);
  });

  it("reports the ledger index of a chip, not its position in the strip", () => {
    // The strip shows one visit; the engine indexes the whole ledger.
    const { onSelectThrow } = setup({ visitOffset: 6 });
    fireEvent.click(screen.getByRole("button", { name: "Dart 1: T20" }));
    expect(onSelectThrow).toHaveBeenCalledWith(6);
    fireEvent.click(screen.getByRole("button", { name: "Dart 2: BUST" }));
    expect(onSelectThrow).toHaveBeenCalledWith(7);
  });

  it("marks the armed dart by its ledger index", () => {
    setup({ visitOffset: 6, correctionTarget: 7 });
    expect(screen.getByRole("button", { name: "Dart 2: BUST" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Dart 1: T20" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("the armed dart is visibly pressed", () => {
    setup({ correctionTarget: 1 });
    expect(screen.getByRole("button", { name: "Dart 2: BUST" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Dart 1: T20" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("the undo button reports availability and calls onUndo", () => {
    const { unmount, onUndo } = setup();
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo.hasAttribute("disabled")).toBe(false);
    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledOnce();
    unmount();

    setup({ throws: [], canUndo: false });
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
  });

  it("a finished visit asks for confirmation before correcting", () => {
    const { onConfirm, onCancel } = setup({ correctionTarget: 0, awaitingConfirmation: true });
    expect(screen.getByText(/finished visit/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("an armed dart shows the replacement hint and a cancel", () => {
    const { onCancel } = setup({ correctionTarget: 0, awaitingConfirmation: false });
    expect(screen.getByText(/correcting t20/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("darts are not tappable once the match is over, but undo stays", () => {
    setup({ correctionsDisabled: true });
    expect(screen.getByRole("button", { name: "Dart 1: T20" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(false);
  });
});

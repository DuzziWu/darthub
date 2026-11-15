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
  onSelectThrow: () => {},
  onConfirm: () => {},
  onCancel: () => {},
};

/** Renders the controls with spies for every event; each test renders once. */
function setup(props: Partial<ThrowHistoryControlsProps> = {}) {
  const onSelectThrow = vi.fn();
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ThrowHistoryControls
      {...EMPTY_PROPS}
      throws={DARTS}
      onSelectThrow={onSelectThrow}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSelectThrow, onConfirm, onCancel, ...utils };
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

  it("reports the ledger index of a chip, not its position in the tracker", () => {
    // The tracker shows one turn; the engine indexes the whole ledger.
    const { onSelectThrow } = setup({ turnOffset: 6 });
    fireEvent.click(screen.getByRole("button", { name: "Dart 1: T20" }));
    expect(onSelectThrow).toHaveBeenCalledWith(6);
    fireEvent.click(screen.getByRole("button", { name: "Dart 2: BUST" }));
    expect(onSelectThrow).toHaveBeenCalledWith(7);
  });

  it("marks the armed dart by its ledger index", () => {
    setup({ turnOffset: 6, correctionTarget: 7 });
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

  it("darts are not tappable once the match is over", () => {
    setup({ correctionsDisabled: true });
    expect(screen.getByRole("button", { name: "Dart 1: T20" }).hasAttribute("disabled")).toBe(true);
  });

  it("reserves a slot for every dart the turn still holds", () => {
    setup({ throws: [{ playerId: "a", points: 20, bust: false }] });

    // Two darts of the turn are still to come, and each of them has a slot
    // that says so — a thrown dart is a chip, an unthrown one is a
    // placeholder.
    expect(screen.getByLabelText("Dart 2: not thrown")).toBeTruthy();
    expect(screen.getByLabelText("Dart 3: not thrown")).toBeTruthy();
    expect(screen.queryByLabelText("Dart 4: not thrown")).toBeNull();
  });
});

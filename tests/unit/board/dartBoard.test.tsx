// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DartBoard } from "@/components/board/DartBoard";
import type { ArmedSegment, DartBoardProps } from "@/components/board/DartBoard";
import { BOARD_DIAMETER_MM, BOARD_SEGMENT_ORDER } from "@/board/boardGeometry";

/**
 * The board is drawn in millimetres, so a click is turned into board-plane
 * millimetres and then resolved by the shared board module. The tests mock
 * the SVG's bounding box (jsdom has no layout) and click in millimetres.
 */
const RENDERED_PX = 600;
const PX_PER_MM = RENDERED_PX / BOARD_DIAMETER_MM;

const SECTOR_INDEX_OF = (n: number): number => BOARD_SEGMENT_ORDER.indexOf(n);

/** A board-plane point (y up) at a sector bearing and radius. */
function sectorPointMm(sectorIndex: number, radiusMm: number) {
  const rad = (sectorIndex * 18 * Math.PI) / 180;
  return { xMm: radiusMm * Math.sin(rad), yMm: radiusMm * Math.cos(rad) };
}

/** Client coordinates of a board-plane point (y up) inside the mocked 600px box. */
function clientPointMm(xMm: number, yMm: number) {
  return {
    clientX: RENDERED_PX / 2 + xMm * PX_PER_MM,
    clientY: RENDERED_PX / 2 - yMm * PX_PER_MM,
  };
}

function renderBoard(props: Partial<DartBoardProps> = {}) {
  const onThrow = vi.fn();
  const utils = render(<DartBoard armedSegment="single" onThrow={onThrow} {...props} />);
  const svg = utils.container.querySelector("svg");
  if (!svg) throw new Error("no svg rendered");
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: RENDERED_PX,
    height: RENDERED_PX,
    right: RENDERED_PX,
    bottom: RENDERED_PX,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  return { ...utils, onThrow, svg };
}

/**
 * A full circle cannot be drawn with a single arc: an arc that starts and
 * ends at the same point is omitted by the renderer and the ring vanishes.
 * Every circle must therefore be at least two half arcs.
 *
 * Returns the subpaths of a path that are not full circles.
 */
function degenerateCircles(d: string): string[] {
  return d
    .split("M")
    .filter((part) => part.trim().length > 0)
    .filter((part) => (part.match(/A/gi) ?? []).length < 2);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DartBoard", () => {
  it("renders twenty sectors in the standard clockwise order from 20 at the top", () => {
    const { container } = renderBoard();

    const beds = container.querySelectorAll("[data-band]");
    expect(beds).toHaveLength(80);

    const treble = [...container.querySelectorAll('[data-band="treble"]')];
    expect(treble).toHaveLength(20);
    expect(treble.map((p) => p.getAttribute("data-sector"))).toEqual(
      BOARD_SEGMENT_ORDER.map(String),
    );

    // 20 is the sector at 12 o'clock: its wedge sits on the vertical axis.
    const twenty = treble[0];
    expect(twenty?.getAttribute("data-bearing")).toBe("0");
    const one = treble[1];
    expect(one?.getAttribute("data-bearing")).toBe("18");
  });

  it("renders the treble and double bands alternating red and green by sector position", () => {
    const { container } = renderBoard();
    const treble = [...container.querySelectorAll('[data-band="treble"]')];
    const double = [...container.querySelectorAll('[data-band="double"]')];

    BOARD_SEGMENT_ORDER.forEach((_number, index) => {
      // Odd positions (1-based) carry the red bands, even positions the green.
      const expected = index % 2 === 0 ? "var(--board-red)" : "var(--board-green)";
      expect(treble[index]?.getAttribute("fill")).toBe(expected);
      expect(double[index]?.getAttribute("fill")).toBe(expected);
    });
  });

  it("renders alternating black and light single sectors", () => {
    const { container } = renderBoard();
    const inner = [...container.querySelectorAll('[data-band="inner-single"]')];
    const outer = [...container.querySelectorAll('[data-band="outer-single"]')];

    BOARD_SEGMENT_ORDER.forEach((_number, index) => {
      const expected = index % 2 === 0 ? "var(--board-sisal-dark)" : "var(--board-sisal-light)";
      expect(inner[index]?.getAttribute("fill")).toBe(expected);
      expect(outer[index]?.getAttribute("fill")).toBe(expected);
    });
  });

  it("renders the inner bull and the outer bull with their specified colours", () => {
    const { container } = renderBoard();

    const inner = container.querySelector('[data-bull="inner"]');
    const outer = container.querySelector('[data-bull="outer"]');
    expect(inner).not.toBeNull();
    expect(outer).not.toBeNull();
    expect(inner?.getAttribute("fill")).toBe("var(--board-bull-inner)");
    expect(outer?.getAttribute("fill")).toBe("var(--board-bull-outer)");
  });

  it("renders a visible number ring with twenty numerals at r = 191 mm", () => {
    const { container } = renderBoard();

    const numerals = [...container.querySelectorAll("[data-numeral]")];
    expect(numerals).toHaveLength(20);
    expect(container.querySelector('[data-part="number-ring"]')).not.toBeNull();

    numerals.forEach((numeral) => {
      const x = Number(numeral.getAttribute("x"));
      const y = Number(numeral.getAttribute("y"));
      expect(Math.hypot(x, y)).toBeCloseTo(191, 2);
    });

    // 20 at 12 o'clock is upright, 6 at 3 o'clock is rotated 90 degrees clockwise.
    expect(numerals[0]?.getAttribute("transform")).toContain("rotate(0");
    expect(numerals[5]?.getAttribute("transform")).toContain("rotate(90");
  });

  it("renders a focusable roving-tabindex grid of 62 cells", () => {
    renderBoard();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(62);

    const tabbable = buttons.filter((b) => b.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(buttons.filter((b) => b.getAttribute("tabindex") === "-1")).toHaveLength(61);

    expect(screen.getByRole("button", { name: "Treble 20, 60 points" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Outer bull, 25 points" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inner bull, 50 points" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Double 13, 26 points" })).toBeTruthy();

    // One tab stop: the grid is entered at the current cell.
    const current = buttons.find((b) => b.getAttribute("tabindex") === "0");
    current?.focus();
    expect(document.activeElement).toBe(current);

    // Arrow keys move between cells.
    fireEvent.keyDown(current as HTMLElement, { key: "ArrowRight" });
    const afterRight = document.activeElement as HTMLElement;
    expect(afterRight.getAttribute("aria-label")).toBe("Double 1, 2 points");
    expect(afterRight.getAttribute("tabindex")).toBe("0");
    expect(buttons.filter((b) => b.getAttribute("tabindex") === "0")).toHaveLength(1);

    fireEvent.keyDown(afterRight, { key: "ArrowLeft" });
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe(
      "Double 20, 40 points",
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe(
      "Treble 20, 60 points",
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowUp" });
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe(
      "Double 20, 40 points",
    );
  });

  it("resolves a click on a treble bed to a triple throw", () => {
    const { onThrow, svg } = renderBoard();

    const point = sectorPointMm(SECTOR_INDEX_OF(13), 103);
    fireEvent.click(svg, clientPointMm(point.xMm, point.yMm));

    expect(onThrow).toHaveBeenCalledTimes(1);
    expect(onThrow).toHaveBeenCalledWith({ points: 39, segment: "triple", label: "T13" });
  });

  it("resolves a click on the bull to a bull throw", () => {
    const { onThrow, svg } = renderBoard();

    fireEvent.click(svg, clientPointMm(0, 0));
    expect(onThrow).toHaveBeenLastCalledWith({ points: 50, segment: "bull", label: "BULL 50" });

    fireEvent.click(svg, clientPointMm(0, 11));
    expect(onThrow).toHaveBeenLastCalledWith({ points: 25, segment: "bull", label: "BULL 25" });
  });

  it("resolves a click outside the playing surface to a miss", () => {
    const { onThrow, svg } = renderBoard();

    // r = 200 is inside the number ring: not scorable.
    fireEvent.click(svg, clientPointMm(0, 200));
    expect(onThrow).toHaveBeenCalledWith({ points: 0, segment: null, label: "MISS" });
  });

  it("highlights the struck bed and marks the impact point", () => {
    const { container, svg } = renderBoard();

    const point = sectorPointMm(SECTOR_INDEX_OF(13), 103);
    fireEvent.click(svg, clientPointMm(point.xMm, point.yMm));

    const highlight = container.querySelector("[data-highlight]");
    expect(highlight).not.toBeNull();
    expect(highlight?.getAttribute("data-highlight")).toBe("treble");
    expect(highlight?.getAttribute("data-sector")).toBe("13");

    const marker = container.querySelector("[data-marker]");
    expect(marker).not.toBeNull();
    // The board plane is y-up, the SVG is y-down: the marker must be flipped.
    expect(marker?.getAttribute("transform")).toBe(
      `translate(${point.xMm.toFixed(2)} ${(-point.yMm).toFixed(2)})`,
    );
  });

  it("offers an armed-band and numeral route as the keyboard equivalent", () => {
    const { container, onThrow } = renderBoard({ armedSegment: "double" });

    const numeral = container.querySelector('[data-numeral="13"]');
    expect(numeral).not.toBeNull();
    fireEvent.click(numeral as Element);
    // The numeral click must not also fall through to the bed resolver.
    expect(onThrow).toHaveBeenCalledTimes(1);
    expect(onThrow).toHaveBeenLastCalledWith({ points: 26, segment: "double", label: "D13" });

    // The same outcome is reachable from the keyboard grid.
    fireEvent.click(screen.getByRole("button", { name: "Double 13, 26 points" }));
    expect(onThrow).toHaveBeenLastCalledWith({ points: 26, segment: "double", label: "D13" });
  });

  it("renders the outer bull and the armed-band outline", () => {
    const { container } = renderBoard({ armedSegment: "triple" });

    const outer = container.querySelector('[data-bull="outer"]');
    expect(outer).not.toBeNull();
    // A full ring must be drawn with two half arcs, never one 360 degree arc:
    // a single arc that returns to its start point is dropped by the renderer.
    expect(degenerateCircles(outer?.getAttribute("d") ?? "")).toEqual([]);

    const armed = container.querySelector('[data-armed="triple"]');
    expect(armed).not.toBeNull();
    expect(degenerateCircles(armed?.getAttribute("d") ?? "")).toEqual([]);
    expect(armed?.getAttribute("stroke")).toBe("var(--color-brass)");
  });

  it("outlines the armed band in brass for every armed segment", () => {
    // The single segment covers two painted beds (inner and outer single),
    // so it is outlined twice; treble and double are one band each.
    const expectedOutlines: Record<ArmedSegment, number> = {
      single: 2,
      double: 1,
      triple: 1,
    };

    for (const armed of ["single", "double", "triple"] as const) {
      const { container, unmount } = renderBoard({ armedSegment: armed });
      const outlines = [...container.querySelectorAll("[data-armed]")];
      expect(outlines.length).toBe(expectedOutlines[armed]);
      outlines.forEach((outline) => {
        expect(outline.getAttribute("stroke")).toBe("var(--color-brass)");
        expect(degenerateCircles(outline.getAttribute("d") ?? "")).toEqual([]);
      });
      unmount();
    }
  });

  it("renders nothing interactive in read-only mode", () => {
    const { container, onThrow, svg } = renderBoard({ readOnly: true });

    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelector('[role="group"]')?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(svg, clientPointMm(0, 0));
    expect(onThrow).not.toHaveBeenCalled();
  });
});

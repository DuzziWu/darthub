import { describe, it, expect } from "vitest";
import {
  BOARD_DIAMETER_MM,
  BOARD_RADII_MM,
  BOARD_SEGMENT_ORDER,
  resolveBoardHit,
} from "@/board/boardGeometry";
import { expectHit } from "./helpers";

/**
 * Board-plane helper: the point at `radius` mm and `deg` clockwise from
 * 12 o'clock (x positive = right, y positive = above centre).
 */
function pointAt(radius: number, deg: number): { xMm: number; yMm: number } {
  const rad = (deg * Math.PI) / 180;
  return { xMm: radius * Math.sin(rad), yMm: radius * Math.cos(rad) };
}

describe("resolveBoardHit", () => {
  it("resolves a treble of 13 to segment triple with 39 points", () => {
    // 13 sits at index 4 of the segment order -> 72 degrees clockwise from 12.
    const { xMm, yMm } = pointAt(100, 72);

    const resolution = expectHit(resolveBoardHit(xMm, yMm));

    expect(resolution.segment).toBe("triple");
    expect(resolution.points).toBe(39);
    expect(resolution.sector).toBe(13);
    expect(resolution.label).toBe("T13");
  });

  it("resolves a double of 16 to segment double with 32 points", () => {
    // 16 sits at index 13 of the segment order -> 234 degrees clockwise from 12.
    const { xMm, yMm } = pointAt(166, 234);

    const resolution = expectHit(resolveBoardHit(xMm, yMm));

    expect(resolution.segment).toBe("double");
    expect(resolution.points).toBe(32);
    expect(resolution.sector).toBe(16);
    expect(resolution.label).toBe("D16");
  });

  it("resolves a single of 7 to segment single with 7 points", () => {
    // 7 sits at index 12 of the segment order -> 216 degrees clockwise from 12.
    const { xMm, yMm } = pointAt(130, 216);

    const resolution = expectHit(resolveBoardHit(xMm, yMm));

    expect(resolution.segment).toBe("single");
    expect(resolution.points).toBe(7);
    expect(resolution.sector).toBe(7);
    expect(resolution.label).toBe("S7");
  });

  it("resolves the inner bull to 50 points and the outer bull to 25 points", () => {
    const inner = expectHit(resolveBoardHit(0, 0));
    expect(inner.segment).toBe("bull");
    expect(inner.points).toBe(50);
    expect(inner.sector).toBeNull();
    expect(inner.label).toBe("BULL 50");

    const outer = expectHit(resolveBoardHit(0, 10));
    expect(outer.segment).toBe("bull");
    expect(outer.points).toBe(25);
    expect(outer.sector).toBeNull();
    expect(outer.label).toBe("BULL 25");
  });

  it("resolves a point outside the double ring to a miss", () => {
    const inNumberRing = resolveBoardHit(190, 0);
    expect(inNumberRing.hit).toBe(false);
    expect(inNumberRing.points).toBe(0);
    expect(inNumberRing.label).toBe("MISS");

    const offBoard = resolveBoardHit(0, 400);
    expect(offBoard.hit).toBe(false);
    expect(offBoard.points).toBe(0);
    expect(offBoard.label).toBe("MISS");
  });

  it("resolves the twenty sectors in the standard clockwise order from 20 at the top", () => {
    const expectedOrder = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    expect([...BOARD_SEGMENT_ORDER]).toEqual(expectedOrder);

    const labels: string[] = [];
    const sectors: number[] = [];
    for (let i = 0; i < expectedOrder.length; i += 1) {
      const { xMm, yMm } = pointAt(103, i * 18);
      const resolution = expectHit(resolveBoardHit(xMm, yMm));
      expect(resolution.segment).toBe("triple");
      sectors.push(resolution.sector ?? 0);
      labels.push(resolution.label);
    }

    expect(sectors).toEqual(expectedOrder);
    expect(labels).toEqual([
      "T20",
      "T1",
      "T18",
      "T4",
      "T13",
      "T6",
      "T10",
      "T15",
      "T2",
      "T17",
      "T3",
      "T19",
      "T7",
      "T16",
      "T8",
      "T11",
      "T14",
      "T9",
      "T12",
      "T5",
    ]);

    // A point exactly on a wedge edge belongs to the sector whose angular
    // range starts there, walking clockwise from 20. The 9 degree edge is
    // the boundary between 20 and 1.
    const onEdge = pointAt(103, 9);
    expect(expectHit(resolveBoardHit(onEdge.xMm, onEdge.yMm)).sector).toBe(1);
  });

  it("resolves a band boundary to the inner band", () => {
    const at = (radius: number) => resolveBoardHit(radius, 0);

    expect(expectHit(at(6.35))).toMatchObject({
      segment: "bull",
      points: 50,
      label: "BULL 50",
    });
    expect(expectHit(at(15.9))).toMatchObject({
      segment: "bull",
      points: 25,
      label: "BULL 25",
    });
    expect(expectHit(at(99))).toMatchObject({
      segment: "single",
      points: 6,
      label: "S6",
    });
    expect(expectHit(at(107))).toMatchObject({
      segment: "triple",
      points: 18,
      label: "T6",
    });
    expect(expectHit(at(162))).toMatchObject({
      segment: "single",
      points: 6,
      label: "S6",
    });
    expect(expectHit(at(170))).toMatchObject({
      segment: "double",
      points: 12,
      label: "D6",
    });
    expect(at(170.1)).toMatchObject({ hit: false, points: 0, label: "MISS" });

    // Just outside a boundary flips to the next band.
    expect(expectHit(at(99.001)).segment).toBe("triple");
    expect(expectHit(at(107.001)).segment).toBe("single");
    expect(expectHit(at(162.001)).segment).toBe("double");
    expect(at(170.001).hit).toBe(false);
  });
});

describe("board constants", () => {
  it("exposes the standard board diameter and radii", () => {
    expect(BOARD_DIAMETER_MM).toBe(451);
    expect(BOARD_RADII_MM).toEqual({
      innerBull: 6.35,
      outerBull: 15.9,
      innerSingleOuter: 99,
      trebleOuter: 107,
      outerSingleOuter: 162,
      doubleOuter: 170,
      numberRingOuter: 225.5,
    });
  });
});

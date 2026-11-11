import { describe, it, expect } from "vitest";
import { resolveBoardHit, toBoardMm } from "@/board/boardGeometry";
import { expectHit } from "./helpers";

describe("board coordinate frame", () => {
  it("uses board-plane millimetres with x positive right and y positive above centre", () => {
    // 20 is at 12 o'clock: above the centre (y positive).
    expect(expectHit(resolveBoardHit(0, 50)).sector).toBe(20);

    // 6 is at 3 o'clock: right of the centre (x positive).
    expect(expectHit(resolveBoardHit(50, 0)).sector).toBe(6);

    // 3 is at 6 o'clock: below the centre (y negative).
    expect(expectHit(resolveBoardHit(0, -50)).sector).toBe(3);

    // 11 is at 9 o'clock: left of the centre (x negative).
    expect(expectHit(resolveBoardHit(-50, 0)).sector).toBe(11);
  });
});

describe("toBoardMm", () => {
  it("converts pixel offsets to board millimetres and negates the y axis", () => {
    expect(toBoardMm(100, 50, 2)).toEqual({ xMm: 50, yMm: -25 });
    expect(toBoardMm(-100, -50, 2)).toEqual({ xMm: -50, yMm: 25 });
    expect(toBoardMm(451, 0, 1)).toEqual({ xMm: 451, yMm: -0 });
  });
});

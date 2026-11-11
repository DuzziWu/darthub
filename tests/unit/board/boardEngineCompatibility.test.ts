import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, expectTypeOf } from "vitest";
import { BOARD_SEGMENT_ORDER, resolveBoardHit } from "@/board/boardGeometry";
import type { BoardSegment } from "@/board/boardGeometry";
import type { ThrowSegment } from "@/game-engine/types";
import { isValidSegmentScore } from "@/game-engine/rules/OutRules";
import { expectHit } from "./helpers";

const ENGINE_TYPES_PATH = resolve(import.meta.dirname, "../../../src/game-engine/types.ts");

describe("board / engine segment compatibility", () => {
  it("keeps the existing ThrowSegment export working from the game engine", () => {
    // The engine's ThrowSegment is the board's BoardSegment: one definition.
    expectTypeOf<ThrowSegment>().toEqualTypeOf<BoardSegment>();

    // The name is still importable from its original path and still usable
    // by the engine's own validator.
    const segment: ThrowSegment = "triple";
    expect(isValidSegmentScore(segment, 39)).toBe(true);

    // The engine re-exports the board's type instead of redefining it.
    const engineTypes = readFileSync(ENGINE_TYPES_PATH, "utf8");
    expect(engineTypes).toMatch(/export type \{[^}]*BoardSegment as ThrowSegment[^}]*\}/);
    expect(engineTypes).not.toMatch(/type ThrowSegment\s*=/);
  });

  it("produces only segment and score pairs the game engine accepts", () => {
    const produced: { segment: BoardSegment; points: number }[] = [];

    // Every sector, in every scoring band, plus both bulls.
    for (let i = 0; i < BOARD_SEGMENT_ORDER.length; i += 1) {
      const rad = (i * 18 * Math.PI) / 180;
      for (const radius of [20, 50, 90, 103, 130, 166]) {
        const resolution = expectHit(
          resolveBoardHit(radius * Math.sin(rad), radius * Math.cos(rad)),
        );
        produced.push({ segment: resolution.segment, points: resolution.points });
      }
    }

    for (const radius of [0, 10]) {
      const resolution = expectHit(resolveBoardHit(0, radius));
      produced.push({ segment: resolution.segment, points: resolution.points });
    }

    expect(produced.length).toBe(122);

    for (const { segment, points } of produced) {
      expect(isValidSegmentScore(segment, points)).toBe(true);
    }
  });
});

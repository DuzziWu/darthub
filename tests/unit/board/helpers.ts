import { expect } from "vitest";
import type { BoardHit, BoardResolution } from "@/board/boardGeometry";

/**
 * Assert that a resolution is a hit and narrow it to the hit variant, so
 * the tests can read `segment` / `sector` without casting.
 */
export function expectHit(resolution: BoardResolution): BoardHit {
  if (!resolution.hit) {
    expect.fail(`expected a hit, got ${resolution.label}`);
  }
  return resolution;
}

import { describe, it, expect } from "vitest";
import type { CameraDTO } from "@/camera/CameraDTO";
import type { BoardSegment } from "@/board/boardGeometry";

/**
 * A sample DTO matching the CameraDTO contract shape. Field presence is
 * asserted at runtime; structural correctness (required fields, types) is
 * verified by the scoped tsc run in the compile-time tests.
 */
const sample = {
  x: 12,
  y: -8,
  score: 20,
  segment: "triple",
  timestamp: 1_700_000_000_000,
} satisfies CameraDTO;

/**
 * The segment is optional so the existing stub producers keep compiling;
 * this sample proves the field is genuinely optional.
 */
const withoutSegment: CameraDTO = {
  x: 12,
  y: -8,
  score: 20,
  timestamp: 1_700_000_000_000,
};

describe("CameraDTO", () => {
  it("defines CameraDTO with fields: x, y, score, segment, timestamp", async () => {
    // A dynamic (non-type-only) import keeps the module resolution under test.
    const module = await import("@/camera/CameraDTO");
    expect(module).toBeDefined();

    const dto: CameraDTO = sample;
    expect(Object.keys(dto).sort()).toEqual(["score", "segment", "timestamp", "x", "y"]);
    expect([
      typeof dto.x,
      typeof dto.y,
      typeof dto.score,
      typeof dto.segment,
      typeof dto.timestamp,
    ]).toEqual(["number", "number", "number", "string", "number"]);
  });

  it("accepts the optional board segment", () => {
    const segment: BoardSegment = "double";
    const dto: CameraDTO = { ...withoutSegment, segment };

    expect(dto.segment).toBe("double");
    expect(withoutSegment.segment).toBeUndefined();
  });
});

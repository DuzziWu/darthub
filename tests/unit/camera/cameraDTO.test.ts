import { describe, it, expect } from "vitest";
import type { CameraDTO } from "@/camera/CameraDTO";

/**
 * A sample DTO matching the CameraDTO contract shape. Field presence is
 * asserted at runtime; structural correctness (required fields, types) is
 * verified by the scoped tsc run in the compile-time tests.
 */
const sample = {
  x: 12,
  y: -8,
  score: 20,
  timestamp: 1_700_000_000_000,
} satisfies CameraDTO;

describe("CameraDTO", () => {
  it("defines CameraDTO with fields: x, y, score, timestamp", async () => {
    // A dynamic (non-type-only) import keeps the module resolution under test.
    const module = await import("@/camera/CameraDTO");
    expect(module).toBeDefined();

    const dto: CameraDTO = sample;
    expect(Object.keys(dto).sort()).toEqual(["score", "timestamp", "x", "y"]);
    expect([typeof dto.x, typeof dto.y, typeof dto.score, typeof dto.timestamp]).toEqual([
      "number",
      "number",
      "number",
      "number",
    ]);
  });
});

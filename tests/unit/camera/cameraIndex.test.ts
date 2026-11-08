import { describe, it, expect } from "vitest";

describe("Camera barrel", () => {
  it("an index.ts barrel file exports ICameraService and CameraDTO for easy imports", async () => {
    // A dynamic (non-type-only) import keeps the module resolution under test.
    // The contracts are type-only, so structural checking is done by the
    // scoped tsc run in cameraCompile.test.ts via ./camera-contract.check.ts.
    const module = await import("@/camera");
    expect(module).toBeDefined();
  });
});

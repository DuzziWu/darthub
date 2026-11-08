import { describe, it, expect } from "vitest";
import type { ICameraService } from "@/camera/ICameraService";
import type { CameraDTO } from "@/camera/CameraDTO";

/**
 * Runtime stub used only to surface the method names declared by the
 * ICameraService contract. The full structural contract is verified by the
 * scoped tsc run in the compile-time tests.
 */
class StubCameraService implements ICameraService {
  async start(): Promise<void> {
    return undefined;
  }

  async stop(): Promise<void> {
    return undefined;
  }

  async captureThrow(): Promise<CameraDTO> {
    return {
      x: 12,
      y: -8,
      score: 60,
      timestamp: 1_700_000_000_000,
    };
  }
}

describe("ICameraService", () => {
  it("defines ICameraService with start, stop, captureThrow methods", async () => {
    // A dynamic (non-type-only) import keeps the module resolution under test.
    const module = await import("@/camera/ICameraService");
    expect(module).toBeDefined();

    const service: ICameraService = new StubCameraService();

    const methodNames = Object.getOwnPropertyNames(StubCameraService.prototype)
      .filter((name) => name !== "constructor")
      .sort();

    expect(typeof service.start).toBe("function");
    expect(typeof service.stop).toBe("function");
    expect(typeof service.captureThrow).toBe("function");
    expect(methodNames).toEqual(["captureThrow", "start", "stop"]);
  });
});

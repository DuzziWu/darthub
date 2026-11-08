import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CameraDTO, ICameraProcessor } from "@/camera";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(import.meta.dirname, relativePath), "utf8");

const README = (): string => readSource("../../../src/camera/README.md");

const SERVICE_SOURCE = (): string => readSource("../../../src/camera/SmartphoneCameraService.ts");

const createFakeStream = (): { getTracks: () => { stop: () => void }[] } => {
  const tracks: { stop: () => void }[] = [{ stop: () => undefined }];
  return { getTracks: () => tracks };
};

let getUserMedia: unknown;

const installMediaDevices = (getUserMediaImpl: unknown): void => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: getUserMediaImpl } },
  });
};

describe("Camera stub vs computer-vision implementation (task 044)", () => {
  it("mentions that the stub returns dummy CameraDTO data", () => {
    const readme = README();
    const service = SERVICE_SOURCE();

    // The README must clearly label the current implementation a stub and
    // spell out exactly what the dummy capture data looks like.
    expect(readme).toMatch(/stub/i);
    expect(readme).toMatch(/dummy/i);
    expect(readme).toMatch(/CameraDTO/i);
    expect(readme).toMatch(/NOT\s+(yet\s+)?(perform|run|contain)/i);
    expect(readme).toMatch(/computer[-\s]?vision|CV/i);

    // The service header comment itself carries the STUB labelling, too.
    expect(service).toMatch(/STUB/i);
    expect(service).toMatch(/dummy/i);
    expect(service).toMatch(/CameraDTO/i);
  });

  it("outlines the planned CV pipeline stages (calibration, perspective correction, detection)", () => {
    const readme = README();

    // The roadmap section must mark the pipeline as future work and spell
    // out each processing stage the CV module will implement.
    expect(readme).toMatch(/future\s+phase/i);
    expect(readme).toMatch(/pipeline/i);
    expect(readme).toMatch(/\*\*Calibration\*\*/);
    expect(readme).toMatch(/\*\*Perspective correction\*\*/);
    expect(readme).toMatch(/\*\*Hit detection\*\*/);
    expect(readme).toMatch(/roadmap/i);
  });

  it("defines an interface ICameraProcessor for the future implementation", async () => {
    // Compile-time contract: `ICameraProcessor` must be exported from the
    // barrel and must be satisfiable by a future CV implementation object.
    const { processorContractHolds } = await import("./cameraProcessorContract.check");
    expect(() => processorContractHolds()).not.toThrow();

    // Runtime contract: `SmartphoneCameraService` accepts an object that
    // implements `ICameraProcessor` (not just a bare processor function).
    const { SmartphoneCameraService } = await import("@/camera/SmartphoneCameraService");
    const detected: CameraDTO = { x: 11, y: -7, score: 20, timestamp: 4321 };
    const processFrame = vi.fn().mockResolvedValue(detected);
    const cvProcessor: ICameraProcessor = { processFrame };

    const activeStream = createFakeStream() as unknown as MediaStream;
    getUserMedia = vi.fn().mockResolvedValue(activeStream);
    installMediaDevices(getUserMedia);

    const service = new SmartphoneCameraService({ processor: cvProcessor });
    await service.start();

    await expect(service.captureThrow()).resolves.toBe(detected);
    // The CV processor receives the active camera stream for analysis.
    expect(processFrame).toHaveBeenCalledTimes(1);
    expect(processFrame).toHaveBeenCalledWith(activeStream);

    // A bare processor function must remain accepted (existing 012/013 seam).
    const bareFn = vi.fn().mockResolvedValue(detected);
    const fnService = new SmartphoneCameraService({
      processor: bareFn as unknown as ICameraProcessor,
    });
    await fnService.start();
    await expect(fnService.captureThrow()).resolves.toBe(detected);
  });
});

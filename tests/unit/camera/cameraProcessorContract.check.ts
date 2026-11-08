/**
 * Compile-time contract checks for the ICameraProcessor plug point (task 044).
 *
 * Executed nowhere at runtime: it exists only so the scoped `tsc` run (see
 * cameraCompile.test.ts and ./tsconfig.json) proves the interface is
 * exported from the barrel (`@/camera`) and is satisfiable by the future
 * computer-vision implementation. The `@ts-expect-error` directives turn
 * contract violations into compile errors.
 */
import type { CameraDTO, ICameraProcessor } from "@/camera";

export const processorContractHolds = (): void => {
  // The future CV implementation (calibration -> perspective correction ->
  // hit detection) satisfies the plug point by implementing processFrame.
  class PlannedCvProcessor implements ICameraProcessor {
    async processFrame(stream: MediaStream): Promise<CameraDTO> {
      void stream;
      return { x: 0, y: 0, score: 0, timestamp: Date.now() };
    }
  }

  const processor: ICameraProcessor = new PlannedCvProcessor();
  void processor;

  // An object without processFrame must NOT satisfy the contract.
  interface NoProcessFrame {
    calibrate(): Promise<void>;
  }
  // @ts-expect-error an object without `processFrame` is not an ICameraProcessor
  const broken: ICameraProcessor = {} as NoProcessFrame;
  void broken;
};

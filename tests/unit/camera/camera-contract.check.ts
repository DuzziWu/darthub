/**
 * Compile-time contract checks for the camera abstraction layer.
 *
 * This file is intentionally executed nowhere: it contains no runtime code
 * and exists only so the scoped `tsc` run (see cameraCompile.test.ts, via
 * ./tsconfig.json) can prove the camera contracts type-check on their own,
 * without any concrete implementation. The `@ts-expect-error` directives turn
 * contract violations into compile errors, so a broken contract fails the
 * compile check.
 *
 * Imports go through the barrel (`@/camera`) so the barrel export surface
 * itself is part of the verified contract.
 */
import type { CameraDTO, ICameraService } from "@/camera";

class ContractStubCameraService implements ICameraService {
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

export const serviceContractHolds = (): void => {
  const service: ICameraService = new ContractStubCameraService();
  const dto: CameraDTO = {
    x: 12,
    y: -8,
    score: 20,
    timestamp: Date.now(),
  };

  void dto;
  void service;

  // A service missing `stop` must not satisfy the ICameraService contract.
  interface IncompleteService {
    start(): Promise<void>;
    captureThrow(): Promise<CameraDTO>;
  }
  // @ts-expect-error an object without `stop` is not an ICameraService
  const incomplete: ICameraService = {} as IncompleteService;

  // A DTO missing `timestamp` must not satisfy the CameraDTO contract.
  // @ts-expect-error an object without `timestamp` is not a CameraDTO
  const missingField: CameraDTO = { x: 0, y: 0, score: 0 };

  void incomplete;
  void missingField;
};

serviceContractHolds();

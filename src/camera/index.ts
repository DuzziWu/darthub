/**
 * Camera abstraction layer barrel.
 *
 * Import camera contracts from here:
 *   import type { ICameraService, CameraDTO } from "@/camera";
 *
 * No concrete camera implementation is exported; implementations are wired
 * up by the layers that depend on them (see later tasks, stub vs CV).
 */
export type { CameraDTO } from "./CameraDTO";
export type { ICameraService } from "./ICameraService";
export type { CameraCalibration, ICameraProcessor } from "./ICameraProcessor";

// Task 045: outline of the future computer-vision pipeline. Placeholder
// classes only (every stub raises NotImplementedInCvPhaseError); the real
// CV implementation is still a future phase — see src/camera/vision/README.md.
export * from "./vision";

/**
 * Computer-vision pipeline outline barrel (task 045).
 *
 * Placeholder classes for the future CV phase — calibration, perspective
 * correction and hit detection. Every stub raises
 * NotImplementedInCvPhaseError; see README.md in this directory for the
 * intended algorithmic steps.
 */
export { Calibration } from "./Calibration";
export type { CameraExtrinsics, CameraFrame, CameraIntrinsics } from "./Calibration";
export { HitDetector } from "./HitDetector";
export type { DetectedDartImpact } from "./HitDetector";
export { NotImplementedInCvPhaseError } from "./NotImplementedInCvPhaseError";
export { Perspective } from "./Perspective";
export type { BoardPoint, ImagePoint } from "./Perspective";
export { VisionProcessor } from "./VisionProcessor";

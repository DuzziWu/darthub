/**
 * Camera-calibration outline for the future computer-vision phase
 * (see `src/camera/vision/README.md`). Placeholder only: the class defines
 * the calibration API surface, but raises {@link NotImplementedInCvPhaseError}
 * from every method — no calibration logic exists in this build.
 *
 * Intended calibration model (documented intent, not yet implemented):
 *
 * - **Intrinsic parameters** — the camera's fixed optical properties,
 *   estimated once per device: focal lengths (fx, fy in px), principal
 *   point (cx, cy in px) and radial/tangential lens-distortion
 *   coefficients. Estimated from reference patterns (e.g. a checkerboard)
 *   held before the camera; used to undistort captured frames.
 * - **Extrinsic parameters** — the pose of the camera relative to the
 *   dart board: a rotation matrix and a translation vector (mm) placing
 *   the board plane in camera space. Solved from correspondences between
 *   board reference points (board corners / wires / marker ring) and their
 *   undistorted image positions.
 * - The combined result is folded into the {@link CameraCalibration}
 *   contract (the 3×3 homography plus the board reference diameter in mm)
 *   required by the perspective-correction stage.
 */
import type { CameraCalibration } from "../ICameraProcessor";
import { NotImplementedInCvPhaseError } from "./NotImplementedInCvPhaseError";

/**
 * Declarative placeholder for the intrinsic camera parameters the CV
 * implementation will estimate during calibration.
 */
export interface CameraIntrinsics {
  readonly focalLengthPx: { readonly x: number; readonly y: number };
  readonly principalPointPx: { readonly x: number; readonly y: number };
  readonly distortionCoefficients: readonly number[];
}

/**
 * Declarative placeholder for the extrinsic camera parameters (board pose)
 * the CV implementation will estimate during calibration.
 */
export interface CameraExtrinsics {
  /** 3×3 rotation matrix, row-major. */
  readonly rotation: readonly (readonly number[])[];
  /** Translation vector taking board coordinates into camera space (mm). */
  readonly translation: readonly [number, number, number];
}

/**
 * Geometry-only description of a captured frame. Deliberately carries no
 * pixel payload in this phase; the future CV implementation will extend it
 * with the image data it needs.
 */
export interface CameraFrame {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly capturedAt: number;
}

/**
 * Stage 1 of the planned CV pipeline: camera calibration.
 */
export class Calibration {
  /**
   * Estimates the calibration model from the active camera stream
   * (intrinsic + extrinsic parameters, folded into the homography-based
   * {@link CameraCalibration} contract).
   *
   * STUB: raises {@link NotImplementedInCvPhaseError}.
   */
  public async calibrate(stream: MediaStream): Promise<CameraCalibration> {
    void stream;
    throw new NotImplementedInCvPhaseError("Calibration.calibrate()");
  }

  /**
   * Applies the calibration model to a captured frame, normalising its
   * geometry (undistortion, scale to board-plane millimetres) ahead of the
   * perspective-correction stage.
   *
   * STUB: raises {@link NotImplementedInCvPhaseError}.
   */
  public apply(frame: CameraFrame, calibration: CameraCalibration): CameraFrame {
    void frame;
    void calibration;
    throw new NotImplementedInCvPhaseError("Calibration.apply()");
  }
}

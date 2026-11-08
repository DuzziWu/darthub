/**
 * Perspective-correction outline for the future computer-vision phase
 * (see `src/camera/vision/README.md`). Placeholder only: the class defines
 * the transform API surface, but raises {@link NotImplementedInCvPhaseError}
 * — no homography arithmetic exists in this build.
 *
 * Intended algorithm (documented intent, not yet implemented):
 *
 * 1. Take the homography (3×3 row-major) from the {@link CameraCalibration}
 *    produced by the calibration stage, which warps the camera image so the
 *    dart board is viewed top-down.
 * 2. Apply the homography to the detected image point: for pixel (u, v)
 *    form the homogeneous vector (u, v, 1), compute H·(u, v, 1)ᵀ and
 *    de-homogenise by dividing the first two components by the third.
 * 3. Scale the result from the board reference frame (normalised so the
 *    board reference diameter spans `boardReferenceDiameterMm` mm) into
 *    absolute board-plane millimetres, with the origin at the centre of
 *    the board (y positive = above centre, x positive = right of centre),
 *    matching {@link CameraDTO} coordinate semantics.
 */
import type { CameraCalibration } from "../ICameraProcessor";
import { NotImplementedInCvPhaseError } from "./NotImplementedInCvPhaseError";

/**
 * A point detected in the camera image, in pixels (origin: top-left of the
 * frame, x rightwards, y downwards).
 */
export interface ImagePoint {
  readonly xPx: number;
  readonly yPx: number;
}

/**
 * A point on the dart-board plane, in millimetres relative to the centre of
 * the board (x positive = right, y positive = above centre) — the coordinate
 * semantics of the `x`/`y` fields of {@link CameraDTO}.
 */
export interface BoardPoint {
  readonly xMm: number;
  readonly yMm: number;
}

/**
 * Stage 2 of the planned CV pipeline: perspective correction.
 */
export class Perspective {
  /**
   * Maps a detected image point through the calibration homography into
   * board-plane millimetres.
   *
   * STUB: raises {@link NotImplementedInCvPhaseError}.
   */
  public transform(point: ImagePoint, calibration: CameraCalibration): BoardPoint {
    void point;
    void calibration;
    throw new NotImplementedInCvPhaseError("Perspective.transform()");
  }
}

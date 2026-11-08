/**
 * Hit-detection outline for the future computer-vision phase (see
 * `src/camera/vision/README.md`). Placeholder only: the class defines the
 * detection API surface, but raises {@link NotImplementedInCvPhaseError}
 * from `detect()` — no segmentation or scoring logic exists in this build.
 *
 * Intended algorithm (documented intent, not yet implemented):
 *
 * 1. Receive the board-space impact point produced by the segmentation of
 *    the perspective-corrected (top-down) frame — the dart tip/flight
 *    region located in board-plane millimetres.
 * 2. Validate the point against the legal board area (inside the outer
 *    double ring; otherwise the throw is a miss, `score: 0`).
 * 3. Derive the awarded score from the standard dart-board segment
 *    geometry: radius rings (double/triple/small-bull/bull) and the 20
 *    angular wedges (20 at the top, clockwise 1, 18, 4, ...).
 * 4. Emit the throw as a {@link CameraDTO}: impact coordinates in
 *    board-plane millimetres relative to the board centre (x positive =
 *    right, y positive = above centre — the semantics of the `x`/`y`
 *    fields), the derived `score`, and the current wall-clock `timestamp`.
 */
import type { CameraDTO } from "../CameraDTO";
import { NotImplementedInCvPhaseError } from "./NotImplementedInCvPhaseError";

/**
 * A dart-tip impact located in board-plane millimetres (the output space of
 * the perspective-correction stage), as located by the future segmentation
 * step.
 */
export interface DetectedDartImpact {
  readonly xMm: number;
  readonly yMm: number;
  /** Optional detector confidence in [0, 1]; semantics set by the CV phase. */
  readonly confidence?: number;
}

/**
 * Stages 3-4 of the planned CV pipeline: hit detection and scoring.
 */
export class HitDetector {
  /**
   * Translates a detected impact point into the scored throw DTO.
   *
   * STUB: raises {@link NotImplementedInCvPhaseError}.
   */
  public async detect(impact: DetectedDartImpact): Promise<CameraDTO> {
    void impact;
    throw new NotImplementedInCvPhaseError("HitDetector.detect()");
  }
}

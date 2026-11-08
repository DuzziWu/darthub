import type { CameraDTO } from "./CameraDTO";

/**
 * Calibration result produced by the future computer-vision pipeline's
 * first stage. Maps the camera image plane onto the physical dart board
 * so impact coordinates can be expressed in board-plane millimetres.
 */
export interface CameraCalibration {
  /**
   * Homography matrix (3x3, row-major) that warps a camera frame so the
   * dart board is viewed top-down (perspective correction stage).
   */
  homography: readonly (readonly number[])[];

  /**
   * Physical diameter of the reference area used during calibration, in
   * millimetres — the scale factor between image pixels and board mm.
   */
  boardReferenceDiameterMm: number;
}

/**
 * Plug point for the future computer-vision implementation (task 044
 * roadmap, see `src/camera/README.md`).
 *
 * This is the ONLY contract between the camera layer and computer vision:
 * the current `SmartphoneCameraService` is a stub that resolves dummy
 * {@link CameraDTO} data, and a real CV module must not couple into it
 * except by implementing this interface. No CV library dependency is
 * introduced for the stub.
 *
 * Planned pipeline stages a concrete implementation will cover:
 * 1. calibration (see {@link CameraCalibration}),
 * 2. perspective correction,
 * 3. hit detection,
 * 4. coordinate mapping and score derivation, producing the {@link CameraDTO}.
 */
export interface ICameraProcessor {
  /**
   * Optional one-time calibration hook. A CV implementation may derive and
   * expose its calibration model from the active camera stream before
   * frames are analysed.
   */
  calibrate?(stream: MediaStream): Promise<CameraCalibration>;

  /**
   * Analyses the active camera stream and returns the detected dart throw.
   * Required for every implementation of this contract.
   */
  processFrame(stream: MediaStream): Promise<CameraDTO>;
}

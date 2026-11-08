/**
 * Pipeline outline for the future computer-vision phase (task 045): wires
 * the calibration, perspective-correction and hit-detection stubs into the
 * {@link ICameraProcessor} plug point defined by task 044.
 *
 * This is a placeholder, NOT a computer-vision implementation: no image
 * processing happens here and every call raises
 * {@link NotImplementedInCvPhaseError}. The future CV phase will replace
 * the throwing stages with real algorithms while keeping the wiring shape
 * below (and no CV library may be pulled in until then).
 */
import type { CameraCalibration, ICameraProcessor } from "../ICameraProcessor";
import type { CameraDTO } from "../CameraDTO";
import { Calibration } from "./Calibration";
import { HitDetector } from "./HitDetector";
import { NotImplementedInCvPhaseError } from "./NotImplementedInCvPhaseError";
import { Perspective } from "./Perspective";

/**
 * Stage wiring for the planned CV pipeline (no image analysis yet).
 */
export class VisionProcessor implements ICameraProcessor {
  private readonly calibration: Calibration;

  private readonly perspective: Perspective;

  private readonly hitDetector: HitDetector;

  public constructor(
    calibration: Calibration = new Calibration(),
    perspective: Perspective = new Perspective(),
    hitDetector: HitDetector = new HitDetector(),
  ) {
    this.calibration = calibration;
    this.perspective = perspective;
    this.hitDetector = hitDetector;
  }

  /**
   * Optional one-time calibration hook of the {@link ICameraProcessor}
   * contract, delegated to stage 1.
   *
   * STUB: raises {@link NotImplementedInCvPhaseError}.
   */
  public async calibrate(stream: MediaStream): Promise<CameraCalibration> {
    return this.calibration.calibrate(stream);
  }

  /**
   * Required hook of the {@link ICameraProcessor} contract. The planned
   * frame analysis is calibration -> segmentation -> perspective transform
   * -> hit detection/score; only the wiring exists, the stages refuse to
   * run.
   *
   * STUB: raises {@link NotImplementedInCvPhaseError}.
   */
  public async processFrame(stream: MediaStream): Promise<CameraDTO> {
    void stream;
    throw new NotImplementedInCvPhaseError("VisionProcessor.processFrame()");
  }
}

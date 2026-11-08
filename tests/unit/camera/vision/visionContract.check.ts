/**
 * Compile-time contract checks for the computer-vision module outline
 * (task 045). Executed nowhere at runtime: it exists only so the scoped
 * `tsc` run (see visionCompile.test.ts and ./tsconfig.json) proves the
 * interfaces compile and are satisfiable by the future CV implementation.
 * The `@ts-expect-error` directives turn contract violations into errors.
 */
import type { CameraCalibration, CameraDTO, ICameraProcessor } from "@/camera";
import { Calibration, HitDetector, Perspective, VisionProcessor } from "@/camera/vision";
import type { BoardPoint, DetectedDartImpact } from "@/camera/vision";

const IDENTITY_CALIBRATION: CameraCalibration = {
  homography: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  boardReferenceDiameterMm: 451,
};

export const visionContractHolds = (): void => {
  const mmPoint = { xMm: 1, yMm: 2 };
  const pixelPoint = { xPx: 5, yPx: 6 };
  const perspective = new Perspective();
  const hitDetector = new HitDetector();

  // The assembled pipeline outline satisfies the ICameraProcessor plug point
  // with zero configuration (default stage wiring).
  const pipeline: ICameraProcessor = new VisionProcessor();
  const dto: Promise<CameraDTO> = pipeline.processFrame({} as MediaStream);
  void dto;

  // VisionProcessor also exposes the optional calibrate hook of the contract.
  const calibration: Promise<CameraCalibration> = new VisionProcessor().calibrate(
    {} as MediaStream,
  );
  void calibration;

  // Calibration.calibrate resolves the 044 calibration contract shape.
  const calibration2: Promise<CameraCalibration> = new Calibration().calibrate({} as MediaStream);
  void calibration2;

  // Calibration.apply consumes (frame, calibration) and yields a frame.
  const frame = new Calibration().apply(
    { widthPx: 1920, heightPx: 1080, capturedAt: 1234 },
    IDENTITY_CALIBRATION,
  );
  void frame;

  // Perspective.transform maps an image point to a board point.
  const board: BoardPoint = new Perspective().transform(
    { xPx: 960, yPx: 540 },
    IDENTITY_CALIBRATION,
  );
  void board;

  // HitDetector.detect resolves a CameraDTO-shaped value.
  const impact: DetectedDartImpact = { xMm: 60, yMm: -45, confidence: 0.9 };
  const detected: Promise<CameraDTO> = new HitDetector().detect(impact);
  void detected;

  // ---- Contract violations must not compile ----

  // @ts-expect-error a missing `processFrame` is not an ICameraProcessor
  const noProcessFrame: ICameraProcessor = new Calibration();
  void noProcessFrame;

  // @ts-expect-error an ImagePoint's coordinates are `xPx`/`yPx`, not mm
  const wrongPointType: BoardPoint = perspective.transform(mmPoint, IDENTITY_CALIBRATION);
  void wrongPointType;

  // @ts-expect-error detect() consumes a mm impact point, not pixels
  const wrongImpactType: Promise<CameraDTO> = hitDetector.detect(pixelPoint);
  void wrongImpactType;
};

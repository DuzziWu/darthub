# Camera Vision Outline (future CV phase)

Placeholder module for the computer-vision dart detection pipeline
(`src/camera/README.md`, "Future phase" section). The stage classes and
interfaces below are outlines only: **no image processing exists in this
build, and every method raises `NotImplementedInCvPhaseError`** so a stub
result can never be mistaken for a real detection.

## Module map

| File                 | Planned responsibility                                         |
| -------------------- | -------------------------------------------------------------- |
| `Calibration.ts`     | Stage 1: camera calibration (intrinsic + extrinsic parameters) |
| `Perspective.ts`     | Stage 2: perspective correction (image px → board-plane mm)    |
| `HitDetector.ts`     | Stages 3–4: hit detection and scoring (board mm → `CameraDTO`) |
| `VisionProcessor.ts` | Pipeline wiring implementing the `ICameraProcessor` plug point |

All stages plug into the camera layer exclusively through the
`ICameraProcessor` contract (`ICameraCalibration`/`CameraDTO` types live in
`src/camera/`); no CV library is a dependency of this module and none may be
until a real implementation phase is approved.

## Planned pipeline (future phase)

### 1. **Calibration**

- Estimate **intrinsic parameters** from a reference pattern held before the
  camera: focal lengths `fx`/`fy` (px), principal point `cx`/`cy` (px), and
  radial/tangential lens-distortion coefficients; used to undistort frames.
- Solve **extrinsic parameters** from correspondences between board reference
  points (board corners, wire crossings, marker ring) and their undistorted
  image positions: the rotation/translation pose of the board plane in camera
  space.
- Fold the result into the `CameraCalibration` contract: a 3×3 row-major
  homography plus the board reference diameter in mm (`boardReferenceDiameterMm`)
  as the pixel→mm scale factor.

### 2. **Perspective correction**

- Warp the camera frame so the dart board is viewed top-down by applying the
  calibration homography.
- Map a detected image point (u, v) px through `H·(u, v, 1)ᵀ`, de-homogenise,
  then scale from the board reference frame into absolute board-plane
  millimetres relative to the board centre (matching `CameraDTO` semantics:
  `x` positive right, `y` positive above centre).

### 3. **Hit detection**

- Segment the dart (tip / flight region) in the corrected top-down frame and
  locate the tip's landing point in board-plane millimetres.
- Reject points outside the legal board area (outside the double ring) as a
  miss.

### 4. **Scoring**

- Convert the located impact point into the awarded score using the standard
  board geometry: radial rings (double / triple / outer bull / bull) and the
  20 angular wedges (20 at the top, then 1, 18, 4, 13, ... clockwise).
- Emit the throw as a `CameraDTO` (`x`, `y` in board mm, `score`,
  wall-clock `timestamp`) for the domain layers.

## Status

**Future phase.** These classes exist to pin down the API surface and the
`ICameraProcessor` conformance (see `VisionProcessor`); the runtime methods
throw `NotImplementedInCvPhaseError` until the CV implementation phase lands.

# Camera Layer

Contracts and implementations for capturing dart throws from a camera stream.

- Contract: `ICameraService` (`start` / `stop` / `captureThrow`)
- Data: `CameraDTO` (`x`, `y`, `score`, `timestamp` — millimetres relative to
  the centre of the dart board)
- Processor plug point: `ICameraProcessor` (see below)

## Current state: STUB

`SmartphoneCameraService` is a **stub**, not a computer-vision implementation.
It does NOT yet perform, run, or contain any image analysis of any kind.

What the stub does:

- Performs the real, permission-gated camera handshake through
  `navigator.mediaDevices.getUserMedia` (with typed `CameraError` /
  `CameraUnavailableError` handling).
- Resolves `captureThrow()` with **dummy `CameraDTO` data**: impact at the
  board centre (`x: 0`, `y: 0`), a fixed score of `60`, and the current
  wall-clock time.

The dummy data is safe for development and UX work only. Score/position
values produced by the stub must never be treated as real detection results.

## Future phase: computer-vision processor (roadmap)

A real CV module will replace the dummy capture path in a future phase. It
plugs into the system exclusively through the `ICameraProcessor` interface,
which is the only contract between the camera layer and the CV world.

Planned CV pipeline stages, in order:

1. **Calibration** — establish the geometry of the setup: board position,
   physical scale (millimetres per pixel), and camera/board reference points.
2. **Perspective correction** — warp the camera frame so the dart board is
   viewed top-down (homography derived from the calibration stage).
3. **Hit detection** — segment the dart (tip/flight) in the corrected frame
   and locate the impact point relative to the board.
4. **Coordinate mapping & scoring** — convert the detected impact point into
   board-plane millimetres (the `x`/`y` fields of `CameraDTO`) and derive the
   awarded `score`.

Until that work lands, no runtime code depends on CV libraries and none may
be pulled in for the stub: `ICameraProcessor` is the only contract, and the
stub satisfies it with deterministic dummy data instead of image processing.

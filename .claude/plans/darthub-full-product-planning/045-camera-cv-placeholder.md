# Task 045: Define calibration, perspective correction and hit‑detection module (future CV phase)

**Status**: completed
**Depends on**: 044
**Retry count**: 0

## Description
Create a TypeScript module outline (`src/camera/vision/`) that will later implement:
- Camera calibration (intrinsic/extrinsic parameters).
- Perspective correction to map image coordinates to board coordinates.
- Hit detection algorithm to translate detected points into dart scores.
Provide interfaces and a basic test scaffold, but do not implement the heavy image‑processing logic now.

## Context
- Files: `src/camera/vision/Calibration.ts`, `src/camera/vision/Perspective.ts`, `src/camera/vision/HitDetector.ts`.
- Export `ICameraProcessor` that the future CV implementation will satisfy.

## Requirements (Test Descriptions)
- [x] `it defines the `Calibration` class with method stubs for `calibrate()` and `apply()` (vitest 1 passed, visionScaffold.test.ts)
- [x] `it defines the `Perspective` class with method stub `transform()` (vitest 2 passed)
- [x] `it defines the `HitDetector` class with method stub `detect()` returning a `CameraDTO` (vitest 3 passed)
- [x] `it includes type tests that the interfaces compile` (scoped tsc over `tests/unit/camera/vision/tsconfig.json`: exit 0, no `error TS`; vitest 4 passed)

## Acceptance Criteria
- Module compiles without external dependencies. (scoped tsc `tests/unit/camera/vision/tsconfig.json` exit 0; no external import specifiers — grep-guard test green)
- Documentation (README) describes the intended algorithmic steps. (`src/camera/vision/README.md`, doc test green)

## Implementation Notes
- Deliverables: `src/camera/vision/{Calibration,Perspective,HitDetector,VisionProcessor,NotImplementedInCvPhaseError}.ts`, `index.ts` barrel, `README.md`; root `src/camera/index.ts` got a single additive `export * from "./vision"` block.
- All stubs raise `NotImplementedInCvPhaseError` (honest placeholder — no dummy detections that could be mistaken for results). `VisionProcessor` assembles Calibration→Perspective→HitDetector and satisfies `ICameraProcessor` (044 contract) with default wiring.
- Vision README documents the 4-stage pipeline: calibration (intrinsic/extrinsic intent) → perspective correction (homography math + scale) → hit detection (segmentation, board-area rejection) → scoring (ring/wedge geometry → `CameraDTO`).
- Tests: `tests/unit/camera/vision/visionScaffold.test.ts` (6 tests: 4 requirement tests + README doc test + no-external-deps grep guard), `visionContract.check.ts` compile probes (`@ts-expect-error` for contract violations incl. `ICameraProcessor` conformance and mm/px mixing), scoped `tsconfig.json` (extends root, 4 levels up — vision dir is one deeper than the camera one; tsc run inside the type test, 180 s timeout, same pattern as 044).
- Note: `Perspective.transform`/`HitDetector.detect` deliberately take pure geometry types (`ImagePoint`, `BoardPoint`, `DetectedDartImpact`), not pixel buffers — keeps the outline free of image payloads and browser-only types.
- Verification: `npx vitest run tests/unit/camera` → 7 files, 21/21 passed (15 pre-existing); eslint clean; prettier clean; root `tsc --noEmit` shows no camera/vision errors.

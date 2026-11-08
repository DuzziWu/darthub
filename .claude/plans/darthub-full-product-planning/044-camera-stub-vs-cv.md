# Task 044: Separate camera stub from future computer‑vision implementation

**Status**: completed
**Depends on**: 012
**Retry count**: 0

## Description
Update documentation and code to clearly label the current `SmartphoneCameraService` as a **stub**. Create a roadmap entry for the future computer‑vision module that will perform real image processing, calibration, and hit detection.

## Context
- File: `src/camera/README.md` (to be added).
- Update `src/camera/SmartphoneCameraService.ts` header comment.

## Requirements (Test Descriptions)
- [x] `it mentions that the stub returns dummy `CameraDTO` data`
- [x] `it outlines the planned CV pipeline stages (calibration, perspective correction, detection)`
- [x] `it defines an interface `ICameraProcessor` for the future implementation`

## Acceptance Criteria
- Developers understand the stub vs. real implementation distinction.
- No runtime code relies on unavailable CV libraries.

## Implementation Notes
- TDD: 3 new tests in `tests/unit/camera/cameraStubVsCv.test.ts` — RED (README missing → ENOENT; object processor → `this.processor is not a function`), then GREEN. Full `npx vitest run tests/unit/camera`: 6 files / 15 tests passed (12 pre-existing 012/013 tests stay green, plus the scoped-tsc contract compile test).
- Added `src/camera/README.md`: stub-vs-real distinction, documented dummy `CameraDTO` behaviour (`x:0, y:0, score:60`), CV roadmap in a "Future phase" section with pipeline stages calibration → perspective correction → hit detection → coordinate mapping & scoring, `ICameraProcessor` as plug point, explicit "no CV library dependency, the interface is the only contract" statement. Satisfies the "roadmap entry" requirement; `docs/` untouched (owned by another worker).
- Added `src/camera/ICameraProcessor.ts`: named interface (`processFrame` required, optional `calibrate` returning `CameraCalibration` with homography + reference diameter); barrel-exported additively from `src/camera/index.ts`.
- `SmartphoneCameraService.ts`: header comment now labels it a STUB (dummy `CameraDTO`, no image analysis, dev/UX-safe only, CV plugs via `ICameraProcessor`); constructor option widened to `CameraProcessor | ICameraProcessor` with a `toFunction` adapter so both the existing bare-function seam (012/013) and future CV objects work.
- New compile-contract file `tests/unit/camera/cameraProcessorContract.check.ts` (picked up by the scoped `tsconfig.json`, with `@ts-expect-error` contract violations) proves the barrel export and that a future CV implementation satisfies the interface; no `src/camera` existing test files modified.
- Verification: eslint on `src/camera` + `tests/unit/camera` clean; prettier applied; scoped `npx tsc --noEmit --project tests/unit/camera/tsconfig.json` clean. No runtime code depends on CV libraries. No commits made.


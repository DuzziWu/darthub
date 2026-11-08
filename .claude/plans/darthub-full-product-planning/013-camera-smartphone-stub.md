# Task 013: Implement smartphone‑camera stub (MediaDevices) and unit tests

**Status**: completed
**Depends on**: 012
**Retry count**: 0

## Description
Create a concrete implementation of `ICameraService` using the browser `navigator.mediaDevices.getUserMedia` API. The stub will simulate capture and return mock `CameraDTO` objects for now.

## Context
- Files: `src/camera/SmartphoneCameraService.ts`.
- Tests in `tests/camera/smartphone.test.ts`.

## Requirements (Test Descriptions)
- [x] `it requests video permissions via getUserMedia`
- [x] `it resolves a CameraDTO with dummy data when captureThrow is called`
- [x] `it handles permission denial gracefully`
- [x] `it conforms to ICameraService interface`
- [x] `tests run in a jsdom environment or mock MediaDevices appropriately`

## Acceptance Criteria
- Unit tests pass in a Node environment using jest‑like mocks for MediaDevices.
- No real hardware needed.

## Implementation Notes

- **Status**: completed. All 5 requirement tests implemented and passing.
- **File adaptation**: test file is `tests/unit/camera/smartphoneCamera.test.ts`
  (repo convention `tests/unit/camera/`) instead of the suggested
  `tests/camera/smartphone.test.ts`; existing 012 test files untouched and still green.
- **Environment**: jsdom is NOT installed and was NOT added (avoids a heavyweight
  devDependency). Requirement accepted via the alternative branch: `navigator.mediaDevices`
  is mocked manually with vitest mocks on the Node global (`Object.defineProperty(globalThis, "navigator", ...)`)
  in the test setup, restored in `afterEach`. Verified to run in the plain `node` Vitest
  environment (assertion: no `window` global, mock is a `vi.fn`).
- **Implementation** (`src/camera/SmartphoneCameraService.ts`):
  - `start()` calls `getUserMedia({ video: { facingMode: "environment" }, audio: false })`;
    failure (permission DeniedError / NotAllowedError, or missing
    `navigator.mediaDevices`) is wrapped into a typed
    `CameraUnavailableError` (base `CameraError`, with `cause`); the raw
    browser DOMException never escapes and the service stays un-started.
  - `stop()` rejects before start (contract) and otherwise stops all stream
    tracks, releasing hardware.
  - `captureThrow()` rejects before start; after start it resolves with
    documented STUB data `{ x: 0, y: 0, score: 60, timestamp: Date.now() }`
    (deterministic position/score, valid epoch-ms UTC timestamp) — explicitly
    marked as stub data pending CV (task 044).
  - Forward-compat for task 044: constructor accepts
    `SmartphoneCameraServiceOptions { processor?: CameraProcessor }` where
    `CameraProcessor = (stream: MediaStream) => Promise<CameraDTO>`; when
    injected, `captureThrow` delegates capture analysis to it with the active
    stream. Function shape keeps the file decoupled from CV internals.
    CV itself intentionally NOT implemented here.
  - Browser APIs accessed lazily behind runtime guards; importing the module
    in Node is safe (tests import it directly).
- **TDD evidence** (all via `npx vitest run tests/unit/camera`, Vitest 4.1.12):
  - RED confirmed for: getUserMedia request, permission denial, processor
    delegation, stop-releases-tracks (module-not-found / raw DOMException /
    stub-dto-instead-of-processor-dto / tracks-not-stopped respectively).
  - Two requirement tests passed immediately on first run and were noted:
    "resolves a CameraDTO with dummy data" (stub DTO was written alongside the
    minimal start() in step 1) and "conforms to ICameraService interface"
    (`implements ICameraService` declared in step 1 skeleton).
  - Final run: 5 test files / 12 tests passed, including all 012 contract and
    compile-time tests (`tests/unit/camera/cameraCompile.test.ts` scoped
    `tsc --noEmit` type-checks the new implementation with the existing scoped tsconfig).
  - ESLint (`eslint src/camera/SmartphoneCameraService.ts tests/unit/camera/smartphoneCamera.test.ts`) and Prettier: clean.

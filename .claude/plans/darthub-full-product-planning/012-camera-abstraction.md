# Task 012: Define camera‑interface abstraction layer (service & DTO)

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Create TypeScript interfaces for camera services, supporting multiple implementations (smartphone, USB, HDMI). Provide DTOs for captured throw data.

## Context
- Files: `src/camera/ICameraService.ts`, `src/camera/CameraDTO.ts`.
- No concrete implementation yet.

## Requirements (Test Descriptions)
- [x] `it defines ICameraService with start, stop, captureThrow methods`
- [x] `it defines CameraDTO with fields: x, y, score, timestamp`
- [x] `it compiles without implementation`
- [x] `an index.ts barrel file exports ICameraService and CameraDTO for easy imports`

## Acceptance Criteria
- Interfaces are type‑checked and used in compile‑time only.
- Documentation comments describe expected behaviour.

## Implementation Notes
- Created `src/camera/ICameraService.ts` (interface with `start(): Promise<void>`, `stop(): Promise<void>`, `captureThrow(): Promise<CameraDTO>`; full TSDoc describing lifecycle + failure behaviour; implementation‑agnostic — no smartphone‑specific surface, ready for task 044's stub vs CV split).
- Created `src/camera/CameraDTO.ts` (interface with `x`, `y`, `score`, `timestamp: number`; TSDoc documents millimetre coordinates relative to board centre and epoch‑ms UTC timestamp).
- Created `src/camera/index.ts` barrel with type‑only re-exports of both contracts.
- Test files live in `tests/unit/camera/`:
  - `iCameraService.test.ts` and `cameraDTO.test.ts` — runtime tests; because Vitest/esbuild strips type-only imports and the contracts contain no runtime code, module resolution is exercised with a dynamic `import()` (which is preserved) and structural shape is checked via typed stubs/samples.
  - `cameraCompile.test.ts` + `camera-contract.check.ts` + scoped `tsconfig.json` — compile-time contract verification via `npx tsc --noEmit --project tests/unit/camera/tsconfig.json`. The fixture proves: contracts type-check with zero runtime code (pure interfaces), an incomplete service (missing `stop`) is rejected, and a DTO missing `timestamp` is rejected (`@ts-expect-error` directives fail the check if the contract loosens). The barrel import surface is also compile-verified.
- RED evidence: interface/DTO/barrel tests failed with `Cannot find package '@/camera/...'` before implementation; the compile harness was verified to fail (exit 2) when the contract was deliberately broken (method renamed `start` → `begin`), then restored to green.
- Verification: all 4 camera tests pass (`npx vitest run tests/unit/camera`), scoped tsc exit 0, ESLint clean on `src/camera` + `tests/unit/camera`, Prettier clean, `npm run typecheck` reports no camera-related errors (remaining project-wide errors belong to other in-flight worker tasks, e.g. `src/ai/*`).
- Note: a mid-refactor edit accidentally introduced `@ts-nocheck` into `ICameraService.ts`; it was caught immediately and the file rewritten cleanly — the scoped compile test guards against this class of mistake.

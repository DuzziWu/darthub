# Task 040: Document GameEngine public API and integration guide

**Status**: completed
**Depends on**: 035
**Retry count**: 0

## Description
Create a concise API reference (README or markdown) describing how to instantiate the `GameEngine`, configure modes, out rules, and retrieve game state. Provide examples for UI integration and for the real‑time server.

## Context
- File: `src/game-engine/README.md`.

## Requirements (Test Descriptions)
- [x] `it includes TypeScript signatures for all public methods`
- [x] `it provides example code snippets for both client‑side and server‑side usage`
- [x] `it mentions the engine is UI‑agnostic and can be used in isolation`

## Acceptance Criteria
- Documentation builds without errors and is included in the repo.
- Reviewers can understand integration without digging into source code.

---

## Implementation Notes
- Deliverable: `src/game-engine/README.md` — Quick start → Configuration (`MatchConfig`) → Public API (real signatures: `constructor(mode?: DartGameMode)`, `startMatch(config: MatchConfig): MatchState`, `recordThrow(input: ThrowInput): MatchState`, `getState(): MatchState`) → JSON-safe `MatchState` snapshot shape → Error classes (`GameEngineValidationError` / `GameEngineStateError`) → Extension seam (`DartGameMode`, `NeutralScoreMode` as shipped default; 501/301 + Cricket noted as in development by parallel tasks, out rules noted as planned, not implemented) → Client-side usage (React-agnostic HUD example, no react imports) → Server-side usage (one engine per match room, `recordThrow` server-side only, broadcast `JSON.stringify(state)`) → Notes (UI-agnostic, usable in isolation, framework guard test reference).
- Subtle behaviors documented from source/035 ground truth: turn advances only after the 3rd dart (`DARTS_PER_TURN`), completed snapshots still contain the final throw (`currentPlayerId: null`, `throwsInCurrentTurn: 0`), `points` validated as integer 0..60 (triple 20), `getState()` returns a `structuredClone` snapshot safe to mutate, failed calls leave state untouched, `matchId` format `match-<timestamp>-<random>`.
- Guard test added: `tests/unit/game-engine/docs/publicApi.test.ts` (3 tests, all passing via `npx vitest run tests/unit/game-engine/docs`). It verifies the documented signatures/sections exist in the README and that every documented public name (`GameEngine`, `NeutralScoreMode`, `DARTS_PER_TURN`, both error classes) is actually exported from the `@/game-engine` barrel. Only tests for this task were run; other test trees untouched. `tsc --noEmit` shows no errors for these files; eslint clean. No commits. `docs/` directory untouched.

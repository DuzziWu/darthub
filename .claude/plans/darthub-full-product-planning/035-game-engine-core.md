# Task 035: Create core Dart game engine module

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Create a new `src/game-engine/` directory containing the core Dart game engine. The engine must be a pure TypeScript module with no dependencies on UI, Next.js, or real‑time networking. Export a clean API (e.g., `GameEngine` class) that can be instantiated by both the multiplayer server and future single‑player modes.

## Context
- Files: `src/game-engine/GameEngine.ts`, `src/game-engine/types.ts`.
- Follow Domain‑Driven Design: separate domain logic (rules, scoring) from any I/O.

## Requirements (Test Descriptions)
- [x] `it exposes methods to start a new match, record a throw, and query current state`
- [x] `it validates input parameters (player IDs, scores)`
- [x] `it is framework‑agnostic and can be imported in Node or browser environments`

## Acceptance Criteria
- [x] Engine builds without reference to React, Next.js, or Socket.IO.
- [x] Unit tests compile and pass.

## Implementation Notes
- Files created: `src/game-engine/types.ts`, `src/game-engine/GameEngine.ts`, `src/game-engine/NeutralScoreMode.ts`, `src/game-engine/index.ts` (barrel). Tests: `tests/unit/game-engine/GameEngine.test.ts`, `GameEngineValidation.test.ts`, `frameworkAgnostic.test.ts` (3 tests, all passing; eslint clean; `tsc --noEmit` reports zero errors for `game-engine` paths).
- `GameEngine` API: `startMatch(config)`, `recordThrow(input)`, `getState()` returning a JSON-safe, structured-cloned `MatchState` snapshot safe to serialize over the wire.
- Extension seam for tasks 036-038: `DartGameMode` interface (`applyThrow(mutableDraft, throwRecord)`, `isMatchComplete(state)`) injected via the constructor; `NeutralScoreMode` is the default and only mode shipped in this task. Core keeps no mode rules (no 501/bust/checkout/leg logic).
- Turn order: 3 darts per player turn (exported `DARTS_PER_TURN`), round-robin seat order; state exposes `throwsInCurrentTurn`, `throwCount`, `currentPlayerId`, `matchId`, `status`.
- Validation: `GameEngineValidationError` (empty/duplicate/blank player IDs, non-integer or out-of-range points 0-60) and `GameEngineStateError` (recordThrow before startMatch, out-of-turn player, completed match). Failed calls leave state untouched.
- Framework-agnostic guard test greps all `src/game-engine` sources at runtime for react/next/socket.io/node-only built-ins/globals (e.g. `process`, `window`, `document`); engine uses only `Date.now`, `Math.random`, `structuredClone`, available in Node 20+ and all modern browsers.
- Note: turn-advance occurs after the third dart of a turn (standard darts), so a single `recordThrow` passes play to the same player unless it is their third dart.

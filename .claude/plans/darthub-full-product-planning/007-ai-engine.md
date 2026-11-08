# Task 007: Build statistical AI opponent engine (difficulty & personality)

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Create a modular AI engine that, given a difficulty level and personality profile, generates throw scores based on predefined probability distributions.

## Context
- Files: `src/ai/engine.ts`, `src/ai/types.ts`, `src/ai/config/*.json`.
- Use service‑class pattern.

## Requirements (Test Descriptions)
- [x] `it returns higher average scores for Hard vs. Easy` — tests/unit/ai/engine.test.ts passes (seeded sim of 4500 darts, Hard mean > Easy mean + 2)
- [x] `it respects personality modifiers (aggressive, conservative)` — tests/unit/ai/engine.test.ts passes; independently re-verified with seeded run (medium, 4500 darts, seed 1337): mean aggressive 17.29 > balanced 16.90 > conservative 16.63, triple-20 rate 0.080 vs 0.038, intended-hit rate 0.131 vs 0.494
- [x] `it produces realistic checkout success rates per difficulty` — tests/unit/ai/engine.test.ts: 3-dart double-out checkout sim from leaves [32, 40, 16, 24, 50, 20] (seed 4242): easy 11.4% [0.05-0.4], medium 25.4% > easy, hard 46.1% > medium, expert 63.7% > hard and > 0.5
- [x] `it can be injected into game logic via an interface` — tests/unit/ai/engine.test.ts: game harness (`DoubleOutGame`) depends only on `AiThrowEngine`; stub passes through, `createAiOpponentProvider()` (engine.ts provider factory returning `createAiEngine`) yields a substitutable planning engine; contract types `AiOpponentOptions`/`AiOpponentProvider` added to types.ts
- [x] `it does not use external APIs` — tests/unit/ai/engine.test.ts: static scan of every .ts file under src/ai asserts all imports are relative modules or JSON config files, and that no network primitives (fetch/XMLHttpRequest/WebSocket/node:net/node:http) appear; engine uses only relative imports + static JSON config imports

## Implementation Notes
- Continued from an interrupted worker; requirements 1-2 (difficulty gap, personality modifiers) were finished and verified with an independent seeded run (medium, 4500 darts): aggressive mean 17.29 > balanced 16.90 > conservative 16.63; triple-20 rate 0.080 vs 0.038; intended-hit rate 0.131 vs 0.494.
- Checkout planning (`selectCheckoutAim`, gate at scoreRemaining <= 170; direct D(x)/BULL/BULL25 finishes, largest set-up single that leaves a legal finish, "S20" fallback) added to `src/ai/engine.ts` to satisfy double-out rules; measured 3-dart checkout rates from leaves [32, 40, 16, 24, 50, 20]: easy 11.4%, medium 25.4%, hard 46.1%, expert 63.7%.
- Injection seam added: `AiOpponentOptions` + `AiOpponentProvider` types in `src/ai/types.ts`; `createAiOpponentProvider()` factory in `src/ai/engine.ts` (returns `createAiEngine`).
- `createAiEngine` options narrowed to `AiOpponentOptions` (unchanged call shape, no behavioral change).
- Scoped test command used throughout: `npx vitest run tests/unit/ai` (5/5 passing).

## Acceptance Criteria
- Unit tests confirm probability distributions produce expected means within tolerance.
- Engine is configurable via JSON files.
- No external dependencies beyond Node standard libs.

# Task 008: Create AI difficulty configuration and test suite

**Status**: completed
**Depends on**: 007
**Retry count**: 0

## Description
Define JSON configuration files for Easy, Medium, Hard, Expert difficulty levels and write Vitest tests to validate the configured probabilities.

## Context
- Files: `src/ai/config/easy.json`, `src/ai/config/medium.json`, etc.
- Tests in `tests/ai/engine.test.ts`.

## Requirements (Test Descriptions)
- [x] `it loads Easy config and verifies mean score ≈ 30` (RED: 39.31 → out of band; GREEN: tuned `easy.json` sigma to 36/38/36/40 + T20 weight share 0.25→0.09; measured 34.45/turn, seeds [501, 20250], 2000 turns each, within 30±5; engine core untouched)
- [x] `it loads Hard config and verifies mean score ≈ 70` (passed immediately — hard.json from 007 already measures 70.62/turn with seeds [501, 20250], 2000 turns each; no config change made; Hard kept untouched so Medium sits ~51 and Expert ~96 above it)
- [x] `it ensures checkout success probability matches spec per difficulty` (added `checkoutSuccessRate` to all four configs + `DifficultyConfig` type / `loadDifficultyConfig` runtime validator in `src/ai/difficultyConfig.ts`; measured seed 4242, leaves 16/20/24/32/40/50, 300 visits each: easy 0.096, medium 0.254, hard 0.461, expert 0.637; config spec values 0.10/0.25/0.46/0.64 all within ±0.05 and monotonically increasing)
- [x] `it validates that all required fields exist in each config file` (validator implemented during the previous requirement's GREEN, so these tests passed on first run — noted per TDD rules; `tests/unit/ai/difficultyConfig.test.ts` additionally proves the negative paths: every required top-level field deleted → rejected, five mutated-value cases → rejected, unknown level → rejected)

## Acceptance Criteria
- All tests pass with a tolerance of +/-5 points.
- Config files are validated against a TypeScript type.

## Implementation Notes
- Files added: `src/ai/difficultyConfig.ts` (registry + `loadDifficultyConfig` +
  `validateDifficultyConfig` with hand-rolled runtime guards, no new deps),
  `src/ai/config/checkoutSuccessRate` field added to all four tier JSONs,
  `DifficultyConfig` type exported additively from `src/ai/types.ts`.
- Files added (tests): `tests/unit/ai/difficultyMeans.test.ts` (turn-mean +
  checkout-spec profile, deterministic seeds), `tests/unit/ai/difficultyConfig.test.ts`
  (required-fields + negative validation paths). Existing `engine.test.ts` untouched.
- Mean-score methodology: mean score per **3-dart turn** (spec target per
  environment guidance), simulated with `scoreRemaining` far above checkout range
  (pure scoring) so checkout planning does not distort the measurement; seeds
  [501, 20250], 2000 turns per seed, ±5 tolerance. Final measured: easy 34.45,
  hard 70.62 (medium 51.41 and expert 95.79 sit between them, untouched).
- Tuning note for Easy: the T20-aim share was not the lever (with sigma ≈30 a
  T20 aim still resolves mostly as the 20 single) — widening the Gaussian
  scatter (sigma) is what moves the mean down; single/triple sigma 30→36,
  bull 34→40, double 36→38. This shifts the easy checkout rate from ~0.114 to
  0.096; the configured spec value (0.10, ±0.05 band) still brackets it, and
  007's engine.test.ts bands still pass.
- Checkout spec methodology (matches 007's harness): leaves 16/20/24/32/40/50,
  300 visits per leaf, engine seed `4242 + leave*1000 + visit`, strict
  double-out (singles reaching zero count as bust). Measured: easy 0.0961,
  medium 0.2539, hard 0.4606, expert 0.6367; configured 0.10/0.25/0.46/0.64.
- Validation: JSON files statically imported (bundler-resolved) and verified at
  runtime against `DifficultyConfig` via hand-rolled guards (required fields,
  positive finite sigma, populated valid aim-weight labels, rate in [0,1],
  difficulty label consistency). Mutation tests prove rejection on missing and
  corrupt fields; unknown levels are rejected.
- Pre-existing 007 type errors fixed (type-only, no behavior change, ai suite
  stayed green): `src/ai/dartboard.ts` `Aim.accuracyClass` now includes
  "outerBull" directly (the old `Extract<AccuracyClass, …>` silently dropped it),
  and `src/ai/engine.ts` now imports `Rng` from `./types` (rng.ts never re-exported it).
- Verification: `npx vitest run tests/unit/ai` → 3 files / 13 tests passed;
  `tsc --noEmit` filtered to ai paths → 0 errors; `eslint src/ai tests/unit/ai`
  → clean; prettier clean on all task-touched files.

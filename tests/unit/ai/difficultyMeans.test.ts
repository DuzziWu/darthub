import { describe, expect, it } from "vitest";
import { createAiEngine } from "@/ai/engine";
import { loadDifficultyConfig } from "@/ai/difficultyConfig";
import type { AiThrowDecision, DifficultyLevel } from "@/ai/types";

/** Seeds and sample size used for the reproducible turn-mean measurements. */
const MEAN_TEST_SEEDS = [501, 20250] as const;
const TURNS_PER_SEED = 2000;

/** Tolerance (in points per 3-dart turn) applied to the spec target means. */
const MEAN_TOLERANCE = 5;

/**
 * Simulates pure scoring turns: `scoreRemaining` stays far above the checkout
 * range, so every turn of three darts reflects the difficulty's scoring
 * configuration without any checkout planning affecting the outcome.
 */
function simulateTurnMean(difficulty: DifficultyLevel, seed: number, turns: number): number {
  const engine = createAiEngine({ difficulty, seed });
  let total = 0;
  for (let turn = 0; turn < turns; turn++) {
    for (let dartIndex = 0; dartIndex < 3; dartIndex++) {
      const decision = engine.throwDart({
        scoreRemaining: 9901,
        dartsRemainingInTurn: 3 - dartIndex,
      });
      total += decision.score;
    }
  }
  return total / turns;
}

/** Mean across the fixed measurement seeds (deterministic and reproducible). */
function meanAcrossSeeds(difficulty: DifficultyLevel): number {
  const perSeed = MEAN_TEST_SEEDS.map((seed) => simulateTurnMean(difficulty, seed, TURNS_PER_SEED));
  return perSeed.reduce((sum, mean) => sum + mean, 0) / perSeed.length;
}

describe("AI difficulty scoring means", () => {
  it("loads Easy config and verifies mean score ≈ 30", () => {
    const mean = meanAcrossSeeds("easy");
    expect(
      mean,
      `Easy 3-dart turn mean (seeds ${MEAN_TEST_SEEDS.join(", ")}, ${TURNS_PER_SEED} turns each: ${MEAN_TOLERANCE} point tolerance)`,
    ).toBeGreaterThanOrEqual(30 - MEAN_TOLERANCE);
    expect(mean).toBeLessThanOrEqual(30 + MEAN_TOLERANCE);
  });

  it("loads Hard config and verifies mean score ≈ 70", () => {
    const mean = meanAcrossSeeds("hard");
    expect(
      mean,
      `Hard 3-dart turn mean (seeds ${MEAN_TEST_SEEDS.join(", ")}, ${TURNS_PER_SEED} turns each: ${MEAN_TOLERANCE} point tolerance)`,
    ).toBeGreaterThanOrEqual(70 - MEAN_TOLERANCE);
    expect(mean).toBeLessThanOrEqual(70 + MEAN_TOLERANCE);
  });
});

describe("AI difficulty checkout profile", () => {
  const CHECKOUT_TOLERANCE = 0.05;
  const LEAVES = [32, 40, 16, 24, 50, 20] as const;
  const VISITS_PER_LEAVE = 300;
  const CHECKOUT_SEED = 4242;

  /** Finishes are only legal on a double ring or either bull. */
  function isLegalFinish(decision: AiThrowDecision): boolean {
    return (
      decision.ring === "double" || decision.ring === "innerBull" || decision.ring === "outerBull"
    );
  }

  /**
   * Simulates 3-dart checkout visits from common finishing leaves under strict
   * double-out rules and returns the fraction of visits won.
   */
  function measuredCheckoutRate(difficulty: DifficultyLevel): number {
    let attempts = 0;
    let successes = 0;
    for (const leave of LEAVES) {
      for (let visit = 0; visit < VISITS_PER_LEAVE; visit++) {
        const engine = createAiEngine({
          difficulty,
          seed: CHECKOUT_SEED + leave * 1000 + visit,
        });
        attempts++;
        let remaining = leave;
        let won = false;
        for (let dartIndex = 0; dartIndex < 3 && remaining > 0; dartIndex++) {
          const decision = engine.throwDart({
            scoreRemaining: remaining,
            dartsRemainingInTurn: 3 - dartIndex,
          });
          remaining -= decision.score;
          if (remaining === 0) {
            won = isLegalFinish(decision);
            break;
          }
          if (remaining < 0) {
            break;
          }
        }
        if (won) {
          successes++;
        }
      }
    }
    return successes / attempts;
  }

  it("ensures checkout success probability matches spec per difficulty", () => {
    const rates: Record<DifficultyLevel, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    };
    for (const level of ["easy", "medium", "hard", "expert"] as const) {
      const config = loadDifficultyConfig(level);
      const measured = measuredCheckoutRate(level);
      rates[level] = measured;
      expect(
        Math.abs(measured - config.checkoutSuccessRate),
        `${level} measured checkout rate ${measured.toFixed(3)} vs configured ${config.checkoutSuccessRate} (leaves ${LEAVES.join("/")}, ${VISITS_PER_LEAVE} visits each, seed ${CHECKOUT_SEED}, ±${CHECKOUT_TOLERANCE})`,
      ).toBeLessThanOrEqual(CHECKOUT_TOLERANCE);
    }
    // Spec: checkout reliability increases monotonically with difficulty.
    expect(rates.easy).toBeLessThan(rates.medium);
    expect(rates.medium).toBeLessThan(rates.hard);
    expect(rates.hard).toBeLessThan(rates.expert);
  });
});

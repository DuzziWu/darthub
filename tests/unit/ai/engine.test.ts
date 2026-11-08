import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAiEngine, createAiOpponentProvider } from "@/ai/engine";
import type { AiThrowDecision, AiThrowEngine, DifficultyLevel } from "@/ai/types";

/**
 * Simulates pure scoring darts: the score never enters checkout range, so the
 * measured average reflects the pure scoring-probability distribution of the
 * difficulty's aim configuration.
 */
function simulateScoringDarts(
  difficulty: "easy" | "medium" | "hard",
  options: { darts?: number; seed?: number; personality?: string } = {},
): { meanScore: number; intendedHitRate: number; tripleHitRate: number } {
  const engine = createAiEngine({
    difficulty,
    seed: options.seed ?? 1337,
    personality: options.personality as "balanced" | undefined,
  });
  const darts = options.darts ?? 4500;
  let total = 0;
  let intendedHits = 0;
  let tripleHits = 0;
  for (let i = 0; i < darts; i++) {
    const decision = engine.throwDart({
      scoreRemaining: 501,
      dartsRemainingInTurn: 3 - (i % 3),
    });
    total += decision.score;
    if (decision.hitIntendedTarget) {
      intendedHits++;
    }
    if (decision.ring === "triple" && decision.sector === 20) {
      tripleHits++;
    }
  }
  return {
    meanScore: total / darts,
    intendedHitRate: intendedHits / darts,
    tripleHitRate: tripleHits / darts,
  };
}

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
function checkoutSuccessRate(difficulty: DifficultyLevel, seed = 4242): number {
  const leaves = [32, 40, 16, 24, 50, 20];
  const visitsPerLeave = 300;
  let attempts = 0;
  let successes = 0;
  for (const leave of leaves) {
    for (let visit = 0; visit < visitsPerLeave; visit++) {
      const engine = createAiEngine({
        difficulty,
        seed: seed + leave * 1000 + visit,
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

/** Recursively lists .ts source files under a directory relative to the repo root. */
function listSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const relative = join(dir, entry);
    if (statSync(join(process.cwd(), relative)).isDirectory()) {
      listSourceFiles(relative, files);
    } else if (entry.endsWith(".ts")) {
      files.push(relative);
    }
  }
  return files;
}

describe("AI engine", () => {
  it("does not use external APIs", () => {
    for (const file of listSourceFiles("src/ai")) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const modules = [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map(
        (match) => match[1] ?? "",
      );
      for (const moduleName of modules) {
        const isRelative = moduleName.startsWith(".");
        const isJsonConfig = moduleName.endsWith(".json");
        expect(
          isRelative || isJsonConfig,
          `${file} must only use relative or JSON config imports, found: ${moduleName}`,
        ).toBe(true);
      }
      // No network primitives anywhere in the engine sources.
      expect(/fetch|XMLHttpRequest|WebSocket|node:net|node:http/.test(source)).toBe(false);
    }
  });

  it("can be injected into game logic via an interface", () => {
    // Game logic depends only on the interface contract, never on the
    // statistical implementation.
    class DoubleOutGame {
      constructor(private readonly opponent: AiThrowEngine) {}
      asksOpponentForThrow(scoreRemaining: number): AiThrowDecision {
        return this.opponent.throwDart({
          scoreRemaining,
          dartsRemainingInTurn: 1,
        });
      }
    }

    const stub: AiThrowEngine = {
      throwDart: () => ({
        ring: "double",
        sector: 16,
        score: 32,
        aimLabel: "D16",
        hitIntendedTarget: true,
      }),
    };
    expect(new DoubleOutGame(stub).asksOpponentForThrow(32).score).toBe(32);

    const provider = createAiOpponentProvider();
    const engine: AiThrowEngine = provider({ difficulty: "hard", seed: 7 });
    const decision = new DoubleOutGame(engine).asksOpponentForThrow(32);
    // The real engine is substitutable for the stub and plans checkouts.
    expect(decision.aimLabel).toBe("D16");
    expect(typeof decision.score).toBe("number");
    expect(decision.ring).toBeDefined();
  });

  it("produces realistic checkout success rates per difficulty", () => {
    // Common 3-dart finishing leaves; every checkout requires a double (or
    // bull) finish — singles reaching zero count as a bust.
    const rates = {
      easy: checkoutSuccessRate("easy"),
      medium: checkoutSuccessRate("medium"),
      hard: checkoutSuccessRate("hard"),
      expert: checkoutSuccessRate("expert"),
    };

    expect(rates.easy).toBeGreaterThan(0.05);
    expect(rates.easy).toBeLessThan(0.4);
    expect(rates.medium).toBeGreaterThan(rates.easy);
    expect(rates.hard).toBeGreaterThan(rates.medium);
    expect(rates.expert).toBeGreaterThan(rates.hard);
    expect(rates.expert).toBeGreaterThan(0.5);
  });

  it("returns higher average scores for Hard vs. Easy", () => {
    const easyMean = simulateScoringDarts("easy").meanScore;
    const hardMean = simulateScoringDarts("hard").meanScore;

    // Means should be in a realistic casual-to-strong player band (per dart).
    expect(easyMean).toBeGreaterThan(5);
    expect(easyMean).toBeLessThan(20);
    expect(hardMean).toBeGreaterThan(easyMean + 2);
  });

  it("respects personality modifiers (aggressive, conservative)", () => {
    const aggressive = simulateScoringDarts("medium", { personality: "aggressive" });
    const balanced = simulateScoringDarts("medium", { personality: "balanced" });
    const conservative = simulateScoringDarts("medium", { personality: "conservative" });

    // Aggressive hunts the trebles and scores more; conservative plays the
    // safe single bed: lower scoring but a more reliable intended-hit rate.
    expect(aggressive.meanScore).toBeGreaterThan(balanced.meanScore);
    expect(balanced.meanScore).toBeGreaterThan(conservative.meanScore);
    expect(aggressive.tripleHitRate).toBeGreaterThan(conservative.tripleHitRate);
    expect(conservative.intendedHitRate).toBeGreaterThan(aggressive.intendedHitRate);
  });
});

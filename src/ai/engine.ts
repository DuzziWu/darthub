import type {
  AiDifficultyConfig,
  AiOpponentOptions,
  AiOpponentProvider,
  AiPersonalityConfig,
  AiThrowDecision,
  AiThrowEngine,
  AiThrowRequest,
  DifficultyLevel,
  PersonalityId,
  Rng,
} from "./types";
import hardConfig from "./config/hard.json";
import expertConfig from "./config/expert.json";
import easyConfig from "./config/easy.json";
import mediumConfig from "./config/medium.json";
import personalityConfig from "./config/personalities.json";
import { isIntendedHit, parseAimLabel, resolveHit, sigmaClassFor } from "./dartboard";
import { gaussianPair, mulberry32 } from "./rng";

/**
 * Loads the difficulty tiers and personality profiles from the JSON files
 * under `src/ai/config/`. Bundler-resolved static imports keep the engine
 * free of filesystem and network dependencies at runtime.
 */
const DIFFICULTY_CONFIGS = {
  easy: easyConfig as unknown as AiDifficultyConfig,
  medium: mediumConfig as unknown as AiDifficultyConfig,
  hard: hardConfig as unknown as AiDifficultyConfig,
  expert: expertConfig as unknown as AiDifficultyConfig,
} as const satisfies Record<DifficultyLevel, unknown>;

const PERSONALITY_CONFIGS = personalityConfig as unknown as Record<
  PersonalityId,
  AiPersonalityConfig
>;

const DEFAULT_PERSONALITY: PersonalityId = "balanced";
const DEFAULT_RNG_SEED = 0x501;

/**
 * Highest score that can be finished from a single throw (T20 + T20 + Bull is
 * planned dart-by-dart, so the gate is simply the maximum checkout start).
 */
const CHECKOUT_RANGE = 170;

/**
 * Checkout planning under strict double-out rules. Direct finishes are chosen
 * whenever the remaining score is one dart away; otherwise the best set-up
 * single is picked — the largest single that leaves a legal finishing score.
 */
export function selectCheckoutAim(remaining: number): string {
  if (remaining === 50) {
    return "BULL";
  }
  if (remaining === 25) {
    return "BULL25";
  }
  if (remaining >= 2 && remaining <= 40 && remaining % 2 === 0) {
    return `D${remaining / 2}`;
  }
  for (let single = 20; single >= 1; single--) {
    const after = remaining - single;
    if (isFinishingScore(after)) {
      return `S${single}`;
    }
  }
  // No single leaves a finish (e.g. odd scores above 60): keep scoring safely.
  return "S20";
}

function isFinishingScore(score: number): boolean {
  return score === 50 || score === 25 || (score >= 2 && score <= 40 && score % 2 === 0);
}

/**
 * Service class: statistical dart-throwing AI. Aims at a target sampled from
 * the configured aim-weight distribution, samples a Gaussian aim error
 * (difficulty sigma x personality multiplier), and resolves the landing point
 * against real dartboard geometry.
 */
export class StatisticalAiEngine implements AiThrowEngine {
  private readonly rng: Rng;

  constructor(
    private readonly difficulty: AiDifficultyConfig,
    private readonly personality: AiPersonalityConfig,
    rngSeed: number,
  ) {
    this.rng = mulberry32(rngSeed);
  }

  throwDart(request: AiThrowRequest): AiThrowDecision {
    const aim = parseAimLabel(this.selectAim(request));
    const sigma = this.difficulty.sigma[sigmaClassFor(aim)] * this.personality.sigmaMultiplier;
    const [errorDx, errorDy] = gaussianPair(this.rng);
    const hit = resolveHit(aim.point, errorDx * sigma, errorDy * sigma);
    return {
      ring: hit.ring,
      sector: hit.sector,
      score: hit.score,
      aimLabel: aim.label,
      hitIntendedTarget: isIntendedHit(hit, aim),
    };
  }

  /** Target selection: checkout planning inside finish range, scoring otherwise. */
  private selectAim(request: AiThrowRequest): string {
    if (request.scoreRemaining <= CHECKOUT_RANGE) {
      return selectCheckoutAim(request.scoreRemaining);
    }
    return this.selectScoringAim();
  }

  private selectScoringAim(): string {
    const bias = this.personality.aimBias;
    const weighted = Object.entries(this.difficulty.aimWeights.scoring).map(([label, weight]) => ({
      label,
      weight: weight * (bias[label] ?? 1),
    }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng() * total;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.label;
      }
    }
    return weighted[weighted.length - 1]?.label ?? "S20";
  }
}

/** Factory loading the JSON configuration for the requested setup. */
export function createAiEngine(options: AiOpponentOptions): StatisticalAiEngine {
  const difficulty = DIFFICULTY_CONFIGS[options.difficulty];
  if (!difficulty) {
    throw new Error(`Unknown AI difficulty: ${options.difficulty}`);
  }
  const personalityId = options.personality ?? DEFAULT_PERSONALITY;
  const personality = PERSONALITY_CONFIGS[personalityId];
  if (!personality) {
    throw new Error(`Unknown AI personality: ${personalityId}`);
  }
  const seed = options.seed ?? DEFAULT_RNG_SEED;
  return new StatisticalAiEngine(difficulty, personality, seed);
}

/** Provider factory handed to game logic for dependency injection. */
export const createAiOpponentProvider = (): AiOpponentProvider => createAiEngine;

/**
 * Domain types for the statistical AI opponent engine.
 *
 * The engine is statistics-first: it aims at a dartboard segment, samples a
 * 2-dimensional aim error from a configurable (difficulty + personality) Gaussian
 * distribution, and resolves the landing point against real dartboard geometry.
 */

export type DifficultyLevel = "easy" | "medium" | "hard" | "expert";

export type PersonalityId = "balanced" | "aggressive" | "conservative";

/** Aim accuracy classes, each with its own standard deviation (aim spread). */
export type AccuracyClass = "single" | "double" | "triple" | "bull";

/** Gaussian aim spread (sigma) in millimetres per accuracy class. */
export interface SigmaConfig {
  single: number;
  double: number;
  triple: number;
  bull: number;
}

/** Relative weights of the targets the AI aims at while scoring. */
export interface AimWeights {
  scoring: Record<string, number>;
}

export interface AiDifficultyConfig {
  difficulty: DifficultyLevel;
  description: string;
  sigma: SigmaConfig;
  aimWeights: AimWeights;
}

/**
 * Full difficulty configuration validated at load time, extended with the
 * spec-level checkout metadata the difficulty tiers are measured against.
 */
export interface DifficultyConfig extends AiDifficultyConfig {
  /**
   * Spec target for the measured 3-dart checkout success rate on common
   * finishing leaves (16, 20, 24, 32, 40, 50) under strict double-out rules.
   */
  checkoutSuccessRate: number;
}

/**
 * Personality modifiers applied on top of a difficulty configuration:
 * `sigmaMultiplier` scales the aim spread, `aimBias` re-weights scoring targets.
 */
export interface AiPersonalityConfig {
  id: PersonalityId;
  label: string;
  description: string;
  sigmaMultiplier: number;
  aimBias: Record<string, number>;
}

/** Which scoring ring a dart landed in. */
export type RingType =
  "single" | "double" | "triple" | "outerBull" | "innerBull" | "noScore" | "offBoard";

/** The resolved outcome of one dart. */
export interface DartResult {
  ring: RingType;
  /** Sector number 1-20, or 0 for bulls / misses. */
  sector: number;
  /** Points scored by this dart (0 on a miss). */
  score: number;
}

/** The game state the engine needs to decide a throw (server authority). */
export interface AiThrowRequest {
  scoreRemaining: number;
  dartsRemainingInTurn: number;
}

/** A decided throw, extended with the intended target and hit diagnosis. */
export interface AiThrowDecision extends DartResult {
  /** Canonical label of the intended target, e.g. "T20", "D16", "BULL". */
  aimLabel: string;
  /** True when the dart landed exactly on the intended target. */
  hitIntendedTarget: boolean;
}

/**
 * Contract that game logic depends on; concrete engines are injected via this
 * interface so game code never depends on the statistical implementation.
 */
export interface AiThrowEngine {
  throwDart(request: AiThrowRequest): AiThrowDecision;
}

/** Options used to locate/configure an AI opponent instance. */
export interface AiOpponentOptions {
  difficulty: DifficultyLevel;
  personality?: PersonalityId;
  seed?: number;
}

/**
 * Injection seam for game logic: a provider factory that resolves an
 * `AiThrowEngine` for a requested setup. Callers depend on this function type
 * and the engine interface only, so alternative implementations (scripted,
 * camera-driven, replay) can be swapped in without touching game code.
 */
export type AiOpponentProvider = (options: AiOpponentOptions) => AiThrowEngine;

/** Deterministic pseudo-random number generator producing values in [0, 1). */
export type Rng = () => number;

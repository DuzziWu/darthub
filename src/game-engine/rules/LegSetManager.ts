import { GameEngineValidationError } from "@/game-engine/types";

/**
 * Configuration of the leg/set structure of a match (task 038). Both
 * values are "best of N" sizes: winning a round requires MORE than half
 * of N wins. An omitted value means the round is a single win ("best of
 * one"): one leg wins the set, one set wins the match.
 */
export interface LegSetConfig {
  /** Best of N legs per set, e.g. 5 ("first to 3"). */
  readonly legs?: number;
  /** Best of N sets per match, e.g. 3 ("first to 2"). */
  readonly sets?: number;
}

/**
 * JSON-safe leg/set bookkeeping, persisted inside
 * {@link MatchState.modeData} by the x01 mode.
 */
export interface LegSetProgress {
  /** Legs won per player within the currently played set. */
  readonly legsWon: Record<string, number>;
  /** Sets won per player within the match. */
  readonly setsWon: Record<string, number>;
  /** ID of the player who has won the match, or null while playing. */
  readonly matchWinnerId: string | null;
}

/** Result of recording a leg winner. */
export interface LegSetOutcome {
  /** Updated progress to persist (also covers completed sets/matches). */
  readonly progress: LegSetProgress;
  /** Player who won the leg. */
  readonly legWinnerId: string;
  /** True when this leg also completed a set (progress.legsWon is reset). */
  readonly setCompleted: boolean;
  /** Winner of the completed set, or null while the set is undecided. */
  readonly setWinnerId: string | null;
  /** True when this leg also decided the whole match. */
  readonly matchCompleted: boolean;
}

/** Wins needed to take a best-of-N round; undefined counts as best of 1. */
function winsNeeded(bestOf: number | undefined): number {
  if (bestOf === undefined) {
    return 1;
  }
  return Math.floor(bestOf / 2) + 1;
}

function validateBestOf(value: number | undefined, label: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new GameEngineValidationError(`${label} must be a positive integer`);
  }
}

/**
 * Pure, JSON-safe tracker for best-of-N legs and best-of-M sets
 * (task 038). The mode owns the persistence; this class only contains
 * the aggregation rules.
 */
export class LegSetManager {
  private readonly legsRequired: number;
  private readonly setsRequired: number;

  constructor(config: LegSetConfig = {}) {
    validateBestOf(config.legs, "legs");
    validateBestOf(config.sets, "sets");
    this.legsRequired = winsNeeded(config.legs);
    this.setsRequired = winsNeeded(config.sets);
  }

  /** Returns the progress of a freshly started match. */
  initialProgress(): LegSetProgress {
    return { legsWon: {}, setsWon: {}, matchWinnerId: null };
  }

  /**
   * Records `legWinnerId` as the winner of one leg and advances legs,
   * sets and the match per the configured best-of sizes.
   */
  recordLegWinner(progress: LegSetProgress, legWinnerId: string): LegSetOutcome {
    const legsWon: Record<string, number> = {
      ...progress.legsWon,
      [legWinnerId]: (progress.legsWon[legWinnerId] ?? 0) + 1,
    };
    let setsWon = progress.setsWon;
    let setWinnerId: string | null = null;
    let matchWinnerId = progress.matchWinnerId;

    if (legsWon[legWinnerId]! >= this.legsRequired) {
      setWinnerId = legWinnerId;
      setsWon = { ...setsWon, [legWinnerId]: (setsWon[legWinnerId] ?? 0) + 1 };
      if (setsWon[legWinnerId]! >= this.setsRequired) {
        matchWinnerId = legWinnerId;
      }
    }

    return {
      progress: {
        // A completed set starts a fresh set with clean legs.
        legsWon: setWinnerId === null ? legsWon : {},
        setsWon,
        matchWinnerId,
      },
      legWinnerId,
      setCompleted: setWinnerId !== null,
      setWinnerId,
      matchCompleted: matchWinnerId !== null && progress.matchWinnerId === null,
    };
  }
}

/** Mode key under which {@link LegSetProgress} is stored in modeData. */
export const LEG_SET_MODE_DATA_KEY = "legSet";

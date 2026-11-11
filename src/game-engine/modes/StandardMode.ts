import {
  GameEngineBustError,
  GameEngineStateError,
  GameEngineValidationError,
  type DartGameMode,
  type MatchConfig,
  type MatchModeData,
  type MatchState,
  type MutableMatchState,
  type OutRuleId,
  type ThrowRecord,
} from "@/game-engine/types";
import { getOutRule, type OutRule } from "@/game-engine/rules/OutRules";
import {
  LegSetManager,
  LEG_SET_MODE_DATA_KEY,
  type LegSetProgress,
} from "@/game-engine/rules/LegSetManager";

/** Configuration accepted by {@link StandardMode}. */
export interface StandardModeConfig {
  /** Score every player starts with, e.g. 501 or 301. */
  readonly startScore: number;
  /** Checkout rule of the match. Defaults to "straight" (any finish wins). */
  readonly outRule?: OutRuleId;
  /** Best of N legs per set (e.g. 5 means "first to 3 legs"). */
  readonly legs?: number;
  /** Best of N sets per match (e.g. 3 means "first to 2 sets"). */
  readonly sets?: number;
}

/**
 * Classic "x01" darts mode: every player starts at {@link startScore}
 * points and each throw is subtracted from their remaining score. The
 * first player to land on exactly zero wins the leg; how a leg may be
 * finished (and what counts as a bust) is decided by the selected
 * {@link OutRuleId}, and legs/sets are aggregated by the configured
 * best-of sizes via {@link LegSetManager}.
 */
export class StandardMode implements DartGameMode {
  readonly id: string;
  private readonly startScore: number;
  private readonly outRule: OutRule;
  private readonly legSetManager: LegSetManager | null;
  private readonly explicitOutRule: OutRule | null;
  /** Values set via MatchConfig; explicit constructor options win. */
  private configuredOutRule: OutRule | null = null;
  private configuredLegSetManager: LegSetManager | null = null;

  constructor(config: StandardModeConfig) {
    validateStartScore(config.startScore);
    this.startScore = config.startScore;
    this.outRule = getOutRule(config.outRule ?? "straight");
    this.explicitOutRule = config.outRule === undefined ? null : this.outRule;
    // Without explicit leg/set sizes the match is one single leg.
    this.legSetManager =
      config.legs === undefined && config.sets === undefined
        ? null
        : new LegSetManager({ legs: config.legs, sets: config.sets });
    this.id = `x01-${config.startScore}${describeOutRule(this.outRule.id)}${describeMatchFormat(
      config.legs,
      config.sets,
    )}`;
  }

  /** Picks up optional outRule/legs/sets from startMatch configuration. */
  configure(config: MatchConfig): void {
    this.configuredOutRule = config.outRule === undefined ? null : getOutRule(config.outRule);
    if (config.legs === undefined && config.sets === undefined) {
      this.configuredLegSetManager = null;
    } else {
      this.configuredLegSetManager = new LegSetManager({
        legs: config.legs,
        sets: config.sets,
      });
    }
  }

  /** The out rule in effect: explicit constructor option, then MatchConfig. */
  private get activeOutRule(): OutRule {
    return this.explicitOutRule ?? this.configuredOutRule ?? this.outRule;
  }

  /** The leg/set structure in effect under the same precedence. */
  private get activeLegSetManager(): LegSetManager | null {
    return this.legSetManager ?? this.configuredLegSetManager;
  }

  initializeMatch(draft: MutableMatchState): void {
    for (const player of draft.players) {
      player.totalPoints = this.startScore;
    }
  }

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void {
    const player = draft.players.find((candidate) => candidate.id === throwRecord.playerId);
    if (!player) {
      throw new GameEngineStateError(`Player "${throwRecord.playerId}" is not in this match`);
    }
    const remaining = this.resolveRemaining(
      player.totalPoints,
      throwRecord.points,
      throwRecord.segment,
    );
    if (remaining === null) {
      throw new GameEngineBustError(
        `Bust: ${throwRecord.points} points is not a valid result for player "${player.id}" ` +
          `under the ${this.activeOutRule.id} out rule`,
      );
    }
    player.totalPoints = remaining;
    if (remaining === 0) {
      this.handleLegCompleted(draft, player.id);
    }
  }

  isMatchComplete(state: MatchState): boolean {
    if (this.activeLegSetManager !== null) {
      return this.readLegSetProgress(state.modeData)?.matchWinnerId != null;
    }
    return state.players.some((player) => player.totalPoints === 0);
  }

  /**
   * Describes the result of the match — the legs and sets won and the
   * player standing at zero — so the engine can tell that a correction
   * changed the outcome rather than only a score.
   */
  resultSignature(state: MatchState): string {
    const progress = this.readLegSetProgress(state.modeData);
    const legs = progress ? formatCounts(progress.legsWon) : "";
    const sets = progress ? formatCounts(progress.setsWon) : "";
    const winners = state.players
      .filter((player) => player.totalPoints === 0)
      .map((player) => player.id)
      .sort()
      .join(",");
    return `${legs}|${sets}|${progress?.matchWinnerId ?? ""}|${winners}`;
  }

  /** Records a leg win, advances sets and starts a fresh leg when needed. */
  private handleLegCompleted(draft: MutableMatchState, winnerId: string): void {
    const manager = this.activeLegSetManager;
    if (manager === null) {
      return;
    }
    const previous = this.readLegSetProgress(draft.modeData) ?? manager.initialProgress();
    const outcome = manager.recordLegWinner(previous, winnerId);
    draft.modeData = { ...draft.modeData, [LEG_SET_MODE_DATA_KEY]: outcome.progress };

    if (outcome.matchCompleted) {
      // The match is over: the winner stays on 0, others keep their score.
      return;
    }
    // A fresh leg starts from the original start score for everyone.
    for (const player of draft.players) {
      player.totalPoints = this.startScore;
    }
  }

  private readLegSetProgress(modeData: MatchModeData | undefined): LegSetProgress | undefined {
    return (modeData?.[LEG_SET_MODE_DATA_KEY] as LegSetProgress | undefined) ?? undefined;
  }

  /**
   * Extension point for checkout rules (task 038): maps the current
   * remaining score and the just-thrown dart to the new remaining score,
   * or returns null when the throw is a bust under the selected out
   * rule (overshoot below zero, invalid checkout segment, stranded on 1).
   */
  protected resolveRemaining(
    remaining: number,
    points: number,
    segment?: ThrowRecord["segment"],
  ): number | null {
    const activeOutRule = this.activeOutRule;
    const next = remaining - points;
    if (next < 0) {
      return null;
    }
    if (next === 0 && !activeOutRule.isCheckout(segment, points)) {
      return null;
    }
    if (activeOutRule.isStrandedBust(next)) {
      return null;
    }
    return next;
  }
}

/** Renders the non-default out rules as a mode-id suffix. */
function describeOutRule(outRuleId: OutRuleId): string {
  return outRuleId === "straight" ? "" : `-${outRuleId}-out`;
}

/** Renders the configured best-of leg/set sizes as a mode-id suffix. */
function describeMatchFormat(legs: number | undefined, sets: number | undefined): string {
  if (legs === undefined && sets === undefined) {
    return "";
  }
  const legsPart = legs === undefined ? "1" : `bo${legs}`;
  const setsPart = sets === undefined ? "1" : `bo${sets}`;
  return `-legs${legsPart}-sets${setsPart}`;
}

/**
 * Convenience wrapper: classic "501" game.
 *
 * The x01 wrappers default to double out — the rule the Game Center
 * advertises and the one a standard 501 match is played under. The mode's
 * own default stays "straight"; only these two wrappers pin "double".
 */
export class Standard501Mode extends StandardMode {
  constructor() {
    super({ startScore: 501, outRule: "double" });
  }
}

/** Convenience wrapper: classic "301" game, played under double out. */
export class Standard301Mode extends StandardMode {
  constructor() {
    super({ startScore: 301, outRule: "double" });
  }
}

function validateStartScore(startScore: number): void {
  if (typeof startScore !== "number" || !Number.isInteger(startScore) || startScore < 1) {
    throw new GameEngineValidationError("Start score must be a positive integer");
  }
}

/** Formats a per-player counter map in a stable order. */
function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([playerId, count]) => `${playerId}:${count}`)
    .sort()
    .join(",");
}

import { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
import { isValidSegmentScore } from "@/game-engine/rules/OutRules";
import { deriveVisitIndexes, groupVisits } from "@/game-engine/throwLedger";
import {
  GameEngineBustError,
  GameEngineStateError,
  GameEngineValidationError,
  type CorrectionRecord,
  type CorrectionValue,
  type DartGameMode,
  type MatchConfig,
  type MatchModeData,
  type MatchState,
  type MatchVisit,
  type MutableMatchState,
  type PlayerState,
  type RecordedThrow,
  type ThrowInput,
  type ThrowRecord,
} from "@/game-engine/types";

/** Darts available to each player per turn. */
export const DARTS_PER_TURN = 3;

/** The outcome of replaying a ledger of darts. */
interface ReplayResult {
  /** The re-derived match state. */
  readonly state: MatchState;
  /** Per dart: whether it busted during the replay. */
  readonly busts: readonly boolean[];
}

/**
 * Core, framework-agnostic dart match engine.
 *
 * Owns only match lifecycle, players, turn order and throw recording.
 * Mode-specific rules (501 countdown, busts, checkout, ...) are
 * delegated to a {@link DartGameMode} so the core stays reusable for
 * every future game mode.
 *
 * The engine keeps the ledger of every dart the players entered, and the
 * match state is *derived* from that ledger by replaying it through the
 * engine. Undoing or correcting a dart therefore re-derives everything —
 * score, turn order, leg progress — from one single source of truth.
 */
export class GameEngine {
  private readonly mode: DartGameMode;
  private state: MatchState | null = null;
  /** The player ids of the current match, retained so a replay can re-seed it. */
  private playerIds: readonly string[] = [];
  /** The configuration of the current match, retained for the same reason. */
  private config: MatchConfig | null = null;
  /** The id of the current match, retained for the same reason. */
  private matchId = "";

  constructor(mode: DartGameMode = new NeutralScoreMode()) {
    this.mode = mode;
  }

  /**
   * Starts a new match and returns its initial state snapshot.
   */
  startMatch(config: MatchConfig): MatchState {
    const playerIds = validatePlayerIds(config.playerIds);
    this.mode.configure?.(config);
    const players: PlayerState[] = playerIds.map((id) => ({ id, totalPoints: 0 }));
    const matchId = createMatchId();
    const draft: MutableMatchState = {
      matchId,
      status: "inProgress",
      players,
      currentPlayerId: players[0]?.id ?? null,
      throwsInCurrentTurn: 0,
      throwCount: 0,
      throws: [],
      corrections: [],
      modeData: undefined,
    };
    this.mode.initializeMatch?.(draft);
    this.playerIds = playerIds;
    this.config = { ...config };
    this.matchId = matchId;
    this.state = asMatchState(draft);
    return this.getState();
  }

  /**
   * Records a single dart throw for the current player, then advances
   * the turn. Returns the resulting state snapshot.
   *
   * A busting dart is entered — it lands in the ledger — but it counts
   * for nothing, and it is still rejected with a
   * {@link GameEngineStateError}, so the existing callers and the
   * realtime error mapping keep working unchanged.
   */
  recordThrow(input: ThrowInput): MatchState {
    validateThrowInput(input);
    const state = this.requireState();
    if (state.status === "completed") {
      throw new GameEngineStateError("Match is already completed");
    }
    if (input.playerId !== state.currentPlayerId) {
      throw new GameEngineStateError(`It is not the turn of player "${input.playerId}"`);
    }

    const draft = toMutableDraft(state);
    try {
      this.applyToDraft(draft, toThrowRecord(input));
    } catch (error) {
      if (!(error instanceof GameEngineBustError)) {
        throw error;
      }
      // The dart is entered, but it counts for nothing: the ledger keeps
      // it, the score and the counters stay as they were.
      draft.throws = [...state.throws, toRecordedThrow(input, true)];
      this.state = asMatchState(draft);
      throw error;
    }
    draft.throws = [...state.throws, toRecordedThrow(input, false)];
    this.state = asMatchState(draft);
    return this.getState();
  }

  /**
   * Removes the last entered dart and re-derives the state.
   *
   * Allowed on a completed match: the match-winning dart is exactly the
   * dart a player is most likely to have mis-tapped, and the replay
   * simply no longer completes the match.
   */
  undoLastThrow(): MatchState {
    const state = this.requireState();
    if (state.throws.length === 0) {
      throw new GameEngineStateError("There is nothing to undo");
    }
    const remaining = state.throws.slice(0, -1);
    const { state: derived } = this.replay(remaining, state.corrections);
    // A correction that pointed at the removed dart no longer applies.
    const corrections = derived.corrections.filter((record) => record.dartIndex < remaining.length);
    this.state = { ...derived, corrections };
    return this.getState();
  }

  /**
   * Replaces one recorded dart's value and re-derives the state.
   *
   * The player is taken from the recorded dart, never from the caller,
   * so a correction can never move a dart between players.
   *
   * The correction is refused — changing neither the state nor the
   * ledger — when the index does not exist, when the match is already
   * completed, when the replacement would make the corrected dart itself
   * bust, or when it would make a later recorded dart bust that did not
   * bust before.
   */
  correctThrow(dartIndex: number, value: CorrectionValue): MatchState {
    validateCorrectionValue(value);
    const state = this.requireState();
    if (state.status === "completed") {
      throw new GameEngineStateError("Match is already completed");
    }
    const target = state.throws[dartIndex];
    if (!target) {
      throw new GameEngineStateError(`There is no dart at index ${dartIndex}`);
    }

    const candidate = state.throws.map((dart, index) =>
      index === dartIndex
        ? toRecordedThrow(
            { playerId: dart.playerId, points: value.points, segment: value.segment },
            false,
          )
        : dart,
    );
    const { state: derived, busts } = this.replay(candidate, state.corrections);

    if (busts[dartIndex]) {
      throw new GameEngineStateError(
        `The corrected dart would bust: ${value.points} points is not a valid result for player "${target.playerId}"`,
      );
    }
    for (let index = dartIndex + 1; index < busts.length; index++) {
      if (busts[index] && !state.throws[index]!.bust) {
        throw new GameEngineStateError(
          `The correction would make dart ${index + 1} bust: ${state.throws[index]!.points} points is no longer a valid result for player "${state.throws[index]!.playerId}"`,
        );
      }
    }

    const corrections = this.shouldAudit(state, derived, dartIndex)
      ? [...state.corrections, toCorrectionRecord(dartIndex, target, value)]
      : state.corrections;

    this.state = { ...derived, corrections };
    return this.getState();
  }

  /**
   * Returns the current state snapshot. Callers may mutate the returned
   * object freely without affecting engine internals.
   */
  getState(): MatchState {
    return structuredClone(this.requireState());
  }

  /**
   * Returns the visits of the current ledger: the dart groups the match
   * views show as chip rows.
   *
   * The boundaries are derived from the ledger, never stored on a dart,
   * so they cannot go stale after a correction.
   */
  getVisits(): readonly MatchVisit[] {
    return groupVisits(this.requireState().throws, DARTS_PER_TURN);
  }

  /**
   * Applies one dart to the draft: the mode's scoring rules, the dart
   * counters, the turn advance and the completion check.
   *
   * This is the one place where a dart changes the match, so the replay
   * and the live recording cannot drift apart.
   */
  private applyToDraft(draft: MutableMatchState, record: ThrowRecord): void {
    const scoreBefore = draft.players.map((player) => ({ ...player }));
    const modeDataBefore =
      draft.modeData === undefined ? undefined : (structuredClone(draft.modeData) as MatchModeData);
    try {
      this.mode.applyThrow(draft, record);
    } catch (error) {
      if (error instanceof GameEngineBustError) {
        // A bust counts for nothing, so the score goes back to where it
        // was before the dart.
        draft.players = scoreBefore;
        draft.modeData = modeDataBefore;
      }
      throw error;
    }
    draft.throwCount += 1;
    draft.throwsInCurrentTurn += 1;

    if (draft.throwsInCurrentTurn >= DARTS_PER_TURN) {
      draft.throwsInCurrentTurn = 0;
      draft.currentPlayerId = this.nextPlayerId(draft);
    }

    if (this.mode.isMatchComplete(asMatchState(draft))) {
      draft.status = "completed";
      draft.currentPlayerId = null;
      draft.throwsInCurrentTurn = 0;
    }
  }

  /**
   * Re-derives the whole match state from a ledger of darts.
   *
   * The seed is the one `startMatch` uses — same players, same
   * configuration, same initialization — and every dart is applied
   * through {@link applyToDraft}, exactly as `recordThrow` applies it.
   * The mode therefore stays the only owner of the mode-specific rules.
   */
  private replay(
    ledger: readonly RecordedThrow[],
    corrections: readonly CorrectionRecord[],
  ): ReplayResult {
    const draft = this.createSeedDraft();
    const busts: boolean[] = [];
    const entries: RecordedThrow[] = [];

    for (const dart of ledger) {
      let bust = false;
      try {
        this.applyToDraft(draft, {
          playerId: dart.playerId,
          points: dart.points,
          segment: dart.segment,
        });
      } catch (error) {
        if (!(error instanceof GameEngineBustError)) {
          throw error;
        }
        bust = true;
      }
      busts.push(bust);
      entries.push(toRecordedThrow(dart, bust));
    }

    draft.throws = entries;
    draft.corrections = [...corrections];
    return { state: asMatchState(draft), busts };
  }

  /**
   * Builds the draft a replay starts from: the same seed `startMatch`
   * creates, re-applying the retained configuration so the mode keeps
   * its checkout rule and leg structure.
   */
  private createSeedDraft(): MutableMatchState {
    const players: PlayerState[] = this.playerIds.map((id) => ({ id, totalPoints: 0 }));
    const draft: MutableMatchState = {
      matchId: this.matchId,
      status: "inProgress",
      players,
      currentPlayerId: players[0]?.id ?? null,
      throwsInCurrentTurn: 0,
      throwCount: 0,
      throws: [],
      corrections: [],
      modeData: undefined,
    };
    if (this.config !== null) {
      this.mode.configure?.(this.config);
    }
    this.mode.initializeMatch?.(draft);
    return draft;
  }

  /**
   * Decides whether a correction belongs in the audit trail.
   *
   * A correction of a dart from a finished visit is always audited. A
   * correction of a dart in the turn in progress is audited only when it
   * changed the result of the match — the match ended, or the mode's own
   * result progress moved, e.g. a different player won the leg.
   */
  private shouldAudit(before: MatchState, after: MatchState, dartIndex: number): boolean {
    const visits = deriveVisitIndexes(before.throws, DARTS_PER_TURN);
    const inTurnInProgress = visits[dartIndex] === Math.max(...visits);
    if (!inTurnInProgress) {
      return true;
    }
    return this.resultKey(before) !== this.resultKey(after);
  }

  /**
   * A stable description of the match result, used to spot a correction
   * that changed who won. The mode owns the meaning; the engine only
   * compares two of them.
   */
  private resultKey(state: MatchState): string {
    const signature = this.mode.resultSignature?.(state);
    if (signature !== undefined) {
      return signature;
    }
    return this.mode.isMatchComplete(state) ? "complete" : "open";
  }

  private requireState(): MatchState {
    if (this.state === null) {
      throw new GameEngineStateError("No match has been started yet");
    }
    return this.state;
  }

  private nextPlayerId(draft: MutableMatchState): string | null {
    const currentIndex = draft.players.findIndex((player) => player.id === draft.currentPlayerId);
    const next = draft.players[(currentIndex + 1) % draft.players.length];
    return next?.id ?? null;
  }
}

/**
 * Framework-agnostic unique id: prefers the standard crypto.randomUUID when
 * the environment provides it (browsers in secure contexts, Node >= 19 and
 * Node's webcrypto-exposed runtime), and otherwise falls back to a composite
 * of the current time and browser-grade randomness.
 */
function randomId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createMatchId(): string {
  return `match-${randomId()}`;
}

/**
 * Highest possible score for a single dart: a triple of any segment
 * number, i.e. triple 20.
 */
const MAX_THROW_POINTS = 60;

function validatePlayerIds(playerIds: readonly string[]): readonly string[] {
  const normalized = playerIds.map((id) => id.trim());
  if (normalized.length === 0) {
    throw new GameEngineValidationError("A match requires at least one player");
  }
  if (normalized.some((id) => id.length === 0)) {
    throw new GameEngineValidationError("Player IDs must be non-empty");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new GameEngineValidationError("Player IDs must be unique");
  }
  return normalized;
}

function validateThrowInput(input: ThrowInput): void {
  if (typeof input.playerId !== "string" || input.playerId.trim().length === 0) {
    throw new GameEngineValidationError("Player ID must be a non-empty string");
  }
  validatePoints(input.points, input.segment);
}

/** Validates the replacement value of a correction. */
function validateCorrectionValue(value: CorrectionValue): void {
  validatePoints(value.points, value.segment);
}

function validatePoints(points: number, segment: ThrowInput["segment"]): void {
  if (
    typeof points !== "number" ||
    !Number.isInteger(points) ||
    points < 0 ||
    points > MAX_THROW_POINTS
  ) {
    throw new GameEngineValidationError(
      `Points must be an integer between 0 and ${MAX_THROW_POINTS}`,
    );
  }
  if (segment !== undefined && !isValidSegmentScore(segment, points)) {
    throw new GameEngineValidationError(
      `Segment "${String(segment)}" is not possible for ${points} points`,
    );
  }
}

/** Converts validated throw input into the record handed to the mode. */
function toThrowRecord(input: ThrowInput): ThrowRecord {
  return input.segment === undefined
    ? { playerId: input.playerId, points: input.points }
    : { playerId: input.playerId, points: input.points, segment: input.segment };
}

/** Converts a dart into a ledger entry, omitting an absent segment. */
function toRecordedThrow(dart: ThrowInput | ThrowRecord, bust: boolean): RecordedThrow {
  return dart.segment === undefined
    ? { playerId: dart.playerId, points: dart.points, bust }
    : { playerId: dart.playerId, points: dart.points, segment: dart.segment, bust };
}

/** Builds one audit-trail entry for a correction. */
function toCorrectionRecord(
  dartIndex: number,
  before: RecordedThrow,
  after: CorrectionValue,
): CorrectionRecord {
  return {
    dartIndex,
    playerId: before.playerId,
    previousPoints: before.points,
    ...(before.segment === undefined ? {} : { previousSegment: before.segment }),
    newPoints: after.points,
    ...(after.segment === undefined ? {} : { newSegment: after.segment }),
  };
}

/** Converts the immutable state into a mutable draft for mode application. */
function toMutableDraft(state: MatchState): MutableMatchState {
  return {
    matchId: state.matchId,
    status: state.status,
    players: state.players.map((player) => ({ ...player })),
    currentPlayerId: state.currentPlayerId,
    throwsInCurrentTurn: state.throwsInCurrentTurn,
    throwCount: state.throwCount,
    modeData:
      state.modeData === undefined ? undefined : (structuredClone(state.modeData) as MatchModeData),
    throws: state.throws.map((dart) => ({ ...dart })),
    corrections: state.corrections.map((record) => ({ ...record })),
  };
}

/** Views a mutable draft as its immutable {@link MatchState} counterpart. */
function asMatchState(draft: MutableMatchState): MatchState {
  return {
    matchId: draft.matchId,
    status: draft.status,
    players: draft.players,
    currentPlayerId: draft.currentPlayerId,
    throwsInCurrentTurn: draft.throwsInCurrentTurn,
    throwCount: draft.throwCount,
    modeData: draft.modeData,
    throws: draft.throws.map((dart) => ({ ...dart })),
    corrections: draft.corrections.map((record) => ({ ...record })),
  };
}

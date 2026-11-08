import { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
import { isValidSegmentScore } from "@/game-engine/rules/OutRules";
import {
  GameEngineStateError,
  GameEngineValidationError,
  type DartGameMode,
  type MatchConfig,
  type MatchModeData,
  type MatchState,
  type MutableMatchState,
  type PlayerState,
  type ThrowInput,
  type ThrowRecord,
} from "@/game-engine/types";

/** Darts available to each player per turn. */
export const DARTS_PER_TURN = 3;

/**
 * Core, framework-agnostic dart match engine.
 *
 * Owns only match lifecycle, players, turn order and throw recording.
 * Mode-specific rules (501 countdown, busts, checkout, ...) are
 * delegated to a {@link DartGameMode} so the core stays reusable for
 * every future game mode.
 */
export class GameEngine {
  private readonly mode: DartGameMode;
  private state: MatchState | null = null;

  constructor(mode: DartGameMode = new NeutralScoreMode()) {
    this.mode = mode;
  }

  /**
   * Starts a new match and returns its initial state snapshot.
   */
  startMatch(config: MatchConfig): MatchState {
    const playerIds = validatePlayerIds(config.playerIds);
    this.mode.configure?.(config);
    const players: PlayerState[] = playerIds.map((id) => ({
      id,
      totalPoints: 0,
    }));
    const draft = toMutableDraft({
      matchId: createMatchId(),
      status: "inProgress",
      players,
      currentPlayerId: players[0]?.id ?? null,
      throwsInCurrentTurn: 0,
      throwCount: 0,
    });
    this.mode.initializeMatch?.(draft);
    this.state = asMatchState(draft);
    return this.getState();
  }

  /**
   * Records a single dart throw for the current player, then advances
   * the turn. Returns the resulting state snapshot.
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
    this.mode.applyThrow(draft, toThrowRecord(input));
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

    this.state = asMatchState(draft);
    return this.getState();
  }

  /**
   * Returns the current state snapshot. Callers may mutate the returned
   * object freely without affecting engine internals.
   */
  getState(): MatchState {
    return structuredClone(this.requireState());
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
  const points = input.points;
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
  if (input.segment !== undefined && !isValidSegmentScore(input.segment, input.points)) {
    throw new GameEngineValidationError(
      `Segment "${String(input.segment)}" is not possible for ${input.points} points`,
    );
  }
}

/** Converts validated throw input into the record handed to the mode. */
function toThrowRecord(input: ThrowInput): ThrowRecord {
  return input.segment === undefined
    ? { playerId: input.playerId, points: input.points }
    : { playerId: input.playerId, points: input.points, segment: input.segment };
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
  };
}

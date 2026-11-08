/**
 * Core domain types for the DartHub game engine.
 *
 * This module is pure TypeScript: it must never import UI frameworks
 * (React, Next.js), networking layers (Socket.IO), or Node/browser-only
 * built-ins, so it can run unchanged on the multiplayer server and in
 * single-player client environments.
 */

/** Lifecycle status of a match. */
export type MatchStatus = "inProgress" | "completed";

/**
 * The part of the board a dart hit. Optional on throw inputs/records:
 * it is only needed when checkout rules depend on the segment type
 * (e.g. Double Out), while plain point totals stay fully backwards
 * compatible.
 */
export type ThrowSegment = "single" | "double" | "triple" | "bull";

/** Selectable checkout/finishing rule of an x01 match. */
export type OutRuleId = "double" | "master" | "straight";

/** A single recorded dart throw. */
export interface ThrowRecord {
  /** ID of the player who threw the dart. */
  readonly playerId: string;
  /** Points scored by this throw. */
  readonly points: number;
  /** Optional board segment hit by this throw (see {@link ThrowSegment}). */
  readonly segment?: ThrowSegment;
}

/** Aggregate per-player view inside a match state snapshot. */
export interface PlayerState {
  readonly id: string;
  /** Points accumulated by this player so far (mode-defined meaning). */
  readonly totalPoints: number;
}

/**
 * Serializable snapshot of the current match state.
 *
 * Must stay JSON-safe: only plain objects, arrays, strings, numbers,
 * booleans and null.
 */
export interface MatchState {
  /** Stable identifier for the match. */
  readonly matchId: string;
  readonly status: MatchStatus;
  /** Players in turn order. */
  readonly players: readonly PlayerState[];
  /** ID of the player who throws next, or null when the match is over. */
  readonly currentPlayerId: string | null;
  /** Number of darts already thrown in the current turn. */
  readonly throwsInCurrentTurn: number;
  /** Monotonic counter of recorded throws since the match started. */
  readonly throwCount: number;
  /** Optional mode-owned state slice (see {@link MatchModeData}). */
  readonly modeData?: MatchModeData;
}

/**
 * Mode-owned slice of the match state, persisted inside
 * {@link MatchState.modeData} so per-mode bookkeeping (e.g. Cricket mark
 * counts) travels with the JSON-safe snapshot. The shape is defined by
 * the writing mode, but the content must remain JSON-safe.
 */
export type MatchModeData = Record<string, unknown>;

/** Configuration used to start a new match. */
export interface MatchConfig {
  /** Player IDs in seating/turn order. Must be unique, non-empty strings. */
  readonly playerIds: readonly string[];
  /**
   * Optional mode-agnostic game-flow options for x01 matches (task 038).
   * Ignored by modes that do not use them; values set on the mode
   * instance itself take precedence over these.
   */
  readonly outRule?: OutRuleId;
  /** Best of N legs per set (e.g. 5 means "first to 3 legs"). */
  readonly legs?: number;
  /** Best of N sets per match (e.g. 3 means "first to 2 sets"). */
  readonly sets?: number;
}

/** Input for a single dart throw. */
export interface ThrowInput {
  readonly playerId: string;
  readonly points: number;
  /** Optional board segment hit by this throw (see {@link ThrowSegment}). */
  readonly segment?: ThrowSegment;
}

/**
 * Extension seam for concrete game modes (501, Cricket, ...).
 *
 * The core engine owns match lifecycle, players, turn order and throw
 * recording; a mode supplies only the scoring/completion rules. Modes
 * must mutate only through the provided mutable draft and stay free of
 * side effects so the engine remains serializable and testable.
 */
export interface DartGameMode {
  /** Unique mode identifier, e.g. "neutral". */
  readonly id: string;
  /**
   * Optional hook called once when a match starts, before the first
   * snapshot is handed out. Modes use it to seed initial scores
   * (e.g. start every player at 501 in the "x01" modes).
   */
  initializeMatch?(draft: MutableMatchState): void;
  /**
   * Optional hook called with the raw {@link MatchConfig} once per
   * startMatch, before {@link DartGameMode.initializeMatch}. Modes use
   * it to pick up mode-agnostic options (outRule, legs, sets).
   */
  configure?(config: MatchConfig): void;
  /** Applies a recorded throw to the mutable state draft. */
  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void;
  /** Returns true when the mode considers the match finished. */
  isMatchComplete(state: MatchState): boolean;
}

/** Mutable counterpart of {@link PlayerState} used by modes during apply. */
export type MutablePlayerState = {
  -readonly [K in keyof PlayerState]: PlayerState[K];
};

/**
 * Mutable counterpart of {@link MatchState} handed to modes during
 * {@link DartGameMode.applyThrow}.
 */
export type MutableMatchState = {
  -readonly [K in keyof Omit<MatchState, "players">]: MatchState[K];
} & {
  players: MutablePlayerState[];
};

/** Thrown when a method is called in an invalid lifecycle state. */
export class GameEngineStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameEngineStateError";
  }
}

/** Thrown when inputs fail validation. */
export class GameEngineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameEngineValidationError";
  }
}

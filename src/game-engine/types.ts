/**
 * Core domain types for the DartHub game engine.
 *
 * This module is pure TypeScript: it must never import UI frameworks
 * (React, Next.js), networking layers (Socket.IO), or Node/browser-only
 * built-ins, so it can run unchanged on the multiplayer server and in
 * single-player client environments.
 */
import type { BoardSegment as ThrowSegment } from "@/board/boardGeometry";

/** Lifecycle status of a match. */
export type MatchStatus = "inProgress" | "completed";

/**
 * The part of the board a dart hit. Optional on throw inputs/records:
 * it is only needed when checkout rules depend on the segment type
 * (e.g. Double Out), while plain point totals stay fully backwards
 * compatible.
 *
 * The definition lives in the shared board module, so the board geometry
 * and the engine can never disagree about the segment vocabulary. The
 * engine re-exports it under its own historical name.
 */
export type { BoardSegment as ThrowSegment } from "@/board/boardGeometry";

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

/**
 * A dart as entered by a player, in the order it was entered.
 *
 * The ledger holds every dart the players entered, including one that
 * busted: a busting dart is entered, but it counts for nothing. The
 * ledger travels inside {@link MatchState}, so it reaches the client and
 * the socket server as JSON-safe data. Its size is bounded by the match
 * — roughly 150 darts for a 501 game — and never grows without bound.
 *
 * The visit boundaries are NOT stored here: a correction changes them,
 * so a stored boundary goes stale. They are derived from the replay.
 */
export interface RecordedThrow {
  /** ID of the player who threw the dart. A correction never changes this. */
  readonly playerId: string;
  /** Points the dart was worth. */
  readonly points: number;
  /** Optional board segment hit by the dart. */
  readonly segment?: ThrowSegment;
  /** True when the dart busted: entered, but it counted for nothing. */
  readonly bust: boolean;
}

/**
 * One visit (turn) of darts, derived from the ledger.
 *
 * A visit ends when the turn advances and when a dart busts, which is
 * what the match views show as one chip group.
 */
export interface MatchVisit {
  /** Index of the visit, counting from 0. */
  readonly index: number;
  /** ID of the player whose turn the visit belongs to. */
  readonly playerId: string;
  /** The darts of the visit, oldest first. */
  readonly throws: readonly RecordedThrow[];
}

/**
 * The replacement value of a corrected dart.
 *
 * It carries no player: a correction never moves a dart between players,
 * the player always comes from the recorded dart.
 */
export interface CorrectionValue {
  /** Points the corrected dart was worth. */
  readonly points: number;
  /** Optional board segment hit by the corrected dart. */
  readonly segment?: ThrowSegment;
}

/**
 * One entry of the audit trail of corrections.
 *
 * Recorded when a dart outside the turn in progress was corrected, and
 * when a correction changed the result of the match (e.g. who won a leg).
 */
export interface CorrectionRecord {
  /** Index of the corrected dart in the ledger. */
  readonly dartIndex: number;
  /** ID of the player who threw the corrected dart. */
  readonly playerId: string;
  /** Points the dart was worth before the correction. */
  readonly previousPoints: number;
  /** Segment the dart hit before the correction, if any. */
  readonly previousSegment?: ThrowSegment;
  /** Points the dart is worth after the correction. */
  readonly newPoints: number;
  /** Segment the dart hits after the correction, if any. */
  readonly newSegment?: ThrowSegment;
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
  /** Every dart entered in this match, oldest first. */
  readonly throws: readonly RecordedThrow[];
  /** Corrections made to darts outside the turn in progress. */
  readonly corrections: readonly CorrectionRecord[];
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
  /**
   * Optional: a stable description of the match result — who has won
   * what — derived from the state.
   *
   * The engine compares the signature before and after a correction to
   * tell whether the correction changed the result of the match and not
   * merely a score. Modes without a result structure omit it.
   */
  resultSignature?(state: MatchState): string;
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

/**
 * Thrown when a dart busts: it was entered, but it counts for nothing.
 *
 * A bust is a normal outcome of a throw, not a broken call, so it gets
 * its own class — the replay needs to tell a bust apart from a genuine
 * failure. It stays a {@link GameEngineStateError} subclass, so every
 * existing caller and the realtime error mapping keep working unchanged.
 */
export class GameEngineBustError extends GameEngineStateError {
  constructor(message: string) {
    super(message);
    this.name = "GameEngineBustError";
  }
}

/** Thrown when inputs fail validation. */
export class GameEngineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameEngineValidationError";
  }
}

/**
 * Game-state service around the core {@link GameEngine}.
 *
 * Owns the authoritative match state of one game room. Clients never
 * receive mutable state: only JSON-safe snapshots are handed out, and
 * every change goes through this service.
 */
import {
  GameEngine,
  GameEngineStateError,
  GameEngineValidationError,
  NeutralScoreMode,
} from "@/game-engine";
import type { MatchState, MatchStatus } from "@/game-engine";

/** Thrown when a game action collides with the current match lifecycle. */
export class GameStateError extends Error {}

/** Thrown when client-provided game input fails validation. */
export class GameInputError extends Error {}

/** Wraps the core engine and exposes a narrow, room-oriented API. */
export class GameStateMachine {
  private readonly engine = new GameEngine(new NeutralScoreMode());
  private state: MatchState | null = null;

  /** Starts a match for the given player seats (turn order). */
  startMatch(playerIds: readonly string[]): MatchState {
    this.state = this.engine.startMatch({ playerIds });
    return this.state;
  }

  /** Records one dart throw for the currently active player. */
  recordThrow(playerId: string, points: number): MatchState {
    try {
      this.state = this.engine.recordThrow({ playerId, points });
    } catch (error) {
      if (error instanceof GameEngineValidationError) {
        throw new GameInputError(error.message);
      }
      if (error instanceof GameEngineStateError) {
        throw new GameStateError(error.message);
      }
      throw error;
    }
    return this.state;
  }

  /** Returns true when a match has been started in this room. */
  hasStarted(): boolean {
    return this.state !== null;
  }

  /** Returns the current lifecycle status, or "waiting" pre-match. */
  getStatus(): MatchStatus | "waiting" {
    return this.state?.status ?? "waiting";
  }

  /** Snapshot of the match state, or null while the room is a lobby. */
  getSnapshot(): MatchState | null {
    return this.state;
  }
}

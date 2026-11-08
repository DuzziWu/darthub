import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import { GameEngineStateError, GameEngineValidationError } from "@/game-engine/types";

describe("GameEngine input validation", () => {
  it("validates input parameters (player IDs, scores)", () => {
    const engine = new GameEngine();

    // Player IDs: startMatch must reject invalid player ID lists.
    expect(() => engine.startMatch({ playerIds: [] })).toThrow(GameEngineValidationError);
    expect(() => engine.startMatch({ playerIds: [""] })).toThrow(GameEngineValidationError);
    expect(() => engine.startMatch({ playerIds: ["   "] })).toThrow(GameEngineValidationError);
    expect(() => engine.startMatch({ playerIds: ["alice", "alice"] })).toThrow(
      GameEngineValidationError,
    );

    // recordThrow must reject calls before a match has started.
    expect(() => engine.recordThrow({ playerId: "alice", points: 20 })).toThrow(
      GameEngineStateError,
    );

    engine.startMatch({ playerIds: ["alice", "bob"] });

    // Player IDs: only the current player may record a throw.
    expect(() => engine.recordThrow({ playerId: "bob", points: 20 })).toThrow(GameEngineStateError);
    expect(() => engine.recordThrow({ playerId: "ghost", points: 20 })).toThrow(
      GameEngineStateError,
    );
    expect(() => engine.recordThrow({ playerId: "", points: 20 })).toThrow(
      GameEngineValidationError,
    );

    // Scores: must be whole dart scores (0-60, integer).
    expect(() => engine.recordThrow({ playerId: "alice", points: 61 })).toThrow(
      GameEngineValidationError,
    );
    expect(() => engine.recordThrow({ playerId: "alice", points: -1 })).toThrow(
      GameEngineValidationError,
    );
    expect(() => engine.recordThrow({ playerId: "alice", points: 20.5 })).toThrow(
      GameEngineValidationError,
    );
    expect(() => engine.recordThrow({ playerId: "alice", points: Number.NaN })).toThrow(
      GameEngineValidationError,
    );

    // Nothing above may have advanced the match: still alice's turn.
    const state = engine.getState();
    expect(state.currentPlayerId).toBe("alice");
    expect(state.throwCount).toBe(0);
  });
});

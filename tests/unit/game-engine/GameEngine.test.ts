import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";

describe("GameEngine", () => {
  it("exposes methods to start a new match, record a throw, and query current state", () => {
    const engine = new GameEngine();

    const started = engine.startMatch({ playerIds: ["alice", "bob"] });
    expect(started.status).toBe("inProgress");
    expect(started.currentPlayerId).toBe("alice");

    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 5 });
    engine.recordThrow({ playerId: "alice", points: 1 });

    const state = engine.getState();
    expect(state.status).toBe("inProgress");
    expect(state.currentPlayerId).toBe("bob");
    expect(state.players[0]!.totalPoints).toBe(26);
    expect(state.players[1]!.totalPoints).toBe(0);

    // State must be JSON-safe so it can be serialized over the wire.
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

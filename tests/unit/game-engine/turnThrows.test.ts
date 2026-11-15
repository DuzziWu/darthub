import { describe, it, expect } from "vitest";
import { GameEngine, DARTS_PER_TURN } from "@/game-engine/GameEngine";
import { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { deriveTurnThrows } from "@/game-engine/throwLedger";
import { GameEngineStateError } from "@/game-engine/types";
import type { RecordedThrow } from "@/game-engine/types";

/** Builds a ledger entry without a segment. */
function dart(playerId: string, points: number, bust = false): RecordedThrow {
  return { playerId, points, bust };
}

/** Starts a neutral engine and replays the given darts in order. */
function neutralEngineWith(darts: readonly RecordedThrow[]): GameEngine {
  const engine = new GameEngine(new NeutralScoreMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  for (const entry of darts) {
    engine.recordThrow({ playerId: entry.playerId, points: entry.points });
  }
  return engine;
}

describe("deriveTurnThrows", () => {
  it("resets when the player changes: three darts and a new player leave an empty turn", () => {
    const ledger = [dart("alice", 20), dart("alice", 20), dart("alice", 20)];

    // Alice threw three darts and the turn passed to Bob: Bob's turn has
    // not started, so his turn holds no darts at all.
    expect(deriveTurnThrows(ledger, "bob", DARTS_PER_TURN)).toEqual([]);
    // Alice's own turn still holds her three darts.
    expect(deriveTurnThrows(ledger, "alice", DARTS_PER_TURN)).toEqual(ledger);
  });

  it("keeps the darts of the current player only", () => {
    const ledger = [dart("alice", 20), dart("bob", 20), dart("bob", 20)];

    expect(deriveTurnThrows(ledger, "bob", DARTS_PER_TURN)).toEqual([
      dart("bob", 20),
      dart("bob", 20),
    ]);
  });

  it("counts a bust as a dart of the turn without spending a dart slot", () => {
    const ledger = [
      dart("alice", 20),
      dart("alice", 30, true), // the bust
      dart("alice", 20),
    ];

    const turn = deriveTurnThrows(ledger, "alice", DARTS_PER_TURN);

    // The bust belongs to the turn: Alice threw it.
    expect(turn).toHaveLength(3);
    expect(turn.map((entry) => entry.bust)).toEqual([false, true, false]);
    // It consumed no slot, so the turn still holds three counted darts.
    expect(turn.filter((entry) => !entry.bust)).toHaveLength(2);
  });

  it("holds at most dartsPerTurn counted darts", () => {
    const ledger = [dart("alice", 20), dart("alice", 20), dart("alice", 20), dart("alice", 20)];

    const turn = deriveTurnThrows(ledger, "alice", DARTS_PER_TURN);

    // The fourth dart belongs to an earlier turn of the same player.
    expect(turn).toHaveLength(DARTS_PER_TURN);
    expect(turn.map((entry) => entry.points)).toEqual([20, 20, 20]);
  });

  it("keeps a bust inside the turn when the counted darts are already full", () => {
    const ledger = [
      dart("alice", 20),
      dart("alice", 20),
      dart("alice", 20),
      dart("alice", 30, true),
    ];

    const turn = deriveTurnThrows(ledger, "alice", DARTS_PER_TURN);

    // Three counted darts fill the turn; the bust that follows is still a
    // dart of the turn, but it does not make room for a fourth.
    expect(turn).toHaveLength(4);
    expect(turn.map((entry) => entry.bust)).toEqual([false, false, false, true]);
    expect(turn.filter((entry) => !entry.bust)).toHaveLength(DARTS_PER_TURN);
  });

  it("returns an empty array when there is no current player", () => {
    const ledger = [dart("alice", 20)];

    expect(deriveTurnThrows(ledger, null, DARTS_PER_TURN)).toEqual([]);
  });

  it("returns an empty array for an empty ledger", () => {
    expect(deriveTurnThrows([], "alice", DARTS_PER_TURN)).toEqual([]);
  });

  it("does not mutate the ledger it derives from", () => {
    const ledger = [dart("alice", 20), dart("alice", 30, true)];

    const turn = deriveTurnThrows(ledger, "alice", DARTS_PER_TURN);

    turn.push(dart("alice", 60));
    expect(ledger).toHaveLength(2);
  });
});

describe("GameEngine.getCurrentTurn", () => {
  it("holds the darts of the player whose turn it is", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice", "bob"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 20 });

    const turn = engine.getCurrentTurn();
    expect(turn).toHaveLength(2);
    expect(turn.map((entry) => entry.playerId)).toEqual(["alice", "alice"]);
    expect(turn.map((entry) => entry.points)).toEqual([20, 20]);
  });

  it("is empty for the player who just came on", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice", "bob"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 20 }); // alice's turn is done

    const state = engine.getState();
    expect(state.currentPlayerId).toBe("bob");
    // Bob is on, but he has not thrown yet: the turn is empty, while the
    // visit strip still shows Alice's darts.
    expect(engine.getCurrentTurn()).toEqual([]);
    expect(
      engine
        .getVisits()
        .at(-1)
        ?.throws.map((entry) => entry.playerId),
    ).toEqual(["alice", "alice", "alice"]);
  });

  it("keeps a busted dart in the turn of the player who threw it", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100 }));
    engine.startMatch({ playerIds: ["alice", "bob"], outRule: "straight" });
    engine.recordThrow({ playerId: "alice", points: 50 }); // 50 left
    expect(() => engine.recordThrow({ playerId: "alice", points: 60 })).toThrow(
      GameEngineStateError, // bust: 60 overshoots the remaining 50
    );
    engine.recordThrow({ playerId: "alice", points: 10 }); // 40 left, still alice's turn

    const state = engine.getState();
    expect(state.currentPlayerId).toBe("alice");
    const turn = engine.getCurrentTurn();
    expect(turn.map((entry) => entry.bust)).toEqual([false, true, false]);
    // The bust spent no dart slot, so the turn still holds room for a
    // third counted dart.
    expect(turn.filter((entry) => !entry.bust)).toHaveLength(2);
    expect(state.throwsInCurrentTurn).toBe(2);
  });

  it("follows the ledger through an undo", () => {
    const engine = neutralEngineWith([dart("alice", 20), dart("alice", 20)]);
    expect(engine.getCurrentTurn()).toHaveLength(2);

    engine.undoLastThrow();

    expect(engine.getCurrentTurn()).toHaveLength(1);
    expect(engine.getCurrentTurn()[0]?.points).toBe(20);
  });

  it("follows the ledger through a correction", () => {
    const engine = neutralEngineWith([dart("alice", 20), dart("alice", 20)]);

    engine.correctThrow(1, { points: 18 });

    const turn = engine.getCurrentTurn();
    expect(turn.map((entry) => entry.points)).toEqual([20, 18]);
  });

  it("is empty when the match is over", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 20 }));
    engine.startMatch({ playerIds: ["alice", "bob"], outRule: "straight" });
    engine.recordThrow({ playerId: "alice", points: 20 }); // alice wins the leg

    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.currentPlayerId).toBeNull();
    expect(engine.getCurrentTurn()).toEqual([]);
  });
});

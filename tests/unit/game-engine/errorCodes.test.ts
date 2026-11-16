import { describe, it, expect } from "vitest";
import {
  GameEngine,
  GameEngineBustError,
  GameEngineStateError,
  type GameEngineErrorCode,
} from "@/game-engine";
import { StandardMode } from "@/game-engine/modes/StandardMode";

/**
 * The refusals of the engine carry a stable code next to their message.
 *
 * The message is English developer text and may change; the code is the
 * contract a UI branches on. The refusal logic itself — the conditions,
 * the class hierarchy and the audit trail — must not change with it.
 */

/** Runs a call and returns the error it threw. */
function captureError(call: () => unknown): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw, but it returned normally");
}

/** Runs a call and returns the state error it threw, typed. */
function captureStateError(call: () => unknown): GameEngineStateError {
  const error = captureError(call);
  expect(error).toBeInstanceOf(GameEngineStateError);
  return error as GameEngineStateError;
}

/**
 * Builds a match whose ledger holds four darts of one turn, the second of
 * them a bust: counting the bust would hand that turn a fourth dart, so
 * correcting it changes the turn rotation of the ledger.
 *
 * The situation is the one `UndoCorrect.test.ts` builds: a busts on his
 * second dart, and the two darts after it still fill a's turn.
 */
function engineWithTurnRotationConflict(): GameEngine {
  const engine = new GameEngine(new StandardMode({ startScore: 100 }));
  engine.startMatch({ playerIds: ["a", "b"], outRule: "straight" });
  engine.recordThrow({ playerId: "a", points: 60 }); // a: 40
  expect(() => engine.recordThrow({ playerId: "a", points: 50 })).toThrow(GameEngineStateError); // bust
  engine.recordThrow({ playerId: "a", points: 20 }); // a: 20
  engine.recordThrow({ playerId: "a", points: 10 }); // a: 10 → a's turn is done
  return engine;
}

describe("game engine error codes", () => {
  it("gives the turn-rotation refusal the code TURN_ROTATION_CHANGED", () => {
    const engine = engineWithTurnRotationConflict();

    const error = captureStateError(() => engine.correctThrow(1, { points: 5 }));

    expect(error.code).toBe("TURN_ROTATION_CHANGED");
    // The instanceof contract survives: the realtime error mapping and the
    // match views branch on GameEngineStateError.
    expect(error).toBeInstanceOf(GameEngineStateError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GameEngineStateError");
  });

  it("keeps the message of the turn-rotation refusal unchanged", () => {
    const engine = engineWithTurnRotationConflict();

    const error = captureStateError(() => engine.correctThrow(1, { points: 5 }));

    // The message stays English developer text — the code is the contract,
    // the message is not.
    expect(error.message).toContain("The correction would change the turn order");
  });

  it("refuses the turn-rotation change without touching state, ledger or audit trail", () => {
    const engine = engineWithTurnRotationConflict();
    const before = engine.getState();

    captureStateError(() => engine.correctThrow(1, { points: 5 }));

    expect(engine.getState()).toEqual(before);
    expect(engine.getState().corrections).toHaveLength(0);
  });

  it("gives a state error without a specific code the default INVALID_STATE", () => {
    // The generic fallback: a state refusal that is not one of the
    // special ones keeps the default code.
    const error = new GameEngineStateError("Something is off");

    expect(error.code).toBe("INVALID_STATE");
    expect(error).toBeInstanceOf(GameEngineStateError);
    expect(error).toBeInstanceOf(Error);
  });

  it("gives a bust the code BUST and keeps it a GameEngineStateError", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "straight" });
    engine.recordThrow({ playerId: "a", points: 40 }); // 10 left

    const error = captureError(() => engine.recordThrow({ playerId: "a", points: 20 }));

    expect(error).toBeInstanceOf(GameEngineBustError);
    expect(error).toBeInstanceOf(GameEngineStateError);
    expect(error).toBeInstanceOf(Error);
    expect((error as GameEngineBustError).code).toBe("BUST");
    expect((error as GameEngineBustError).name).toBe("GameEngineBustError");
  });

  it("gives the recordedThrow refusals their codes", () => {
    // No match started yet.
    const fresh = new GameEngine(new StandardMode({ startScore: 50 }));
    expect(captureStateError(() => fresh.getState()).code).toBe("NO_MATCH");
    expect(captureStateError(() => fresh.recordThrow({ playerId: "a", points: 20 })).code).toBe(
      "NO_MATCH",
    );

    // Out of turn.
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a", "b"], outRule: "straight" });
    expect(captureStateError(() => engine.recordThrow({ playerId: "b", points: 20 })).code).toBe(
      "NOT_YOUR_TURN",
    );

    // Match completed.
    const finished = new GameEngine(new StandardMode({ startScore: 20 }));
    finished.startMatch({ playerIds: ["a"], outRule: "straight" });
    finished.recordThrow({ playerId: "a", points: 20 });
    expect(finished.getState().status).toBe("completed");
    expect(captureStateError(() => finished.recordThrow({ playerId: "a", points: 20 })).code).toBe(
      "MATCH_COMPLETED",
    );
    expect(captureStateError(() => finished.correctThrow(0, { points: 0 })).code).toBe(
      "MATCH_COMPLETED",
    );
  });

  it("gives the undo refusal its code", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "straight" });

    expect(captureStateError(() => engine.undoLastThrow()).code).toBe("NOTHING_TO_UNDO");
  });

  it("gives the correction refusals their codes", () => {
    // Index that holds no dart.
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "straight" });
    engine.recordThrow({ playerId: "a", points: 20 });
    expect(captureStateError(() => engine.correctThrow(5, { points: 10 })).code).toBe(
      "NO_DART_AT_INDEX",
    );

    // The corrected dart itself would bust.
    const busting = new GameEngine(new StandardMode({ startScore: 50 }));
    busting.startMatch({ playerIds: ["a"], outRule: "straight" });
    busting.recordThrow({ playerId: "a", points: 40 }); // 10 left
    expect(captureStateError(() => busting.correctThrow(0, { points: 60 })).code).toBe(
      "CORRECTION_WOULD_BUST",
    );

    // A later recorded dart would bust.
    const later = new GameEngine(new StandardMode({ startScore: 100 }));
    later.startMatch({ playerIds: ["a"], outRule: "straight" });
    later.recordThrow({ playerId: "a", points: 20 }); // 80 left
    later.recordThrow({ playerId: "a", points: 60 }); // 20 left
    expect(captureStateError(() => later.correctThrow(0, { points: 60 })).code).toBe(
      "LATER_DART_WOULD_BUST",
    );
  });

  it("keeps the code independent of the message", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a", "b"], outRule: "straight" });

    const error = captureStateError(() => engine.recordThrow({ playerId: "b", points: 20 }));

    // The message names the player, the code does not.
    expect(error.message).toContain('"b"');
    expect(error.code).toBe("NOT_YOUR_TURN");
    expect(error.code).not.toContain("b");
  });

  it("exposes the code union as a type of the public barrel", () => {
    // The type is exported from the barrel — the compile of this file is
    // the assertion.
    const code: GameEngineErrorCode = "TURN_ROTATION_CHANGED";
    const codes: readonly GameEngineErrorCode[] = [
      "INVALID_STATE",
      "MATCH_COMPLETED",
      "NOT_YOUR_TURN",
      "NO_MATCH",
      "NOTHING_TO_UNDO",
      "NO_DART_AT_INDEX",
      "BUST",
      "CORRECTION_WOULD_BUST",
      "LATER_DART_WOULD_BUST",
      "TURN_ROTATION_CHANGED",
    ];

    expect(code).toBe("TURN_ROTATION_CHANGED");
    expect(codes).toHaveLength(10);
  });
});

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

/**
 * Every code of the union, as a compile-time check.
 *
 * A code that is added to or removed from `GameEngineErrorCode` breaks
 * this record, and `npm run typecheck` fails with it.
 */
const UNION_CODES: Readonly<Record<GameEngineErrorCode, true>> = {
  INVALID_STATE: true,
  MATCH_COMPLETED: true,
  NOT_YOUR_TURN: true,
  NO_MATCH: true,
  NOTHING_TO_UNDO: true,
  NO_DART_AT_INDEX: true,
  BUST: true,
  CORRECTION_WOULD_BUST: true,
  LATER_DART_WOULD_BUST: true,
  TURN_ROTATION_CHANGED: true,
};

/**
 * The codes the engine really throws, collected from its refusals: the
 * turn rotation, a bust, out of turn, a completed match, an undo without
 * a dart, a call before the match started, an index without a dart, a
 * correction that would bust and a correction that would make a later
 * dart bust.
 */
function collectThrownCodes(): readonly GameEngineErrorCode[] {
  const codes: GameEngineErrorCode[] = [];
  const collect = (call: () => unknown): void => {
    const error = captureError(call);
    expect(error).toBeInstanceOf(GameEngineStateError);
    codes.push((error as GameEngineStateError).code);
  };

  // The correction would change the turn rotation.
  const rotation = engineWithTurnRotationConflict();
  collect(() => rotation.correctThrow(1, { points: 5 }));

  // The dart busted.
  const busting = new GameEngine(new StandardMode({ startScore: 50 }));
  busting.startMatch({ playerIds: ["a"], outRule: "straight" });
  busting.recordThrow({ playerId: "a", points: 40 }); // 10 left
  collect(() => busting.recordThrow({ playerId: "a", points: 20 }));

  // Out of turn.
  const outOfTurn = new GameEngine(new StandardMode({ startScore: 50 }));
  outOfTurn.startMatch({ playerIds: ["a", "b"], outRule: "straight" });
  collect(() => outOfTurn.recordThrow({ playerId: "b", points: 20 }));

  // The match is already completed.
  const completed = new GameEngine(new StandardMode({ startScore: 20 }));
  completed.startMatch({ playerIds: ["a"], outRule: "straight" });
  completed.recordThrow({ playerId: "a", points: 20 });
  collect(() => completed.recordThrow({ playerId: "a", points: 20 }));

  // There is nothing to undo.
  const empty = new GameEngine(new StandardMode({ startScore: 50 }));
  empty.startMatch({ playerIds: ["a"], outRule: "straight" });
  collect(() => empty.undoLastThrow());

  // No match has been started yet.
  const fresh = new GameEngine(new StandardMode({ startScore: 50 }));
  collect(() => fresh.getState());

  // The corrected index holds no dart.
  const noDart = new GameEngine(new StandardMode({ startScore: 50 }));
  noDart.startMatch({ playerIds: ["a"], outRule: "straight" });
  noDart.recordThrow({ playerId: "a", points: 20 });
  collect(() => noDart.correctThrow(5, { points: 10 }));

  // The corrected dart itself would bust.
  const correctionBust = new GameEngine(new StandardMode({ startScore: 50 }));
  correctionBust.startMatch({ playerIds: ["a"], outRule: "straight" });
  correctionBust.recordThrow({ playerId: "a", points: 40 }); // 10 left
  collect(() => correctionBust.correctThrow(0, { points: 60 }));

  // A later recorded dart would bust.
  const laterBust = new GameEngine(new StandardMode({ startScore: 100 }));
  laterBust.startMatch({ playerIds: ["a"], outRule: "straight" });
  laterBust.recordThrow({ playerId: "a", points: 20 }); // 80 left
  laterBust.recordThrow({ playerId: "a", points: 60 }); // 20 left
  collect(() => laterBust.correctThrow(0, { points: 60 }));

  return codes;
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

  it("keeps the code of the turn-rotation refusal independent of its message", () => {
    const engine = engineWithTurnRotationConflict();

    const error = captureStateError(() => engine.correctThrow(1, { points: 5 }));

    // The message is developer text: it says something, but it is not the
    // contract and it does not carry the code.
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.message).not.toContain(error.code);

    // The same code may travel with a different wording: the code names
    // the refusal, the message only explains it.
    const reworded = new GameEngineStateError("Another wording of the same refusal", error.code);
    expect(reworded.code).toBe(error.code);
    expect(reworded.message).not.toBe(error.message);
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

  it("throws only codes that are members of the exported union", () => {
    // The compile-time assertion: the union is exported from the barrel.
    const code: GameEngineErrorCode = "TURN_ROTATION_CHANGED";
    const members = Object.keys(UNION_CODES);
    expect(members).toContain(code);

    // Every code the engine really throws is a member of the union — a
    // refusal with a code outside it would break every consumer that
    // branches on the code.
    for (const thrown of collectThrownCodes()) {
      expect(members).toContain(thrown);
    }
  });
});

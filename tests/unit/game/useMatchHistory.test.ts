// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { GameEngineStateError } from "@/game-engine/types";
import { useMatchHistory } from "@/components/game/useMatchHistory";

/**
 * Drives the hook the way a view does: call an action, then re-render with
 * the engine's fresh state — including when the action threw (a bust or a
 * refused correction still leaves the engine's ledger changed or to show).
 */
function drive(engine: GameEngine, initial: ReturnType<GameEngine["getState"]>) {
  const harness = renderHook(({ matchState }) => useMatchHistory({ engine, matchState }), {
    initialProps: { matchState: initial },
  });
  const run = (action: () => unknown) => {
    let error: unknown = null;
    act(() => {
      try {
        action();
      } catch (e) {
        error = e;
      }
    });
    harness.rerender({ matchState: engine.getState() });
    return { error };
  };
  return { harness, run };
}

describe("useMatchHistory", () => {
  it("records a dart when nothing is armed, corrects when a target is armed", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    const { harness, run } = drive(engine, engine.startMatch({ playerIds: ["a", "b"] }));

    run(() => harness.result.current.submitThrow({ points: 20 }));
    expect(engine.getState().throws).toHaveLength(1);

    act(() => harness.result.current.selectThrow(0));
    expect(harness.result.current.correctionTarget).toBe(0);

    run(() => harness.result.current.submitThrow({ points: 50 }));
    const state = engine.getState();
    expect(state.throws).toHaveLength(1); // replaced, not appended
    expect(state.throws[0]?.points).toBe(50);
    expect(harness.result.current.correctionTarget).toBe(null); // disarmed
  });

  it("arms a dart of the current visit without confirmation", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    const { harness, run } = drive(engine, engine.startMatch({ playerIds: ["a", "b"] }));
    run(() => harness.result.current.submitThrow({ points: 20 }));

    act(() => harness.result.current.selectThrow(0));
    expect(harness.result.current.correctionTarget).toBe(0);
    expect(harness.result.current.awaitingConfirmation).toBe(false);
  });

  it("asks for confirmation before arming a dart of a finished visit", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    const { harness, run } = drive(engine, engine.startMatch({ playerIds: ["a", "b"] }));
    run(() => harness.result.current.submitThrow({ points: 20 }));
    run(() => harness.result.current.submitThrow({ points: 20 }));
    run(() => harness.result.current.submitThrow({ points: 20 })); // a's turn done
    run(() => harness.result.current.submitThrow({ points: 40 })); // b's turn in progress

    act(() => harness.result.current.selectThrow(0)); // dart in a finished visit
    expect(harness.result.current.correctionTarget).toBe(0);
    expect(harness.result.current.awaitingConfirmation).toBe(true);

    act(() => harness.result.current.confirmCorrection());
    expect(harness.result.current.awaitingConfirmation).toBe(false);
    expect(harness.result.current.correctionTarget).toBe(0);

    act(() => harness.result.current.cancelCorrection());
    expect(harness.result.current.correctionTarget).toBe(null);
    expect(harness.result.current.awaitingConfirmation).toBe(false);
    expect(engine.getState().throws).toHaveLength(4); // nothing changed
  });

  it("corrects the tapped dart in a later visit, not an earlier one", () => {
    // Seven darts make three visits: the strip shows the last one, whose
    // first chip sits at ledger index 6, not at index 0.
    const engine = new GameEngine(new NeutralScoreMode());
    const { harness, run } = drive(engine, engine.startMatch({ playerIds: ["a"] }));
    for (const points of [20, 20, 20, 11, 11, 11, 11]) {
      run(() => harness.result.current.submitThrow({ points }));
    }
    expect(harness.result.current.currentVisit).toHaveLength(1);
    expect(harness.result.current.currentVisitOffset).toBe(6);

    // The chip the player tapped is the first of the visit in progress.
    act(() => harness.result.current.selectThrow(harness.result.current.currentVisitOffset));
    expect(harness.result.current.correctionTarget).toBe(6);
    expect(harness.result.current.awaitingConfirmation).toBe(false);

    run(() => harness.result.current.submitThrow({ points: 50 }));

    const state = engine.getState();
    expect(state.throws).toHaveLength(7); // replaced, not appended
    expect(state.throws.map((dart) => dart.points)).toEqual([20, 20, 20, 11, 11, 11, 50]);
  });

  it("asks for confirmation for a dart of an earlier visit in a later visit", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    const { harness, run } = drive(engine, engine.startMatch({ playerIds: ["a"] }));
    for (const points of [20, 20, 20, 11, 11, 11, 11]) {
      run(() => harness.result.current.submitThrow({ points }));
    }

    // Dart 0 belongs to the first visit, which is finished.
    act(() => harness.result.current.selectThrow(0));
    expect(harness.result.current.correctionTarget).toBe(0);
    expect(harness.result.current.awaitingConfirmation).toBe(true);
  });

  it("keeps the dart armed when the correction is refused", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    const { harness, run } = drive(
      engine,
      engine.startMatch({ playerIds: ["a"], outRule: "straight" }),
    );
    run(() => harness.result.current.submitThrow({ points: 40 })); // 10 left

    act(() => harness.result.current.selectThrow(0));
    const before = engine.getState();
    const { error } = run(() => harness.result.current.submitThrow({ points: 60 })); // would bust
    expect(error).toBeInstanceOf(GameEngineStateError);
    expect(engine.getState()).toEqual(before); // refused: state untouched
    expect(harness.result.current.correctionTarget).toBe(0); // stays armed
  });

  it("undo clears an armed correction and removes the last dart", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    const { harness, run } = drive(engine, engine.startMatch({ playerIds: ["a", "b"] }));
    run(() => harness.result.current.submitThrow({ points: 20 }));
    run(() => harness.result.current.submitThrow({ points: 40 }));

    act(() => harness.result.current.selectThrow(0));
    run(() => harness.result.current.undo());
    expect(engine.getState().throws).toHaveLength(1);
    expect(harness.result.current.correctionTarget).toBe(null);
  });

  it("exposes the visit in progress and tracks undo availability", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    const { harness, run } = drive(
      engine,
      engine.startMatch({ playerIds: ["a"], outRule: "straight" }),
    );
    expect(harness.result.current.canUndo).toBe(false);
    expect(harness.result.current.currentVisit).toHaveLength(0);

    run(() => harness.result.current.submitThrow({ points: 40 }));
    const { error } = run(() => harness.result.current.submitThrow({ points: 20 })); // bust
    expect(error).toBeInstanceOf(GameEngineStateError);

    // The bust ends its visit; the next dart opens the visit in progress.
    run(() => harness.result.current.submitThrow({ points: 10 }));
    const visit = harness.result.current.currentVisit;
    expect(visit).toHaveLength(1);
    expect(visit[0]?.points).toBe(10);
    expect(harness.result.current.canUndo).toBe(true);
  });

  it("stays safe without an engine or match state", () => {
    const { result } = renderHook(() => useMatchHistory({ engine: null, matchState: null }));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.currentVisit).toHaveLength(0);
    expect(result.current.submitThrow({ points: 20 })).toBeNull();
    expect(result.current.undo()).toBeNull();
    act(() => result.current.selectThrow(0));
    expect(result.current.correctionTarget).toBe(null);
  });
});

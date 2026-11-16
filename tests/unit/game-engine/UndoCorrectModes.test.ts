import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { CricketMode, type CricketModeData } from "@/game-engine/modes/CricketMode";
import {
  AroundTheClockMode,
  type AroundTheClockModeData,
} from "@/game-engine/modes/AroundTheClockMode";
import { ShanghaiMode, type ShanghaiModeData } from "@/game-engine/modes/ShanghaiMode";
import { LEG_SET_MODE_DATA_KEY, type LegSetProgress } from "@/game-engine/rules/LegSetManager";
import { GameEngineStateError } from "@/game-engine/types";

/**
 * Relation zu den übrigen Engine-Tests
 *
 * Undo und Korrektur sind engine-weit geregelt: der Ledger wird durch die
 * jeweilige Mode neu gerechnet, nie gepatcht. Die Nachbardateien pinnen
 * jeweils nur einen Teil dieser Regel — je Datei, welcher Fall dort bereits
 * festgeschrieben ist:
 *
 * `tests/unit/game-engine/UndoCorrect.test.ts` (15 Tests) — der allgemeine
 * Ledger-Vertrag auf der neutralen Punktemode:
 *   - "undo of the last dart restores exactly the state before that dart"
 *   - "undo on an empty ledger is refused"
 *   - "correct replaces the dart, never adds a second one"
 *   - "several consecutive corrections replay to the final value"
 *   - "a busting dart is recorded, then correcting it makes it count"
 *   - "undo of the match-winning dart returns the match to inProgress"
 *   - "correctThrow on a completed match is refused without touching the state"
 *   - "refused corrections change neither state nor ledger"
 *   - "a correction never moves a dart between players"
 *   - "undoing a bust does not corrupt the turn counters"
 *   - "getVisits groups the ledger and keeps a bust with its visit"
 *   - "corrections are never double-booked: totals replay from the ledger alone"
 *   - "a correction of a dart in a finished visit is audited"
 *   - "multiplayer: undo and correction keep attribution and event order"
 *   - "a bust ends its visit even though the turn goes on"
 *
 * `tests/unit/game-engine/modes/CorrectionReplay.test.ts` (5 Tests) — die
 * Replay-Wirkung einer Korrektur je Mode samt Audit-Trail:
 *   - "keeps the double-out rule and leg progress alive across a correction"
 *   - "audits a correction of a leg-winning dart"
 *   - "replays cricket marks for both players after a correction"
 *   - "replays the around-the-clock target index after a correction"
 *   - "replays shanghai rounds and audits a correction of a finished round"
 *
 * `tests/unit/game-engine/turnThrows.test.ts` (14 Tests) — das Zählen der
 * Würfe und der Besuche:
 *   - "resets when the player changes: three darts and a new player leave an empty turn"
 *   - "keeps the darts of the current player only"
 *   - "counts a bust as a dart of the turn without spending a dart slot"
 *   - "holds at most dartsPerTurn counted darts"
 *   - "keeps a bust inside the turn when the counted darts are already full"
 *   - "returns an empty array when there is no current player"
 *   - "returns an empty array for an empty ledger"
 *   - "does not mutate the ledger it derives from"
 *   - "holds the darts of the player whose turn it is"
 *   - "is empty for the player who just came on"
 *   - "keeps a busted dart in the turn of the player who threw it"
 *   - "follows the ledger through an undo"
 *   - "follows the ledger through a correction"
 *   - "is empty when the match is over"
 *
 * `tests/unit/game-engine/GameEngine.test.ts` (1 Test) — der Grundvertrag:
 *   - "exposes methods to start a new match, record a throw, and query current state"
 *
 * `tests/unit/game-engine/GameEngineValidation.test.ts` (1 Test) — die
 * Eingabeprüfung:
 *   - "validates input parameters (player IDs, scores)"
 *
 * Was diese Datei hinzufügt — die Fälle, die die Nachbarn NICHT in derselben
 * Form festschreiben:
 *   - Undo und Korrektur je MODE statt nur auf der neutralen Punktemode:
 *     Cricket ("undoes the last dart in a cricket match and restores the
 *     marks", "corrects a dart in a cricket match and restores the marks"),
 *     Around The Clock ("undoes the last dart in an around the clock match and
 *     restores the target", "corrects a dart in an around the clock match and
 *     restores the target"), Shanghai ("undoes the last dart in a shanghai
 *     match and restores the round", "corrects a dart in a shanghai match and
 *     restores the round") und Neutral ("undoes the last dart in a neutral
 *     match and restores the score").
 *   - Der Undo eines mode-spezifischen Zustands: Marken, Ziel-Index und
 *     Runden-Records werden nicht gepatcht, sondern aus dem Ledger neu
 *     abgeleitet — inklusive eines Punktewertes, der von den Marken des
 *     Gegners abhängt ("corrects a cricket dart and recalculates a score that
 *     depended on another player's marks").
 *   - Der Leg-Sieg im Mode-Kontext: "undoes a dart that won a leg and restores
 *     the leg count" und "corrects a dart that wins the leg and restores the
 *     leg count". Der Nachbar pinnt nur, dass der Leg-Fortschritt eine
 *     Korrektur überlebt — nicht, dass der gewinnende Wurf ihn wieder
 *     zurücknehmen kann.
 *   - Die JSON-Sicherheit im Mode-Kontext: "keeps the match state JSON-safe
 *     after an undo" (StandardMode) und "keeps the match state JSON-safe after
 *     a correction" (CricketMode). `GameEngine.test.ts` pinnt die
 *     JSON-Sicherheit nur des frischen Zustands, nicht nach Undo oder
 *     Korrektur.
 *
 * Bewusste Überschneidung: "refuses a correction on a completed match without
 * touching the state" und "undoes a dart recorded by a second player" haben
 * denselben Gegenstand wie Fälle in `UndoCorrect.test.ts`; hier stehen sie in
 * der kürzeren Form (Ein-Dart-Leg, zweiter Spieler am Schaft), damit der
 * Modus-Kontext direkt daneben steht.
 */

/** Reads the leg/set progress out of a state's mode data. */
function legSet(state: { modeData?: Record<string, unknown> }): LegSetProgress | undefined {
  return state.modeData?.[LEG_SET_MODE_DATA_KEY] as LegSetProgress | undefined;
}

/** A JSON-safety round trip: the state survives JSON.stringify/parse identically. */
function expectJsonSafe<T>(value: T): void {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
}

describe("per-mode undo & correct", () => {
  it("undoes the last dart in a cricket match and restores the marks", () => {
    const engine = new GameEngine(new CricketMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 60 });
    engine.recordThrow({ playerId: "a", points: 20 });
    const beforeThird = engine.getState();

    engine.recordThrow({ playerId: "a", points: 20 });
    const restored = engine.undoLastThrow();
    // Undoing the third dart restores exactly the state before it.
    expect(restored).toEqual(beforeThird);
    const data = restored.modeData as CricketModeData;
    // T20 + one S20 = 4 marks on 20 — and dart 2 scored on the closed 20.
    expect(data.marks.a?.["20"]).toBe(4);
    expect(restored.players.find((p) => p.id === "a")?.totalPoints).toBe(20);
  });

  it("corrects a dart in a cricket match and restores the marks", () => {
    const engine = new GameEngine(new CricketMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });

    const corrected = engine.correctThrow(2, { points: 60 });
    const data = corrected.modeData as CricketModeData;
    // Two S20 + the corrected T20 = 2 + 3 = 5 marks on 20.
    expect(data.marks.a?.["20"]).toBe(5);
    expect(data.marks.a?.["19"]).toBe(0);
    expect(corrected.throws).toHaveLength(3);
    expect(corrected.throws[2]?.points).toBe(60);
  });

  it("corrects a cricket dart and recalculates a score that depended on another player's marks", () => {
    const engine = new GameEngine(new CricketMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    // a's turn 1: T20 closes 20; the two S20 each score 20 (b still open).
    engine.recordThrow({ playerId: "a", points: 60 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    // b misses everywhere.
    engine.recordThrow({ playerId: "b", points: 0 });
    engine.recordThrow({ playerId: "b", points: 0 });
    engine.recordThrow({ playerId: "b", points: 0 });
    // a's turn 2, dart 1: D20 scores 40.
    engine.recordThrow({ playerId: "a", points: 40 });
    const before = engine.getState();
    expect(before.players.find((p) => p.id === "a")?.totalPoints).toBe(80);

    // Correct the scoring D20 into a miss: only the turn-1 scores survive.
    const corrected = engine.correctThrow(6, { points: 0 });
    expect(corrected.players.find((p) => p.id === "a")?.totalPoints).toBe(40);
    expect(corrected.players.find((p) => p.id === "b")?.totalPoints).toBe(0);
    const data = corrected.modeData as CricketModeData;
    expect(data.marks.a?.["20"]).toBe(5); // the closing marks survive
  });

  it("undoes the last dart in an around the clock match and restores the target", () => {
    const engine = new GameEngine(new AroundTheClockMode());
    engine.startMatch({ playerIds: ["a"] });
    engine.recordThrow({ playerId: "a", points: 1 });
    engine.recordThrow({ playerId: "a", points: 2 });
    const afterTwo = engine.getState();
    expect((afterTwo.modeData as AroundTheClockModeData).currentTargetIndex["a"]).toBe(2);

    const restored = engine.undoLastThrow();
    expect((restored.modeData as AroundTheClockModeData).currentTargetIndex["a"]).toBe(1);
    expect((restored.modeData as AroundTheClockModeData).currentTargetIndex).toEqual({ a: 1 });
    expect((restored.modeData as AroundTheClockModeData).playerProgress).toEqual({ a: 1 });
  });

  it("corrects a dart in an around the clock match and restores the target", () => {
    const engine = new GameEngine(new AroundTheClockMode());
    engine.startMatch({ playerIds: ["a"] });
    engine.recordThrow({ playerId: "a", points: 1 });
    engine.recordThrow({ playerId: "a", points: 2 });

    const corrected = engine.correctThrow(1, { points: 0 });
    expect((corrected.modeData as AroundTheClockModeData).currentTargetIndex["a"]).toBe(1);
    expect((corrected.modeData as AroundTheClockModeData).currentTargetIndex).toEqual({ a: 1 });
    // And forward again: re-entering the hit restores the index.
    const restored = engine.correctThrow(1, { points: 2 });
    expect((restored.modeData as AroundTheClockModeData).currentTargetIndex["a"]).toBe(2);
  });

  it("keeps the players' target chains apart when a dart is undone", () => {
    const engine = new GameEngine(new AroundTheClockMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    // a hits 1 and 2 (her own run), then misses with 5; the turn goes to b.
    // 5 is a genuine miss on a's target 3 — 9 would be T3 and a hit.
    engine.recordThrow({ playerId: "a", points: 1 });
    engine.recordThrow({ playerId: "a", points: 2 });
    engine.recordThrow({ playerId: "a", points: 5 });
    // b hits his own target 1.
    engine.recordThrow({ playerId: "b", points: 1 });

    const before = engine.getState().modeData as AroundTheClockModeData;
    expect(before.currentTargetIndex).toEqual({ a: 2, b: 1 });

    // Undoing b's dart gives b his target back — and leaves a's run alone.
    const restored = engine.undoLastThrow();
    const data = restored.modeData as AroundTheClockModeData;
    expect(data.currentTargetIndex).toEqual({ a: 2, b: 0 });
    expect(data.playerProgress).toEqual({ a: 2 });
    expect(restored.players.find((p) => p.id === "a")?.totalPoints).toBe(2);
    expect(restored.players.find((p) => p.id === "b")?.totalPoints).toBe(0);
  });

  it("undoes the last dart in a shanghai match and restores the round", () => {
    const engine = new GameEngine(new ShanghaiMode());
    engine.startMatch({ playerIds: ["a"] });
    engine.recordThrow({ playerId: "a", points: 1 }); // single of target 1
    engine.recordThrow({ playerId: "a", points: 0 });
    engine.recordThrow({ playerId: "a", points: 0 });
    // Round 1 complete (3 darts): the round advances to index 1.
    const afterRound = engine.getState();
    expect((afterRound.modeData as ShanghaiModeData).currentRound).toBe(1);
    expect(afterRound.players.find((p) => p.id === "a")?.totalPoints).toBe(1);

    // Undoing the last dart of round 1 re-derives round 1 in progress.
    const restored = engine.undoLastThrow();
    const data = restored.modeData as ShanghaiModeData;
    expect(data.currentRound).toBe(0);
    expect(data.totalDartsThisRound).toBe(2);
    expect(data.roundRecords?.a).toMatchObject({ hitSingle: true, hitDouble: false });
    expect(restored.players.find((p) => p.id === "a")?.totalPoints).toBe(1);
  });

  it("corrects a dart in a shanghai match and restores the round", () => {
    const engine = new GameEngine(new ShanghaiMode());
    engine.startMatch({ playerIds: ["a"] });
    engine.recordThrow({ playerId: "a", points: 1 });
    engine.recordThrow({ playerId: "a", points: 2 });
    engine.recordThrow({ playerId: "a", points: 0 });

    const corrected = engine.correctThrow(2, { points: 3 }); // the miss was the triple
    const data = corrected.modeData as ShanghaiModeData;
    // Single + double + triple of round 1 = Shanghai: the match ends.
    expect(data.roundRecords?.a).toMatchObject({
      hitSingle: true,
      hitDouble: true,
      hitTriple: true,
    });
    expect(corrected.players.find((p) => p.id === "a")?.totalPoints).toBe(6);
    expect(corrected.status).toBe("completed");
    expect(corrected.currentPlayerId).toBeNull();
  });

  it("undoes the last dart in a neutral match and restores the score", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    // A turn is three darts; b's turn only starts after a's three.
    for (const points of [20, 20, 20]) {
      engine.recordThrow({ playerId: "a", points });
    }
    engine.recordThrow({ playerId: "b", points: 15 });
    const restored = engine.undoLastThrow();
    expect(restored.players.find((p) => p.id === "b")?.totalPoints).toBe(0);
    expect(restored.players.find((p) => p.id === "a")?.totalPoints).toBe(60);
    expect(restored.currentPlayerId).toBe("b");
  });

  it("undoes a dart recorded by a second player", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    for (const points of [10, 10, 10]) {
      engine.recordThrow({ playerId: "a", points });
    }
    for (const points of [12, 12, 12]) {
      engine.recordThrow({ playerId: "b", points });
    }
    // a's second visit, first dart — the last dart of the ledger.
    engine.recordThrow({ playerId: "a", points: 5 });
    const before = engine.getState();

    const restored = engine.undoLastThrow();
    expect(restored.currentPlayerId).toBe("a");
    expect(restored.throws).toHaveLength(6);
    expect(restored.throws.map((dart) => dart.playerId)).toEqual(["a", "a", "a", "b", "b", "b"]);
    expect(before.throws).toHaveLength(7);
  });

  it("undoes a dart that won a leg and restores the leg count", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 30 }));
    engine.startMatch({ playerIds: ["a"], outRule: "double", legs: 5 });
    engine.recordThrow({ playerId: "a", points: 20 });
    const beforeWinning = engine.getState();
    engine.recordThrow({ playerId: "a", points: 10, segment: "double" }); // wins leg 1
    const after = engine.getState();
    expect(legSet(after)?.legsWon).toEqual({ a: 1 });

    const restored = engine.undoLastThrow();
    expect(restored).toEqual(beforeWinning);
    expect(legSet(restored)?.legsWon ?? {}).toEqual({});
    expect(restored.players.find((p) => p.id === "a")?.totalPoints).toBe(10);
    expect(restored.currentPlayerId).toBe("a");
  });

  it("corrects a dart that wins the leg and restores the leg count", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 30 }));
    engine.startMatch({ playerIds: ["a"], outRule: "double", legs: 5 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 10, segment: "double" }); // wins leg 1
    const after = engine.getState();
    expect(legSet(after)?.legsWon).toEqual({ a: 1 });

    // The winning dart was actually a miss: the leg is un-won and stays live.
    const corrected = engine.correctThrow(1, { points: 0 });
    expect(legSet(corrected)?.legsWon ?? {}).toEqual({});
    expect(corrected.status).toBe("inProgress");
    expect(corrected.players.find((p) => p.id === "a")?.totalPoints).toBe(10);
  });

  it("keeps the match state JSON-safe after an undo", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 120 }));
    engine.startMatch({ playerIds: ["a", "b"], outRule: "double" });
    engine.recordThrow({ playerId: "a", points: 40, segment: "double" });
    engine.recordThrow({ playerId: "a", points: 60, segment: "triple" });
    const restored = engine.undoLastThrow();
    expectJsonSafe(restored);
  });

  it("keeps the match state JSON-safe after a correction", () => {
    const engine = new GameEngine(new CricketMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 60, segment: "triple" });
    const corrected = engine.correctThrow(0, { points: 50, segment: "bull" });
    expectJsonSafe(corrected);
  });

  it("refuses a correction on a completed match without touching the state", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 30 }));
    engine.startMatch({ playerIds: ["a"], outRule: "double" });
    engine.recordThrow({ playerId: "a", points: 30, segment: "double" });
    expect(engine.getState().status).toBe("completed");
    const before = engine.getState();
    expect(() => engine.correctThrow(0, { points: 0 })).toThrow(GameEngineStateError);
    expect(engine.getState()).toEqual(before);
  });
});

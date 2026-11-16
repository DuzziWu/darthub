import { describe, it, expect } from "vitest";
// The public entry point, not the module inside the engine: a caller
// outside the engine must reach the helper through the barrel alone.
import { DARTS_PER_TURN, deriveTurnIndexes } from "@/game-engine";
import { deriveTurnIndexes as deriveTurnIndexesFromModule } from "@/game-engine/throwLedger";
import type { RecordedThrow } from "@/game-engine";

/** Builds a ledger entry without a segment. */
function dart(playerId: string, points: number, bust = false): RecordedThrow {
  return { playerId, points, bust };
}

describe("deriveTurnIndexes — public API of the barrel", () => {
  it("is reachable through the public entry point", () => {
    expect(typeof deriveTurnIndexes).toBe("function");
    expect(deriveTurnIndexes).toHaveLength(2);
    // The barrel re-exports the implementation itself, not a copy of it.
    expect(deriveTurnIndexes).toBe(deriveTurnIndexesFromModule);
  });

  it("numbers the turns of a ledger without busts", () => {
    const ledger = [
      dart("alice", 20),
      dart("alice", 20),
      dart("alice", 20),
      dart("bob", 20),
      dart("bob", 20),
      dart("bob", 20),
    ];

    // Three counted darts fill a turn: alice's darts are turn 0, bob's
    // darts are turn 1.
    expect(deriveTurnIndexes(ledger, DARTS_PER_TURN)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("counts a bust as a dart of its turn without spending a dart slot", () => {
    const ledger = [
      dart("alice", 20),
      dart("alice", 20),
      dart("alice", 20),
      dart("alice", 30, true), // the bust opens the next turn
      dart("alice", 20),
      dart("alice", 20),
      dart("alice", 20),
      dart("bob", 20),
    ];

    // The bust opens turn 1 and spends no dart slot, so the three darts
    // after it still belong to turn 1. Bob's first dart opens turn 2.
    expect(deriveTurnIndexes(ledger, DARTS_PER_TURN)).toEqual([0, 0, 0, 1, 1, 1, 1, 2]);
  });

  it("keeps a bust inside the turn it was thrown in", () => {
    const ledger = [
      dart("alice", 20),
      dart("alice", 20),
      dart("alice", 30, true), // the bust, in the middle of the turn
      dart("alice", 20),
      dart("bob", 20),
      dart("bob", 20),
      dart("bob", 20),
    ];

    // The bust spends no dart slot, so alice's turn is still turn 0 — it
    // holds two counted darts and the bust — and bob's turn is turn 1.
    expect(deriveTurnIndexes(ledger, DARTS_PER_TURN)).toEqual([0, 0, 0, 0, 1, 1, 1]);
  });

  it("returns an empty array for an empty ledger", () => {
    expect(deriveTurnIndexes([], DARTS_PER_TURN)).toEqual([]);
  });

  it("does not mutate the ledger it derives from", () => {
    const ledger = [dart("alice", 20), dart("alice", 20), dart("alice", 20)];

    const turns = deriveTurnIndexes(ledger, DARTS_PER_TURN);
    turns.push(99);

    expect(ledger).toHaveLength(3);
  });
});

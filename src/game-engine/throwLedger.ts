import type { MatchVisit, RecordedThrow } from "@/game-engine/types";

/**
 * The ledger of the game engine: the darts the players entered.
 *
 * The helpers here derive the visit structure from that ledger. The
 * boundaries are never stored on a dart: a correction changes them, so a
 * stored boundary would go stale. They are re-derived whenever the match
 * state is derived.
 */

/**
 * A visit ends when the turn advances and when a dart busts.
 *
 * A bust ends the visit even though the turn goes on — the player throws
 * the next dart of the same turn, but the busted dart closes the group
 * the views show as one chip row.
 *
 * @param throws the ledger, oldest first
 * @param dartsPerTurn the darts a turn holds
 * @returns the visit index of each dart, oldest first
 */
export function deriveVisitIndexes(
  throws: readonly RecordedThrow[],
  dartsPerTurn: number,
): number[] {
  const indexes: number[] = [];
  let visitIndex = 0;
  let countedInTurn = 0;
  let previousBusted = false;

  throws.forEach((dart, position) => {
    if (position > 0 && (previousBusted || countedInTurn === 0)) {
      visitIndex += 1;
    }
    indexes.push(visitIndex);

    if (dart.bust) {
      // A bust counts for nothing, so it consumes no dart slot.
      previousBusted = true;
    } else {
      countedInTurn = (countedInTurn + 1) % dartsPerTurn;
      previousBusted = false;
    }
  });

  return indexes;
}

/**
 * Groups the ledger into visits.
 *
 * @param throws the ledger, oldest first
 * @param dartsPerTurn the darts a turn holds
 * @returns the visits, oldest first
 */
export function groupVisits(throws: readonly RecordedThrow[], dartsPerTurn: number): MatchVisit[] {
  const indexes = deriveVisitIndexes(throws, dartsPerTurn);
  const visits: MatchVisit[] = [];

  throws.forEach((dart, position) => {
    const index = indexes[position]!;
    const current = visits[index];
    if (current === undefined) {
      visits[index] = { index, playerId: dart.playerId, throws: [dart] };
      return;
    }
    visits[index] = { ...current, throws: [...current.throws, dart] };
  });

  return visits;
}

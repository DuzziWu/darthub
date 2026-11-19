import type { MatchVisit, RecordedThrow } from "@/game-engine/types";

/**
 * The ledger of the game engine: the darts the players entered.
 *
 * The helpers here derive the visit structure and the turn in progress
 * from that ledger. The boundaries are never stored on a dart: a
 * correction changes them, so a stored boundary would go stale. They are
 * re-derived whenever the match state is derived.
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
 * Derives the darts of the turn in progress: the darts the player whose
 * turn it is has thrown since that turn started.
 *
 * The turn is not the visit. The visit is the group of darts the match
 * views show as one chip row, and it ends when a dart busts. The turn is
 * the group of darts of one player, and it ends when the player changes.
 *
 * Like the visit boundaries, the turn boundary is never stored: a
 * correction changes it, so a stored boundary would go stale. It is
 * derived from the ledger and the current player instead.
 *
 * A bust belongs to the turn — the player threw it — but it consumes no
 * dart slot: the turn goes on, and the bust fills none of the
 * `dartsPerTurn` places. The result is therefore the longest run of darts
 * at the end of the ledger that belongs to the current player and holds
 * at most `dartsPerTurn` counted darts; a bust inside that run is part
 * of it.
 *
 * @param throws the ledger, oldest first
 * @param currentPlayerId the player whose turn it is, or null when the
 *   match is over
 * @param dartsPerTurn the darts a turn holds
 * @returns the darts of the turn, oldest first
 */
export function deriveTurnThrows(
  throws: readonly RecordedThrow[],
  currentPlayerId: string | null,
  dartsPerTurn: number,
): RecordedThrow[] {
  if (currentPlayerId === null) {
    return [];
  }

  const turn: RecordedThrow[] = [];
  let countedDarts = 0;

  for (let position = throws.length - 1; position >= 0; position -= 1) {
    const dart = throws[position]!;
    if (dart.playerId !== currentPlayerId) {
      // The player changed: the turn ended there.
      break;
    }
    if (!dart.bust) {
      if (countedDarts >= dartsPerTurn) {
        // The turn already holds its darts; everything older belongs to
        // an earlier turn of the same player.
        break;
      }
      countedDarts += 1;
    }
    // A bust is a dart of the turn, but it spends no dart slot, so the
    // walk continues past it.
    turn.push(dart);
  }

  return turn.reverse();
}

/**
 * The turn each dart of the ledger belongs to.
 *
 * A turn holds `dartsPerTurn` counted darts, and a bust consumes no slot
 * — so the turn of a dart is the number of counted darts before it,
 * rounded down to the turn it fills.
 *
 * The visits say the same thing: a visit ends when the turn advances and
 * when a dart busts, and every visit boundary is exactly one of the two
 * — a dart is either a bust or the dart that fills the turn, never both.
 * The turn of a dart is therefore its visit minus the busts that came
 * before it.
 *
 * @param throws the ledger, oldest first
 * @param dartsPerTurn the darts a turn holds
 * @returns the turn index of each dart, oldest first
 */
export function deriveTurnIndexes(
  throws: readonly RecordedThrow[],
  dartsPerTurn: number,
): number[] {
  const visits = deriveVisitIndexes(throws, dartsPerTurn);
  const turns: number[] = [];
  let busts = 0;

  throws.forEach((dart, index) => {
    turns.push(visits[index]! - busts);
    if (dart.bust) {
      busts += 1;
    }
  });

  return turns;
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

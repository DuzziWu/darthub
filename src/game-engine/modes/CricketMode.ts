import type { DartGameMode, MatchState, MutableMatchState, ThrowRecord } from "@/game-engine/types";

/** Target numbers of standard cricket, bullseye (25) included. */
export const CRICKET_TARGETS: readonly number[] = [20, 19, 18, 17, 16, 15, 25];

/** Segment value of the bullseye. */
export const CRICKET_BULL = 25;

/** Marks needed to close a number. */
export const MARKS_TO_CLOSE = 3;

/**
 * Mode-owned state slice persisted in `MatchState.modeData`: how many
 * marks every player has on every cricket target. JSON-safe by design.
 */
export type CricketModeData = {
  marks: Record<string, Record<string, number>>;
};

/** Where a dart lands in terms of cricket marks. */
interface SegmentHit {
  readonly target: number;
  readonly marks: number;
}

/** Segment values (single/double/triple) that map onto cricket targets. */
function toSegmentHit(points: number): SegmentHit | null {
  if (points === CRICKET_BULL) {
    return { target: CRICKET_BULL, marks: 1 };
  }
  if (points === 2 * CRICKET_BULL) {
    return { target: CRICKET_BULL, marks: 2 };
  }
  for (const target of CRICKET_TARGETS) {
    if (target === CRICKET_BULL) {
      continue;
    }
    if (points === target) {
      return { target, marks: 1 };
    }
    if (points === 2 * target) {
      return { target, marks: 2 };
    }
    if (points === 3 * target) {
      return { target, marks: 3 };
    }
  }
  return null;
}

/** Points a scoring dart is worth: segment value per mark (bull = 25). */
function pointsFor(hit: SegmentHit): number {
  return hit.marks * hit.target;
}

/**
 * Cricket game mode.
 *
 * Every player tracks marks on 20, 19, 18, 17, 16, 15 and the bull.
 * Numbers close at {@link MARKS_TO_CLOSE} marks; a single triple, double
 * bull (50 -> 2 marks) or any combination of darts can close a number.
 *
 * Standard scoring (not cut-throat): a dart scores
 * {@link pointsFor} points for the thrower when the thrower had the
 * number closed *before* the dart was thrown and at least one opponent
 * still has it open. The dart that closes a number does not score.
 */
export class CricketMode implements DartGameMode {
  readonly id = "cricket";

  initializeMatch(draft: MutableMatchState): void {
    const marks: Record<string, Record<string, number>> = {};
    for (const player of draft.players) {
      marks[player.id] = emptyTargetMarks();
    }
    draft.modeData = { marks } satisfies CricketModeData;
  }

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void {
    const data = requireCricketData(draft);
    const hit = toSegmentHit(throwRecord.points);
    if (hit === null) {
      return;
    }
    const playerMarks = data.marks[throwRecord.playerId];
    if (!playerMarks) {
      return;
    }
    const key = String(hit.target);
    const marksBefore = playerMarks[key] ?? 0;
    playerMarks[key] = marksBefore + hit.marks;
    awardPointsIfScoring(draft, data, throwRecord.playerId, hit, marksBefore >= MARKS_TO_CLOSE);
  }

  isMatchComplete(state: MatchState): boolean {
    return getCricketWinnerId(state) !== null;
  }
}

/**
 * Awards the dart's points to the thrower when the number was already
 * closed for the thrower before this dart and at least one opponent
 * still has it open (the closing dart itself never scores).
 */
function awardPointsIfScoring(
  draft: MutableMatchState,
  data: CricketModeData,
  throwingPlayerId: string,
  hit: SegmentHit,
  wasAlreadyClosed: boolean,
): void {
  if (!wasAlreadyClosed || !hasOpenOpponent(draft, throwingPlayerId, data, hit.target)) {
    return;
  }
  const player = draft.players.find((candidate) => candidate.id === throwingPlayerId);
  if (player) {
    player.totalPoints += pointsFor(hit);
  }
}

/** True when every cricket target is closed for the player. */
function hasClosedAllNumbers(data: CricketModeData, playerId: string): boolean {
  const playerMarks = data.marks[playerId];
  if (!playerMarks) {
    return false;
  }
  return CRICKET_TARGETS.every((target) => (playerMarks[String(target)] ?? 0) >= MARKS_TO_CLOSE);
}

/**
 * Returns the cricket winner, or null while nobody has won.
 *
 * A player wins (only) by closing every number while holding a score
 * at least as high as every remaining opponent's score. A player who
 * closes everything while trailing on points does not win yet and the
 * match continues.
 */
export function getCricketWinnerId(state: MatchState): string | null {
  const data = state.modeData as CricketModeData | undefined;
  if (!data?.marks) {
    return null;
  }
  for (const player of state.players) {
    if (!hasClosedAllNumbers(data, player.id)) {
      continue;
    }
    const stillBeatenBy = state.players.filter(
      (other) => other.id !== player.id && other.totalPoints > player.totalPoints,
    );
    if (stillBeatenBy.length === 0) {
      return player.id;
    }
  }
  return null;
}

/** True when at least one other player still has the target open. */
function hasOpenOpponent(
  draft: MutableMatchState,
  throwingPlayerId: string,
  data: CricketModeData,
  target: number,
): boolean {
  const targetKey = String(target);
  return draft.players.some((player) => {
    if (player.id === throwingPlayerId) {
      return false;
    }
    return (data.marks[player.id]?.[targetKey] ?? 0) < MARKS_TO_CLOSE;
  });
}

function emptyTargetMarks(): Record<string, number> {
  const marks: Record<string, number> = {};
  for (const target of CRICKET_TARGETS) {
    marks[String(target)] = 0;
  }
  return marks;
}

/** Reads (or lazily creates) this mode's state slice inside the draft. */
function requireCricketData(draft: MutableMatchState): CricketModeData {
  const existing = draft.modeData as CricketModeData | undefined;
  if (existing && existing.marks) {
    return existing;
  }
  const created: CricketModeData = { marks: {} };
  draft.modeData = created;
  return created;
}

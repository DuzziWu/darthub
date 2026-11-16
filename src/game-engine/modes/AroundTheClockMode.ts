import type { DartGameMode, MatchState, MutableMatchState, ThrowRecord } from "@/game-engine/types";

/** Targets in order: 1-20 then bullseye (25). */
export const AROUND_THE_CLOCK_TARGETS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];

/** Mode-owned state: the per-player target index and the per-player progress. */
export type AroundTheClockModeData = {
  /** Per-player: how many targets this player has personally hit. */
  playerProgress: Record<string, number>;
  /** Per-player: the index of the target this player is aiming at. */
  currentTargetIndex: Record<string, number>;
};

/**
 * "Around the Clock" dart game.
 *
 * Every player has their **own** target: the players must hit the
 * targets 1 to 20 and then the bullseye (25), each in their own order.
 * A dart scores only when it lands on the target the thrower is aiming
 * at (single, double or triple all count as one hit). Missing the
 * current target does not advance progress, and it never moves another
 * player's target either. The player who hits all 21 targets first wins
 * the match.
 */
export class AroundTheClockMode implements DartGameMode {
  readonly id = "around-the-clock";

  initializeMatch(draft: MutableMatchState): void {
    const currentTargetIndex: Record<string, number> = {};
    for (const player of draft.players) {
      player.totalPoints = 0;
      currentTargetIndex[player.id] = 0;
    }
    draft.modeData = {
      currentTargetIndex,
      playerProgress: {},
    } satisfies AroundTheClockModeData;
  }

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void {
    const data = requireModeData(draft);

    const player = draft.players.find((p) => p.id === throwRecord.playerId);
    if (!player) {
      return;
    }

    // The thrower's own target — never anybody else's.
    const index = data.currentTargetIndex[throwRecord.playerId] ?? 0;
    if (index >= AROUND_THE_CLOCK_TARGETS.length) {
      return;
    }

    const target = AROUND_THE_CLOCK_TARGETS[index]!;

    if (!hitsTarget(throwRecord.points, target)) {
      // A miss consumes the dart, but it leaves the thrower's target — and
      // every other player's target — exactly where it was.
      return;
    }

    // Record this player's personal progress.
    data.playerProgress[throwRecord.playerId] = index + 1;
    player.totalPoints = index + 1;
    data.currentTargetIndex[throwRecord.playerId] = index + 1;
    draft.modeData = structuredClone(data);
  }

  isMatchComplete(state: MatchState): boolean {
    // The completion rule lives in the mode's own winner accessor, so the
    // view and the engine cannot disagree about a finished match.
    return getAroundTheClockWinnerId(state) !== null;
  }
}

/**
 * The player who has cleared every target, if there is one.
 *
 * The single source of truth for "who won": the mode's completion rule and
 * the view's result banner both read it from here, so the two can never
 * disagree about a finished match.
 */
export function getAroundTheClockWinnerId(state: MatchState): string | null {
  const data = state.modeData as AroundTheClockModeData | undefined;
  if (!data || !data.currentTargetIndex || typeof data.currentTargetIndex !== "object") {
    // No mode data yet, or a snapshot persisted by an older version that
    // carried a single shared index: nobody has cleared the targets.
    // The truthiness check comes before the type test, because
    // `typeof null === "object"`.
    return null;
  }
  // The match ends when ONE player has cleared every target. The rule is
  // the mode's own: its class doc states it ("The player who hits all 21
  // targets first wins the match"), and the registry publishes the win
  // condition of the mode ("Hit every target in order",
  // src/game-engine/modes/registry.ts:168) — the targets, in order. A rule
  // that required EVERY player to finish would make a two-player match
  // un-endable.
  const winner = state.players.find(
    (player) => (data.currentTargetIndex[player.id] ?? 0) >= AROUND_THE_CLOCK_TARGETS.length,
  );
  return winner?.id ?? null;
}

/**
 * Returns true when the thrown points count as hitting the given target
 * number for Around the Clock purposes. Doubles and triples of the target
 * also count. For the bullseye (25), both 25 and 50 (double bull) count.
 */
function hitsTarget(points: number, target: number): boolean {
  if (points === target) {
    return true;
  }
  if (points === 2 * target) {
    return true;
  }
  if (points === 3 * target) {
    return true;
  }
  return false;
}

function requireModeData(draft: MutableMatchState): AroundTheClockModeData {
  const existing = draft.modeData as AroundTheClockModeData | undefined;
  if (
    existing &&
    existing.currentTargetIndex &&
    typeof existing.currentTargetIndex === "object" &&
    existing.playerProgress &&
    typeof existing.playerProgress === "object"
  ) {
    return existing;
  }
  // A slice that is missing or malformed — e.g. one persisted by an older
  // version that carried a single shared index, or one whose progress map
  // is missing — is re-seeded instead of being dereferenced. The seed
  // follows the score the players already hold: in this mode a player's
  // totalPoints IS the number of targets they have hit, so the maps and
  // the scores agree after the re-seed.
  const currentTargetIndex: Record<string, number> = {};
  const playerProgress: Record<string, number> = {};
  for (const player of draft.players) {
    const hits = Math.max(0, player.totalPoints);
    currentTargetIndex[player.id] = hits;
    playerProgress[player.id] = hits;
  }
  const created: AroundTheClockModeData = { currentTargetIndex, playerProgress };
  draft.modeData = created;
  return created;
}

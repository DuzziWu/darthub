import type { DartGameMode, MatchState, MutableMatchState, ThrowRecord } from "@/game-engine/types";

/**
 * Neutral default mode: every throw simply adds its points to the
 * throwing player's total, and the match never ends on its own.
 *
 * It exists so the core engine has a working scoring rule out of the
 * box while concrete modes (501, Cricket, ...) plug in via the
 * {@link DartGameMode} seam.
 */
export class NeutralScoreMode implements DartGameMode {
  readonly id = "neutral";

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void {
    const player = draft.players.find((p) => p.id === throwRecord.playerId);
    if (player) {
      player.totalPoints += throwRecord.points;
    }
  }

  isMatchComplete(_state: MatchState): boolean {
    return false;
  }
}

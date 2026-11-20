"use client";

import { useCallback, useState } from "react";
import { DARTS_PER_TURN, deriveTurnThrows, deriveVisitIndexes } from "@/game-engine";
import type { GameEngine } from "@/game-engine/GameEngine";
import type { MatchState, RecordedThrow, ThrowSegment } from "@/game-engine/types";

/**
 * The shared throw-history logic of the match views.
 *
 * The view owns the engine and the match state; this hook owns only the
 * correction flow on top of it — which dart is armed as the correction
 * target, whether a finished visit needs explicit confirmation, and the
 * routing of the pad's value to `correctThrow` instead of `recordThrow`.
 *
 * Every rule (busts, refusals, audit) stays in the engine. Refusals are
 * re-thrown to the caller, which surfaces them as its message; the armed
 * target stays armed so the player can enter the replacement again.
 */
export function useMatchHistory(options: {
  engine: GameEngine | null;
  matchState: MatchState | null;
}) {
  const { engine, matchState } = options;
  const [correctionTarget, setCorrectionTarget] = useState<number | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // Whether the history shows every visit of the match or only the one in
  // progress. A whole evening of darts would be unreadable as one wall of
  // chips, so the short list is the default.
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const throws = matchState?.throws ?? [];
  const visits = engine !== null && throws.length > 0 ? engine.getVisits() : [];
  const currentVisit: readonly RecordedThrow[] = visits.at(-1)?.throws ?? [];
  /**
   * The darts of the turn in progress.
   *
   * The turn is not the visit. A visit is the group the ledger shows as one
   * chip row and it runs over the player change, so after three darts the
   * last visit holds the *previous* player's darts while the next player is
   * already on throw. The input area shows the turn instead: the darts of
   * the player who is throwing, which is empty right after a player change
   * — the reset the overview needs.
   *
   * The boundary is derived from the ledger, never kept in the view, so it
   * cannot go stale after a correction or an undo.
   */
  const currentTurn: readonly RecordedThrow[] = deriveTurnThrows(
    throws,
    matchState?.currentPlayerId ?? null,
    DARTS_PER_TURN,
  );
  /**
   * Where the visit in progress starts in the ledger.
   *
   * The strip shows one visit, but the engine indexes the whole ledger. A
   * chip's position in the strip is therefore not its index in the ledger,
   * and the two differ from the second visit on.
   */
  const currentVisitOffset = Math.max(0, throws.length - currentVisit.length);
  /**
   * Where the turn in progress starts in the ledger.
   *
   * The same mapping as {@link currentVisitOffset}, but for the turn: a
   * chip's position in the tracker is not its index in the ledger.
   */
  const currentTurnOffset = Math.max(0, throws.length - currentTurn.length);
  const canUndo = throws.length > 0;
  /**
   * The dart the correction targets, straight from the ledger.
   *
   * The turn holds only the darts of the turn in progress, so a dart of an
   * earlier visit is not in it. The ledger has every dart, so the status
   * line can name the one that is about to be replaced.
   */
  const armedDart: RecordedThrow | null =
    correctionTarget === null ? null : (throws[correctionTarget] ?? null);

  const selectThrow = useCallback(
    (dartIndex: number) => {
      if (!engine || !matchState || dartIndex >= matchState.throws.length) return;
      const visitIndexes = deriveVisitIndexes(matchState.throws, DARTS_PER_TURN);
      const inCurrentVisit = visitIndexes[dartIndex] === Math.max(...visitIndexes);
      setCorrectionTarget(dartIndex);
      setAwaitingConfirmation(!inCurrentVisit);
    },
    [engine, matchState],
  );

  const confirmCorrection = useCallback(() => {
    setAwaitingConfirmation(false);
  }, []);

  const cancelCorrection = useCallback(() => {
    setCorrectionTarget(null);
    setAwaitingConfirmation(false);
  }, []);

  const submitThrow = useCallback(
    (input: { points: number; segment?: ThrowSegment }) => {
      if (!engine || !matchState) return null;
      const playerId = matchState.currentPlayerId ?? "";
      // A miss carries no segment: the engine rejects a segment on a
      // zero-scoring throw.
      const throwInput = input.points > 0 ? input : { points: input.points };
      if (correctionTarget !== null) {
        const state = engine.correctThrow(correctionTarget, throwInput);
        setCorrectionTarget(null);
        setAwaitingConfirmation(false);
        return state;
      }
      return engine.recordThrow({ playerId, ...throwInput });
    },
    [engine, matchState, correctionTarget],
  );

  const undo = useCallback(() => {
    if (!engine) return null;
    setCorrectionTarget(null);
    setAwaitingConfirmation(false);
    return engine.undoLastThrow();
  }, [engine]);

  return {
    currentVisit,
    currentVisitOffset,
    currentTurn,
    currentTurnOffset,
    /**
     * Every visit of the match, oldest first.
     *
     * The list comes from the engine, so it cannot drift from the ledger: a
     * correction rewrites the ledger and the engine regroups it.
     */
    visits,
    canUndo,
    correctionTarget,
    armedDart,
    awaitingConfirmation,
    historyExpanded,
    toggleHistory: () => setHistoryExpanded((open) => !open),
    selectThrow,
    confirmCorrection,
    cancelCorrection,
    submitThrow,
    undo,
  };
}

"use client";

import { useCallback, useState } from "react";
import { DARTS_PER_TURN, deriveVisitIndexes } from "@/game-engine";
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

  const throws = matchState?.throws ?? [];
  const visits = engine !== null && throws.length > 0 ? engine.getVisits() : [];
  const currentVisit: readonly RecordedThrow[] = visits.at(-1)?.throws ?? [];
  /**
   * Where the visit in progress starts in the ledger.
   *
   * The strip shows one visit, but the engine indexes the whole ledger. A
   * chip's position in the strip is therefore not its index in the ledger,
   * and the two differ from the second visit on.
   */
  const currentVisitOffset = Math.max(0, throws.length - currentVisit.length);
  const canUndo = throws.length > 0;

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
    canUndo,
    correctionTarget,
    awaitingConfirmation,
    selectThrow,
    confirmCorrection,
    cancelCorrection,
    submitThrow,
    undo,
  };
}

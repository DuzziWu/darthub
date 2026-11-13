"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { withBasePath } from "@/lib/basePath";
import { boardSourceLabel, type BoardSourceId } from "@/board";
import type { ArmedSegment } from "@/components/board";
import { GameResultBanner } from "@/components/game/GameResultBanner";
import { MatchLayout } from "@/components/game/MatchLayout";
import { MatchStatus } from "@/components/game/MatchStatus";
import { PlayerSetup } from "@/components/game/PlayerSetup";
import { ScoreDisplay } from "@/components/game/ScoreDisplay";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";
import { ThrowHistoryControls } from "@/components/game/ThrowHistoryControls";
import { visitBadge } from "@/components/game/VisitChips";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import type { PlayerSetupOptions } from "@/components/game/types";
import { useMatchHistory } from "@/components/game/useMatchHistory";
import { useInputMode } from "@/components/game/useInputMode";
import { GameEngine } from "@/game-engine/GameEngine";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { OUT_RULE_CHOICES } from "@/game-engine/modes/registry";
import { getOutRule, type OutRule } from "@/game-engine/rules";
import {
  GameEngineStateError,
  type MatchState,
  type OutRuleId,
  type ThrowSegment,
} from "@/game-engine/types";

/**
 * The x01 match view: the board on one side, the score sheet on the other,
 * the visit along the top.
 *
 * It owns the state that belongs to the match rather than to any one
 * component:
 *
 * - the **armed band** (`1×` / `2×` / `3×`), which the dart pad owns and the
 *   board reads, so the two surfaces are two views of one thing;
 * - the **visit** and the **bust record**, which the engine's ledger owns:
 *   a busting dart lands in the ledger and counts for nothing, so the strip,
 *   the score sheet, the undo button and the correction flow all read the
 *   same record. The view keeps no second copy of the darts.
 */
export interface X01MatchViewProps {
  /** The score every player starts from, e.g. 501. */
  readonly startScore: number;
  /** The mode's name on the sheet, e.g. "501". */
  readonly modeName: string;
}

/** The label of the checkout rule, from the registry's own vocabulary. */
function checkoutLabel(outRule: OutRuleId): string {
  return OUT_RULE_CHOICES.find((choice) => choice.id === outRule)?.label ?? "Checkout";
}

/**
 * Whether a dart busts under the rule in force.
 *
 * The engine reports a bust by throwing, and it reports "not your turn" the
 * same way — so the view decides for itself, from the rule, the score
 * before the dart and the dart itself. The rule's own predicates answer the
 * two questions that matter: may this dart finish the leg, and does it
 * strand the player?
 */
export function isBustThrow(
  rule: OutRule,
  remaining: number,
  points: number,
  segment?: ThrowSegment,
): boolean {
  const next = remaining - points;
  if (next < 0) return true;
  if (next === 0 && !rule.isCheckout(segment, points)) return true;
  return rule.isStrandedBust(next);
}

/** True below the md breakpoint, where the board is a preview, not an input. */
export function X01MatchView({ startScore, modeName }: X01MatchViewProps) {
  const router = useRouter();

  const [phase, setPhase] = useState<"setup" | "playing" | "result">("setup");
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [outRule, setOutRule] = useState<OutRuleId>("double");
  const [boardSource, setBoardSource] = useState<BoardSourceId>("virtual");
  const [armedSegment, setArmedSegment] = useState<ArmedSegment>("single");
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The engine's ledger is the only record of the darts; the strip, the
  // score sheet, the undo button and the correction flow all read from it.
  const history = useMatchHistory({ engine, matchState });
  const inputMode = useInputMode();

  const startMatch = useCallback(
    (names: string[], options: PlayerSetupOptions) => {
      // The mode carries no rule of its own: the rule the player chose
      // travels with the match configuration, so the choice governs.
      const mode = new StandardMode({ startScore });
      const nextEngine = new GameEngine(mode);
      const playerIds = names.map((_, index) => `player${index + 1}`);
      const state = nextEngine.startMatch({ playerIds, outRule: options.outRule });

      const namesById: Record<string, string> = {};
      playerIds.forEach((id, index) => {
        namesById[id] = names[index] ?? id;
      });

      setEngine(nextEngine);
      setMatchState(state);
      setPlayerNames(namesById);
      setOutRule(options.outRule);
      setBoardSource(options.boardSource);
      setWinnerId(null);
      setAnnouncement("");
      setPhase("playing");
    },
    [startScore],
  );

  const recordThrow = useCallback(
    (input: { points: number; segment?: ThrowSegment }) => {
      if (!engine || !matchState || matchState.status === "completed") return;
      const playerId = matchState.currentPlayerId;
      if (!playerId) return;

      const remainingBefore =
        matchState.players.find((player) => player.id === playerId)?.totalPoints ?? 0;
      // A miss carries no segment: the engine rejects a segment on a
      // zero-scoring throw.
      const segment = input.points > 0 ? input.segment : undefined;
      const bust = isBustThrow(getOutRule(outRule), remainingBefore, input.points, segment);

      try {
        // The hook owns the correction flow: with an armed target it
        // replaces that dart, otherwise it records a new one. A miss
        // carries no segment at all: the engine rejects a segment on a
        // zero-scoring throw.
        const state = history.submitThrow({ points: input.points, segment });
        if (!state) return;
        const remainingAfter =
          state.players.find((player) => player.id === playerId)?.totalPoints ?? remainingBefore;

        setMatchState(state);
        setAnnouncement(
          `${visitBadge({ points: input.points, segment })}, ${input.points} points. ${remainingAfter} remaining.`,
        );

        if (state.status === "completed") {
          setWinnerId(playerId);
          setPhase("result");
        }
      } catch (error) {
        if (bust && error instanceof GameEngineStateError) {
          // A bust counts for nothing but is still entered in the ledger,
          // so the strip shows it from there.
          setMatchState(engine.getState());
          setAnnouncement(`Bust. ${remainingBefore} remaining.`);
        } else {
          setAnnouncement(error instanceof Error ? error.message : "Invalid throw");
          setMatchState(engine.getState());
        }
      }
    },
    [engine, matchState, outRule, history],
  );

  const handleBoardThrow = useCallback(
    (hit: { points: number; segment: ThrowSegment | null; label: string }) => {
      recordThrow({ points: hit.points, segment: hit.segment ?? undefined });
    },
    [recordThrow],
  );

  const handleUndo = useCallback(() => {
    if (!engine) return;
    const state = history.undo();
    if (state) {
      setMatchState(state);
      setWinnerId(null);
      setAnnouncement("Last dart removed.");
      setPhase("playing");
    }
  }, [engine, history]);

  const playAgain = useCallback(() => {
    const names = Object.entries(playerNames).map(([, name]) => name);
    startMatch(names, { outRule, boardSource });
  }, [boardSource, outRule, playerNames, startMatch]);

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-[1440px] py-2xl">
        <PlayerSetup
          modeName={modeName}
          modeDescription={`Classic x01 — start at ${startScore} and count down to zero. The checkout rule is chosen below.`}
          modeIcon={Target}
          minPlayers={1}
          maxPlayers={4}
          onStart={startMatch}
        />
      </div>
    );
  }

  if (phase === "result" && matchState) {
    return (
      <div className="mx-auto max-w-[1440px] py-2xl">
        <GameResultBanner
          winnerId={winnerId}
          players={[...matchState.players]}
          playerNames={playerNames}
          onPlayAgain={playAgain}
          onBackToHub={() => router.push(withBasePath("/game-center"))}
        />
      </div>
    );
  }

  const currentPlayerId = matchState?.currentPlayerId ?? null;
  // The strip follows the player who just threw, so the darts of the visit in
  // play stay on screen when the turn passes.
  // The darts of the visit in progress, straight from the ledger.
  const strip = history.currentVisit;

  return (
    <MatchLayout
      input={
        <ThrowInputPad
          throwsInCurrentTurn={matchState?.throwsInCurrentTurn ?? 0}
          armedSegment={armedSegment}
          onArmedSegmentChange={setArmedSegment}
          onThrow={recordThrow}
          disabled={matchState?.status === "completed"}
        />
      }
      inputMode={inputMode.mode}
      onInputModeChange={inputMode.onChange}
      modeName={modeName}
      badge={checkoutLabel(outRule)}
      sourceLabel={boardSourceLabel(boardSource)}
      visit={
        <ThrowHistoryControls
          throws={strip}
          visitOffset={history.currentVisitOffset}
          correctionTarget={history.correctionTarget}
          awaitingConfirmation={history.awaitingConfirmation}
          canUndo={history.canUndo}
          correctionsDisabled={matchState?.status === "completed"}
          onSelectThrow={history.selectThrow}
          onUndo={handleUndo}
          onConfirm={history.confirmCorrection}
          onCancel={history.cancelCorrection}
        />
      }
      actions={
        <button type="button" onClick={() => setPhase("setup")} className={SECONDARY_BUTTON}>
          New game
        </button>
      }
      onBackToHub={() => router.push(withBasePath("/game-center"))}
      armedSegment={armedSegment}
      onBoardThrow={handleBoardThrow}
    >
      {matchState && (
        <ScoreDisplay
          players={[...matchState.players]}
          currentPlayerId={currentPlayerId}
          playerNames={playerNames}
          throwHistory={[...matchState.throws]}
          caption="Remaining"
        />
      )}
      <MatchStatus message={announcement} />
    </MatchLayout>
  );
}

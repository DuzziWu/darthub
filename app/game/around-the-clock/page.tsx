"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { GameEngine } from "@/game-engine/GameEngine";
import { withBasePath } from "@/lib/basePath";
import {
  AROUND_THE_CLOCK_TARGETS,
  AroundTheClockMode,
  getAroundTheClockWinnerId,
} from "@/game-engine/modes/AroundTheClockMode";
import type { AroundTheClockModeData } from "@/game-engine/modes/AroundTheClockMode";
import type { MatchState, ThrowSegment } from "@/game-engine/types";
import { boardSourceLabel } from "@/board";
import type { ArmedSegment } from "@/components/board";
import type { PlayerSetupOptions } from "@/components/game/types";
import { AroundTheClockScoreSheet } from "@/components/game/AroundTheClockScoreSheet";
import { GameResultBanner } from "@/components/game/GameResultBanner";
import { MatchLayout } from "@/components/game/MatchLayout";
import { MatchStatus } from "@/components/game/MatchStatus";
import { PlayerSetup } from "@/components/game/PlayerSetup";
import { PlayerScoreboard } from "@/components/game/PlayerScoreboard";
import { ScoreDisplay } from "@/components/game/ScoreDisplay";
import { ThrowHistoryControls } from "@/components/game/ThrowHistoryControls";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";
import { VisitTracker } from "@/components/game/VisitTracker";
import { useMatchHistory } from "@/components/game/useMatchHistory";
import { useInputMode } from "@/components/game/useInputMode";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import { playerErrorText } from "@/components/game/playerErrors";
import type { BoardThrow } from "@/components/game/types";

/** The id of the first seat, used when the match has no player on turn. */
const FALLBACK_PLAYER_ID = "player1";

/**
 * The engine's player ids, in seating order.
 *
 * The ids come from the names the setup collected, so the sheet, the
 * overview and the ledger all speak about the same players.
 */
function playerIdsFor(names: readonly string[]): string[] {
  return names.map((_, index) => `player${index + 1}`);
}

/**
 * The index of the target a player is aiming at.
 *
 * Around the clock has no shared target: every player walks their own run
 * of the 21 targets, so the index is read per player.
 */
function atcTargetIndex(state: MatchState | null, playerId: string | null): number {
  if (!state || !playerId) return 0;
  const data = state.modeData as AroundTheClockModeData | undefined;
  return data?.currentTargetIndex[playerId] ?? 0;
}

export default function AroundTheClockPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"setup" | "playing" | "result">("setup");
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // The armed band is owned here and shared by the pad and the board.
  const [armedSegment, setArmedSegment] = useState<ArmedSegment>("single");
  // The engine's ledger is the only record of the darts; the strip, the
  // undo button and the correction flow all read from it.
  const history = useMatchHistory({ engine, matchState });
  const inputMode = useInputMode();
  // The dart a correction replaces. It is read by name so the callback
  // below does not close over a stale value.
  const { correctionTarget } = history;
  // The setup choices in force, so a replay is played the same way.
  const [options, setOptions] = useState<PlayerSetupOptions>({
    outRule: "double",
    boardSource: "virtual",
  });

  const startMatch = useCallback(
    (names: string[], options: PlayerSetupOptions) => {
      // A correction armed in the previous match must not survive into
      // the next one.
      history.cancelCorrection();
      const eng = new GameEngine(new AroundTheClockMode());
      const ids = playerIdsFor(names);
      const state = eng.startMatch({ playerIds: ids });
      setEngine(eng);
      setMatchState(state);
      const byId: Record<string, string> = {};
      ids.forEach((id, index) => {
        byId[id] = names[index] ?? id;
      });
      setPlayerNames(byId);
      setWinnerId(null);
      setMessage("");
      setOptions(options);
      setPhase("playing");
    },
    [history],
  );

  const recordThrow = useCallback(
    (throwInput: { points: number; segment?: ThrowSegment }) => {
      if (!engine || !matchState || phase !== "playing") return;
      if (matchState.status === "completed") return;

      // The target belongs to the player who threw the dart. A correction
      // replaces a dart of an earlier visit, so its owner is not
      // necessarily the player on turn.
      const correctedPlayerId =
        correctionTarget !== null ? (matchState.throws[correctionTarget]?.playerId ?? null) : null;
      const playerId = correctedPlayerId ?? matchState.currentPlayerId ?? FALLBACK_PLAYER_ID;
      const { points, segment } = throwInput;
      const before = atcTargetIndex(matchState, playerId);

      try {
        // Around the clock scores from the point value alone: a single, a
        // double or a triple of the target in play all count as one hit.
        // The hook owns the correction flow: with an armed target it
        // replaces that dart, otherwise it records a new one.
        const state = history.submitThrow({ points, segment });
        if (!state) return;
        const after = atcTargetIndex(state, playerId);

        setMatchState(state);

        if (state.status === "completed") {
          // The mode owns the win: the sheet never guesses it.
          setWinnerId(getAroundTheClockWinnerId(state));
          setPhase("result");
          setMessage("");
        } else if (points === 0) {
          setMessage("Miss.");
        } else if (after > before) {
          setMessage(`Hit. The target is now ${AROUND_THE_CLOCK_TARGETS[after] ?? "the bull"}.`);
        } else if (after === before) {
          // The dart was thrown and the ledger keeps it, but it did not
          // move the player's target: that is a miss, and the view says so
          // instead of swallowing the dart.
          const target = AROUND_THE_CLOCK_TARGETS[after] ?? AROUND_THE_CLOCK_TARGETS[before] ?? 1;
          setMessage(`Miss — that was not ${target}. Keep aiming for ${target}.`);
        } else {
          // The index went back: a correction turned a hit into a miss.
          // The target is the one the corrected dart was aimed at, and it
          // is the target the player is aiming at again.
          const target = AROUND_THE_CLOCK_TARGETS[after] ?? AROUND_THE_CLOCK_TARGETS[before] ?? 1;
          setMessage(`Corrected — that was not ${target}. Keep aiming for ${target}.`);
        }
      } catch (error) {
        // These modes never bust: a thrown error is an invalid throw or a
        // refused correction. The refusal is reported by its code, never by
        // its message.
        setMessage(playerErrorText(error));
      }
    },
    [engine, matchState, phase, history, correctionTarget],
  );

  const handleBoardThrow = useCallback(
    (hit: BoardThrow) => {
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
      setMessage("Last dart removed.");
      setPhase("playing");
    }
  }, [engine, history]);

  const handlePlayAgain = useCallback(() => {
    startMatch(Object.values(playerNames), options);
  }, [options, playerNames, startMatch]);

  const handleBackToHub = useCallback(() => {
    router.push(withBasePath("/game-center"));
  }, [router]);

  if (phase === "setup") {
    return (
      <div className="flex justify-center py-2xl">
        <PlayerSetup
          modeName="Around the Clock"
          modeDescription="Hit 1 through 20 and then the bull, in order. A single, a double or a treble of the target in play all count."
          modeIcon={Clock}
          minPlayers={1}
          maxPlayers={2}
          showCheckoutRule={false}
          onStart={startMatch}
        />
      </div>
    );
  }

  // The target in play is the target of the player on turn: every player
  // walks their own run of the 21 targets.
  const currentPlayerId = matchState?.currentPlayerId ?? null;
  const currentIndex = atcTargetIndex(matchState, currentPlayerId);
  const currentTarget = AROUND_THE_CLOCK_TARGETS[currentIndex] ?? AROUND_THE_CLOCK_TARGETS[0] ?? 1;

  return (
    <MatchLayout
      input={
        <ThrowInputPad
          throwsInCurrentTurn={matchState?.throwsInCurrentTurn ?? 0}
          armedSegment={armedSegment}
          onArmedSegmentChange={setArmedSegment}
          onThrow={recordThrow}
          showSegmentControl={inputMode.mode !== "board"}
        />
      }
      inputMode={inputMode.mode}
      onInputModeChange={inputMode.onChange}
      modeName="Around the Clock"
      badge={`Target ${currentTarget}`}
      sourceLabel={boardSourceLabel(options.boardSource)}
      scoreboard={
        matchState && (
          <PlayerScoreboard
            players={matchState.players.map((player) => ({
              id: player.id,
              name: playerNames[player.id] ?? player.id,
              // The number of the row is the number of targets this player
              // has hit: the caption says so.
              value: player.totalPoints,
              isCurrent: player.id === currentPlayerId,
            }))}
            data={{
              kind: "aroundTheClock",
              currentTarget,
              targetIndex: currentIndex,
              targetCount: AROUND_THE_CLOCK_TARGETS.length,
              playerProgress:
                (matchState.modeData as AroundTheClockModeData | undefined)?.playerProgress ?? {},
            }}
          />
        )
      }
      visit={
        <VisitTracker canUndo={history.canUndo} onUndo={handleUndo}>
          <ThrowHistoryControls
            throws={history.currentTurn}
            turnOffset={history.currentTurnOffset}
            correctionTarget={history.correctionTarget}
            awaitingConfirmation={history.awaitingConfirmation}
            correctionsDisabled={matchState?.status === "completed"}
            onSelectThrow={history.selectThrow}
            onConfirm={history.confirmCorrection}
            onCancel={history.cancelCorrection}
          />
        </VisitTracker>
      }
      actions={
        <button type="button" onClick={() => setPhase("setup")} className={SECONDARY_BUTTON}>
          New game
        </button>
      }
      onBackToHub={handleBackToHub}
      armedSegment={armedSegment}
      onArmedSegmentChange={setArmedSegment}
      onBoardThrow={handleBoardThrow}
    >
      <AroundTheClockScoreSheet
        targets={AROUND_THE_CLOCK_TARGETS}
        players={(matchState?.players ?? []).map((player) => ({
          id: player.id,
          name: playerNames[player.id] ?? player.id,
          currentIndex: atcTargetIndex(matchState, player.id),
          hits: player.totalPoints,
        }))}
        currentPlayerId={currentPlayerId}
      />
      <ScoreDisplay
        players={matchState ? [...matchState.players] : []}
        currentPlayerId={currentPlayerId}
        playerNames={playerNames}
        throwHistory={matchState ? [...matchState.throws] : []}
        caption="Hit"
      />
      <MatchStatus message={message} />
      {phase === "result" ? (
        <GameResultBanner
          winnerId={winnerId}
          players={matchState ? [...matchState.players] : []}
          playerNames={playerNames}
          onPlayAgain={handlePlayAgain}
          onBackToHub={handleBackToHub}
        />
      ) : null}
    </MatchLayout>
  );
}

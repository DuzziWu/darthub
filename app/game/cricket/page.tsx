"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { withBasePath } from "@/lib/basePath";
import { GameEngine } from "@/game-engine/GameEngine";
import {
  CRICKET_TARGETS,
  MARKS_TO_CLOSE,
  CricketMode,
  getCricketWinnerId,
} from "@/game-engine/modes/CricketMode";
import type { CricketModeData } from "@/game-engine/modes/CricketMode";
import type { MatchState, ThrowSegment } from "@/game-engine/types";
import { boardSourceLabel } from "@/board";
import type { ArmedSegment } from "@/components/board";
import type { PlayerSetupOptions } from "@/components/game/types";
import { CricketScoreSheet } from "@/components/game/CricketScoreSheet";
import { GameResultBanner } from "@/components/game/GameResultBanner";
import { MatchLayout } from "@/components/game/MatchLayout";
import { MatchStatus } from "@/components/game/MatchStatus";
import { PlayerSetup } from "@/components/game/PlayerSetup";
import { PlayerScoreboard } from "@/components/game/PlayerScoreboard";
import { ThrowHistoryControls } from "@/components/game/ThrowHistoryControls";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";
import { VisitTracker } from "@/components/game/VisitTracker";
import { useMatchHistory } from "@/components/game/useMatchHistory";
import { useInputMode } from "@/components/game/useInputMode";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import { playerErrorText } from "@/components/game/playerErrors";
import type { BoardThrow } from "@/components/game/types";

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
 * The marks one player holds, read from the mode's own state.
 *
 * Cricket has no remaining score: the marks on the targets are the score,
 * and they belong to the player who threw them — never to the match.
 */
function readMarks(state: MatchState | null, playerId: string): Record<string, number> {
  const marks = (state?.modeData as CricketModeData | undefined)?.marks;
  return marks?.[playerId] ?? {};
}

/**
 * The marks a throw added, read from the mode's own state.
 *
 * The inner bull (50) is two marks and the outer bull (25) is one.
 */
function marksGained(before: Record<string, number>, after: Record<string, number>): number {
  return CRICKET_TARGETS.reduce((total, target) => {
    const key = String(target);
    return total + Math.max(0, (after[key] ?? 0) - (before[key] ?? 0));
  }, 0);
}

export default function CricketPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"setup" | "playing" | "result">("setup");
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // The armed band is owned here and shared by the pad and the board.
  const [armedSegment, setArmedSegment] = useState<ArmedSegment>("single");
  // The setup choices in force, so a replay is played the same way.
  const [options, setOptions] = useState<PlayerSetupOptions>({
    outRule: "double",
    boardSource: "virtual",
  });

  // The engine's ledger is the only record of the darts; the strip, the
  // undo button and the correction flow all read from it.
  const history = useMatchHistory({ engine, matchState });
  const inputMode = useInputMode();
  // The dart a correction replaces. It is read by name so the callback
  // below does not close over a stale value.
  const { correctionTarget } = history;

  const startMatch = useCallback(
    (names: string[], options: PlayerSetupOptions) => {
      // A correction armed in the previous match must not survive into
      // the next one.
      history.cancelCorrection();
      const eng = new GameEngine(new CricketMode());
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

      // The marks belong to the player who threw the dart. A correction
      // replaces a dart of an earlier visit, so its owner is not
      // necessarily the player on turn.
      const correctedPlayerId =
        correctionTarget !== null ? (matchState.throws[correctionTarget]?.playerId ?? null) : null;
      const playerId = correctedPlayerId ?? matchState.currentPlayerId ?? null;
      const { points } = throwInput;
      const before = playerId ? readMarks(matchState, playerId) : {};

      try {
        // Cricket scores from the point value alone. The segment is a label
        // on the visit, never an input to the mode. With an armed correction
        // target this replaces the dart; otherwise it records a new one.
        const state = history.submitThrow({ points, segment: throwInput.segment });
        if (!state) return;
        const after = playerId ? readMarks(state, playerId) : {};
        const earned = marksGained(before, after);

        setMatchState(state);

        if (state.status === "completed") {
          // The mode owns the win: the sheet never guesses it.
          setWinnerId(getCricketWinnerId(state));
          setPhase("result");
          setMessage("");
        } else if (points === 0) {
          setMessage("Miss.");
        } else if (earned > 0) {
          setMessage(`+${earned} mark${earned > 1 ? "s" : ""}`);
        } else {
          setMessage("No marks on that target.");
        }
      } catch (error) {
        // A refused correction or an invalid throw: the engine changed
        // nothing, but the strip re-reads the ledger either way. The
        // refusal is reported by its code, never by its message.
        setMessage(playerErrorText(error));
        setMatchState(engine.getState());
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
          modeName="Cricket"
          modeDescription="Close 20 down to 15 and the bull with three marks each. The inner bull counts as two marks, the outer bull as one."
          modeIcon={Target}
          minPlayers={1}
          maxPlayers={2}
          showCheckoutRule={false}
          onStart={startMatch}
        />
      </div>
    );
  }

  const currentPlayerId = matchState?.currentPlayerId ?? null;
  // The badge counts the closed targets of the player on turn — and of the
  // winner once the match is over, because the match has no player on turn
  // any more.
  const badgePlayerId = currentPlayerId ?? winnerId;
  const badgeMarks = badgePlayerId ? readMarks(matchState, badgePlayerId) : {};
  const closed = CRICKET_TARGETS.filter(
    (target) => (badgeMarks[String(target)] ?? 0) >= MARKS_TO_CLOSE,
  ).length;

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
      modeName="Cricket"
      badge={`${closed} / ${CRICKET_TARGETS.length} closed`}
      sourceLabel={boardSourceLabel(options.boardSource)}
      scoreboard={
        matchState && (
          <PlayerScoreboard
            players={matchState.players.map((player) => ({
              id: player.id,
              name: playerNames[player.id] ?? player.id,
              // Cricket has no score column: the targets are the score.
              value: player.totalPoints,
              isCurrent: player.id === currentPlayerId,
            }))}
            data={{
              kind: "cricket",
              marks: (matchState.modeData as CricketModeData | undefined)?.marks ?? {},
              targets: CRICKET_TARGETS,
              marksToClose: MARKS_TO_CLOSE,
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
      <CricketScoreSheet
        targets={CRICKET_TARGETS}
        marksToClose={MARKS_TO_CLOSE}
        players={(matchState?.players ?? []).map((player) => ({
          id: player.id,
          name: playerNames[player.id] ?? player.id,
          marks: readMarks(matchState, player.id),
        }))}
        currentPlayerId={currentPlayerId}
      />
      <MatchStatus message={message} />
      {phase === "result" ? (
        <GameResultBanner
          winnerId={winnerId}
          players={matchState ? [...matchState.players] : []}
          playerNames={playerNames}
          onPlayAgain={handlePlayAgain}
          onBackToHub={handleBackToHub}
          onUndo={handleUndo}
        />
      ) : null}
    </MatchLayout>
  );
}

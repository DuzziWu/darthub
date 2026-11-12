"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { GameEngine } from "@/game-engine/GameEngine";
import { CRICKET_TARGETS, MARKS_TO_CLOSE, CricketMode } from "@/game-engine/modes/CricketMode";
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
import { ThrowHistoryControls } from "@/components/game/ThrowHistoryControls";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";
import { useMatchHistory } from "@/components/game/useMatchHistory";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import type { BoardThrow } from "@/components/game/types";

/** The solo player of a cricket match. */
const PLAYER_ID = "player1";

/**
 * The marks a throw added, read from the mode's own state.
 *
 * Cricket has no remaining score: the marks on the targets are the score,
 * and the mode counts them from the point value of the dart. The inner bull
 * (50) is therefore two marks and the outer bull (25) is one.
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

  const startMatch = useCallback((names: string[], options: PlayerSetupOptions) => {
    const eng = new GameEngine(new CricketMode());
    const state = eng.startMatch({ playerIds: [PLAYER_ID] });
    setEngine(eng);
    setMatchState(state);
    setPlayerNames({ [PLAYER_ID]: names[0] ?? "Player 1" });
    setWinnerId(null);
    setMessage("");
    setOptions(options);
    setPhase("playing");
  }, []);

  const recordThrow = useCallback(
    (throwInput: { points: number; segment?: ThrowSegment }) => {
      if (!engine || !matchState || phase !== "playing") return;
      if (matchState.status === "completed") return;

      const playerId = matchState.currentPlayerId ?? PLAYER_ID;
      const { points } = throwInput;
      const before = (matchState.modeData as CricketModeData | undefined)?.marks?.[PLAYER_ID] ?? {};

      try {
        // Cricket scores from the point value alone. The segment is a label
        // on the visit, never an input to the mode. With an armed correction
        // target this replaces the dart; otherwise it records a new one.
        const state = history.submitThrow({ points, segment: throwInput.segment });
        if (!state) return;
        const after = (state.modeData as CricketModeData | undefined)?.marks?.[PLAYER_ID] ?? {};
        const earned = marksGained(before, after);

        setMatchState(state);

        if (state.status === "completed") {
          setWinnerId(playerId);
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
        // nothing, but the strip re-reads the ledger either way.
        setMessage((error as Error).message || "Invalid throw");
        setMatchState(engine.getState());
      }
    },
    [engine, matchState, phase, history],
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
    router.push("/game-center");
  }, [router]);

  if (phase === "setup") {
    return (
      <div className="flex justify-center py-2xl">
        <PlayerSetup
          modeName="Cricket"
          modeDescription="Close 20 down to 15 and the bull with three marks each. The inner bull counts as two marks, the outer bull as one."
          modeIcon={Target}
          minPlayers={1}
          maxPlayers={1}
          showCheckoutRule={false}
          onStart={startMatch}
        />
      </div>
    );
  }

  const marks = (matchState?.modeData as CricketModeData | undefined)?.marks?.[PLAYER_ID] ?? {};
  const closed = CRICKET_TARGETS.filter(
    (target) => (marks[String(target)] ?? 0) >= MARKS_TO_CLOSE,
  ).length;

  return (
    <MatchLayout
      modeName="Cricket"
      badge={`${closed} / ${CRICKET_TARGETS.length} closed`}
      sourceLabel={boardSourceLabel(options.boardSource)}
      visit={
        <ThrowHistoryControls
          throws={history.currentVisit}
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
      onBackToHub={handleBackToHub}
      armedSegment={armedSegment}
      onBoardThrow={handleBoardThrow}
    >
      <CricketScoreSheet
        targets={CRICKET_TARGETS}
        marks={marks}
        marksToClose={MARKS_TO_CLOSE}
        playerName={playerNames[PLAYER_ID]}
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
      ) : (
        <ThrowInputPad
          throwsInCurrentTurn={matchState?.throwsInCurrentTurn ?? 0}
          armedSegment={armedSegment}
          onArmedSegmentChange={setArmedSegment}
          onThrow={recordThrow}
        />
      )}
    </MatchLayout>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { GameEngine } from "@/game-engine/GameEngine";
import { withBasePath } from "@/lib/basePath";
import {
  AROUND_THE_CLOCK_TARGETS,
  AroundTheClockMode,
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
import { ScoreDisplay } from "@/components/game/ScoreDisplay";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";
import { VisitChips } from "@/components/game/VisitChips";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import type { BoardThrow, VisitEntry } from "@/components/game/types";

/** The solo player of an around the clock match. */
const PLAYER_ID = "player1";

export default function AroundTheClockPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"setup" | "playing" | "result">("setup");
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [visit, setVisit] = useState<VisitEntry[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // The armed band is owned here and shared by the pad and the board.
  const [armedSegment, setArmedSegment] = useState<ArmedSegment>("single");
  // The setup choices in force, so a replay is played the same way.
  const [options, setOptions] = useState<PlayerSetupOptions>({
    outRule: "double",
    boardSource: "virtual",
  });

  const startMatch = useCallback((names: string[], options: PlayerSetupOptions) => {
    const eng = new GameEngine(new AroundTheClockMode());
    const state = eng.startMatch({ playerIds: [PLAYER_ID] });
    setEngine(eng);
    setMatchState(state);
    setPlayerNames({ [PLAYER_ID]: names[0] ?? "Player 1" });
    setVisit([]);
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
      const { points, segment } = throwInput;
      const before =
        (matchState.modeData as AroundTheClockModeData | undefined)?.currentTargetIndex ?? 0;
      // A visit opens when the engine starts a new turn.
      const opensVisit = matchState.throwsInCurrentTurn === 0;

      try {
        // Around the clock scores from the point value alone: a single, a
        // double or a triple of the target in play all count as one hit.
        const state = engine.recordThrow({ playerId, points });
        const after =
          (state.modeData as AroundTheClockModeData | undefined)?.currentTargetIndex ?? before;

        setMatchState(state);
        const entry: VisitEntry = { playerId, points, segment };
        setVisit((previous) => (opensVisit ? [entry] : [...previous, entry]));

        if (state.status === "completed") {
          setWinnerId(playerId);
          setPhase("result");
          setMessage("");
        } else if (points === 0) {
          setMessage("Miss.");
        } else if (after > before) {
          setMessage(`Hit. The target is now ${AROUND_THE_CLOCK_TARGETS[after] ?? "the bull"}.`);
        } else {
          setMessage(`Not the target. Keep aiming for ${AROUND_THE_CLOCK_TARGETS[before]}.`);
        }
      } catch (error) {
        // These modes never bust: a thrown error is an invalid throw.
        setMessage((error as Error).message || "Invalid throw");
      }
    },
    [engine, matchState, phase],
  );

  const handleBoardThrow = useCallback(
    (hit: BoardThrow) => {
      recordThrow({ points: hit.points, segment: hit.segment ?? undefined });
    },
    [recordThrow],
  );

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
          maxPlayers={1}
          showCheckoutRule={false}
          onStart={startMatch}
        />
      </div>
    );
  }

  const currentIndex =
    (matchState?.modeData as AroundTheClockModeData | undefined)?.currentTargetIndex ?? 0;
  const currentTarget = AROUND_THE_CLOCK_TARGETS[currentIndex] ?? AROUND_THE_CLOCK_TARGETS[0];

  return (
    <MatchLayout
      modeName="Around the Clock"
      badge={`Target ${currentTarget}`}
      sourceLabel={boardSourceLabel(options.boardSource)}
      visit={<VisitChips visit={visit} />}
      actions={
        <button type="button" onClick={() => setPhase("setup")} className={SECONDARY_BUTTON}>
          New game
        </button>
      }
      onBackToHub={handleBackToHub}
      armedSegment={armedSegment}
      onBoardThrow={handleBoardThrow}
    >
      <AroundTheClockScoreSheet targets={AROUND_THE_CLOCK_TARGETS} currentIndex={currentIndex} />

      <ScoreDisplay
        players={matchState ? [...matchState.players] : []}
        currentPlayerId={matchState?.currentPlayerId ?? null}
        playerNames={playerNames}
        throwHistory={visit}
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

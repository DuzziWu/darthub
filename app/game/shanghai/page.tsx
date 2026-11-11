"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { GameEngine } from "@/game-engine/GameEngine";
import { roundTarget, SHANGHAI_ROUNDS, ShanghaiMode } from "@/game-engine/modes/ShanghaiMode";
import type { ShanghaiModeData } from "@/game-engine/modes/ShanghaiMode";
import type { MatchState, ThrowSegment } from "@/game-engine/types";
import { boardSourceLabel } from "@/board";
import type { ArmedSegment } from "@/components/board";
import type { PlayerSetupOptions } from "@/components/game/types";
import { GameResultBanner } from "@/components/game/GameResultBanner";
import { MatchLayout } from "@/components/game/MatchLayout";
import { MatchStatus } from "@/components/game/MatchStatus";
import { PlayerSetup } from "@/components/game/PlayerSetup";
import { ScoreDisplay } from "@/components/game/ScoreDisplay";
import { ShanghaiScoreSheet } from "@/components/game/ShanghaiScoreSheet";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";
import { VisitChips } from "@/components/game/VisitChips";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import type { BoardThrow, VisitEntry } from "@/components/game/types";

/** The solo player of a shanghai match. */
const PLAYER_ID = "player1";

/** The target of every round: round N targets the number N. */
const ROUND_TARGETS = Array.from({ length: SHANGHAI_ROUNDS }, (_unused, index) =>
  roundTarget(index + 1),
);

/**
 * The marks a dart scores in a round.
 *
 * This mirrors the mode's own rule — a single is one mark, a double two and
 * a treble three — because the mode keeps only the round in play, and the
 * rounds that are done are read back from the throw history.
 */
function marksFor(points: number, target: number): number {
  if (points === target) return 1;
  if (points === 2 * target) return 2;
  if (points === 3 * target) return 3;
  return 0;
}

export default function ShanghaiPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"setup" | "playing" | "result">("setup");
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [visit, setVisit] = useState<VisitEntry[]>([]);
  /** The marks of every round, computed from the throws that scored them. */
  const [roundMarks, setRoundMarks] = useState<Record<string, number>>({});
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
    const eng = new GameEngine(new ShanghaiMode());
    const state = eng.startMatch({ playerIds: [PLAYER_ID] });
    setEngine(eng);
    setMatchState(state);
    setPlayerNames({ [PLAYER_ID]: names[0] ?? "Player 1" });
    setVisit([]);
    setRoundMarks({});
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
      const round = ((matchState.modeData as ShanghaiModeData | undefined)?.currentRound ?? 0) + 1;
      const target = roundTarget(Math.min(round, SHANGHAI_ROUNDS));
      // A visit opens when the engine starts a new turn.
      const opensVisit = matchState.throwsInCurrentTurn === 0;
      const marks = marksFor(points, target);

      try {
        // Shanghai scores from the point value alone: the segment is a label
        // on the visit, never an input to the mode.
        const state = engine.recordThrow({ playerId, points });

        setMatchState(state);
        const entry: VisitEntry = { playerId, points, segment };
        setVisit((previous) => (opensVisit ? [entry] : [...previous, entry]));
        if (marks > 0) {
          const key = String(round);
          setRoundMarks((previous) => ({ ...previous, [key]: (previous[key] ?? 0) + marks }));
        }

        if (state.status === "completed") {
          setWinnerId(playerId);
          setPhase("result");
          setMessage("");
        } else if (points === 0) {
          setMessage("Miss.");
        } else if (marks > 0) {
          setMessage(`+${marks} mark${marks > 1 ? "s" : ""}`);
        } else {
          setMessage(`Not the target. Round ${round} targets the number ${target}.`);
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
    router.push("/game-center");
  }, [router]);

  if (phase === "setup") {
    return (
      <div className="flex justify-center py-2xl">
        <PlayerSetup
          modeName="Shanghai"
          modeDescription="Seven rounds. Round N targets the number N — a single is one mark, a double two and a treble three. All three in one round is a Shanghai."
          modeIcon={Sparkles}
          minPlayers={1}
          maxPlayers={1}
          showCheckoutRule={false}
          onStart={startMatch}
        />
      </div>
    );
  }

  const data = matchState?.modeData as ShanghaiModeData | undefined;
  const currentRound = (data?.currentRound ?? 0) + 1;
  const record = data?.roundRecords?.[PLAYER_ID];
  const hit = {
    single: record?.hitSingle ?? false,
    double: record?.hitDouble ?? false,
    triple: record?.hitTriple ?? false,
  };
  const totalMarks = Object.values(roundMarks).reduce((sum, marks) => sum + marks, 0);

  return (
    <MatchLayout
      modeName="Shanghai"
      badge={`${totalMarks} marks`}
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
      <ShanghaiScoreSheet
        currentRound={currentRound}
        totalRounds={SHANGHAI_ROUNDS}
        targets={ROUND_TARGETS}
        marksByRound={roundMarks}
        hit={hit}
      />

      <ScoreDisplay
        players={matchState ? [...matchState.players] : []}
        currentPlayerId={matchState?.currentPlayerId ?? null}
        playerNames={playerNames}
        throwHistory={visit}
        caption="Marks"
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

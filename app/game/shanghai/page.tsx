"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { withBasePath } from "@/lib/basePath";
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
import { PlayerScoreboard } from "@/components/game/PlayerScoreboard";
import { ScoreDisplay } from "@/components/game/ScoreDisplay";
import { ShanghaiScoreSheet } from "@/components/game/ShanghaiScoreSheet";
import { ThrowHistoryControls } from "@/components/game/ThrowHistoryControls";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";
import { VisitTracker } from "@/components/game/VisitTracker";
import { useMatchHistory } from "@/components/game/useMatchHistory";
import { useInputMode } from "@/components/game/useInputMode";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import type { BoardThrow } from "@/components/game/types";

/** The target of every round: round N targets the number N. */
const ROUND_TARGETS = Array.from({ length: SHANGHAI_ROUNDS }, (_unused, index) =>
  roundTarget(index + 1),
);

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
 * The marks a dart scores, mirrored from the mode's own rule.
 *
 * A single is one mark, a double two and a treble three. This is the
 * message the view shows after a dart — the sheet's table is read from the
 * mode's state, never from this.
 */
function marksFor(points: number, target: number): number {
  if (points === target) return 1;
  if (points === 2 * target) return 2;
  if (points === 3 * target) return 3;
  return 0;
}

/**
 * The marks a player scored in every round, read from the mode's state.
 *
 * `finishedRounds` holds the rounds that are done; the round in play is
 * still in `roundRecords`. The array is padded with zeros to the length of
 * the match, so the sheet's grid is always the same seven columns and a
 * mark never moves a column.
 */
function marksByRound(
  data: ShanghaiModeData | undefined,
  playerId: string,
  totalRounds: number,
): number[] {
  const finished = data?.finishedRounds[playerId] ?? [];
  const marks = [...finished];
  // The round in play counts as long as it is still being played.
  if ((data?.currentRound ?? 0) < totalRounds) {
    marks.push(data?.roundRecords[playerId]?.marks ?? 0);
  }
  while (marks.length < totalRounds) {
    marks.push(0);
  }
  return marks;
}

export default function ShanghaiPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"setup" | "playing" | "result">("setup");
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  /** The player who took the match. */
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // The armed band is owned here and shared by the pad and the board.
  const [armedSegment, setArmedSegment] = useState<ArmedSegment>("single");
  // The engine's ledger is the only record of the darts; the strip, the
  // undo button and the correction flow all read from it.
  const history = useMatchHistory({ engine, matchState });
  const inputMode = useInputMode();
  // The setup choices in force, so a replay is played the same way.
  const [options, setOptions] = useState<PlayerSetupOptions>({
    outRule: "double",
    boardSource: "virtual",
  });

  const startMatch = useCallback((names: string[], options: PlayerSetupOptions) => {
    const eng = new GameEngine(new ShanghaiMode());
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
  }, []);

  const recordThrow = useCallback(
    (throwInput: { points: number; segment?: ThrowSegment }) => {
      if (!engine || !matchState || phase !== "playing") return;
      if (matchState.status === "completed") return;

      // The dart belongs to the player on turn; the match is over for
      // whoever threw the last one.
      const playerId = matchState.currentPlayerId ?? matchState.players[0]?.id ?? null;
      const { points, segment } = throwInput;
      const round = ((matchState.modeData as ShanghaiModeData | undefined)?.currentRound ?? 0) + 1;
      const target = roundTarget(Math.min(round, SHANGHAI_ROUNDS));
      const marks = marksFor(points, target);

      try {
        // Shanghai scores from the point value alone: the segment is a label
        // on the visit, never an input to the mode.
        // The hook owns the correction flow: with an armed target it
        // replaces that dart, otherwise it records a new one.
        const state = history.submitThrow({ points, segment });
        if (!state) return;

        setMatchState(state);

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
    router.push(withBasePath("/game-center"));
  }, [router]);

  if (phase === "setup") {
    return (
      <div className="flex justify-center py-2xl">
        <PlayerSetup
          modeName="Shanghai"
          modeDescription="Seven rounds. Round N targets the number N — a single is one mark, a double two and a treble three. All three in one round is a Shanghai."
          modeIcon={Sparkles}
          minPlayers={1}
          maxPlayers={2}
          showCheckoutRule={false}
          onStart={startMatch}
        />
      </div>
    );
  }

  const data = matchState?.modeData as ShanghaiModeData | undefined;
  const currentRound = (data?.currentRound ?? 0) + 1;
  const currentPlayerId = matchState?.currentPlayerId ?? null;
  // The segments of the round in play belong to the player on turn.
  const record = currentPlayerId ? data?.roundRecords?.[currentPlayerId] : undefined;
  const hit = {
    single: record?.hitSingle ?? false,
    double: record?.hitDouble ?? false,
    triple: record?.hitTriple ?? false,
  };
  // The round table is the mode's own state: a row per player, the marks of
  // every round in the player's own column.
  const sheetPlayers = (matchState?.players ?? []).map((player) => ({
    id: player.id,
    name: playerNames[player.id] ?? player.id,
    marksByRound: marksByRound(data, player.id, SHANGHAI_ROUNDS),
  }));
  // The badge counts the marks of the player on turn — and of the winner
  // once the match is over, because the match has no player on turn any
  // more.
  const badgePlayerId = currentPlayerId ?? winnerId;
  const badgeMarks =
    badgePlayerId === null
      ? 0
      : (matchState?.players.find((player) => player.id === badgePlayerId)?.totalPoints ?? 0);

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
      modeName="Shanghai"
      badge={`${badgeMarks} marks`}
      sourceLabel={boardSourceLabel(options.boardSource)}
      scoreboard={
        matchState && (
          <PlayerScoreboard
            players={matchState.players.map((player) => ({
              id: player.id,
              name: playerNames[player.id] ?? player.id,
              // The number of the row is the marks scored in the match: the
              // caption says so.
              value: player.totalPoints,
              isCurrent: player.id === currentPlayerId,
            }))}
            data={{
              kind: "shanghai",
              currentRound,
              totalRounds: SHANGHAI_ROUNDS,
              target: roundTarget(Math.min(currentRound, SHANGHAI_ROUNDS)),
              roundRecords: data?.roundRecords ?? {},
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
      <ShanghaiScoreSheet
        currentRound={currentRound}
        totalRounds={SHANGHAI_ROUNDS}
        targets={ROUND_TARGETS}
        players={sheetPlayers}
        currentPlayerId={currentPlayerId}
        hit={hit}
      />
      <ScoreDisplay
        players={matchState ? [...matchState.players] : []}
        currentPlayerId={matchState?.currentPlayerId ?? null}
        playerNames={playerNames}
        throwHistory={matchState ? [...matchState.throws] : []}
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
      ) : null}
    </MatchLayout>
  );
}

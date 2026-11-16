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
import { PlayerScoreboard } from "@/components/game/PlayerScoreboard";
import { PlayerSetup } from "@/components/game/PlayerSetup";
import { ScoreDisplay } from "@/components/game/ScoreDisplay";
import { ThrowInputPad } from "@/components/game/ThrowInputPad";
import { ThrowHistoryControls } from "@/components/game/ThrowHistoryControls";
import { VisitTracker } from "@/components/game/VisitTracker";
import { visitBadge } from "@/components/game/VisitChips";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import { playerErrorText } from "@/components/game/playerErrors";
import type { MatchFormatChoice, PlayerSetupOptions } from "@/components/game/types";
import { useMatchHistory } from "@/components/game/useMatchHistory";
import { useInputMode } from "@/components/game/useInputMode";
import { GameEngine } from "@/game-engine/GameEngine";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { OUT_RULE_CHOICES } from "@/game-engine/modes/registry";
import { getOutRule, type OutRule } from "@/game-engine/rules";
import { LEG_SET_MODE_DATA_KEY, type LegSetProgress } from "@/game-engine/rules/LegSetManager";
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
 * The match formats x01 offers.
 *
 * The sizes are "best of N": "Best of 3 legs" is first to 2 legs. A single
 * leg reports no legs and no sets, so the engine runs no leg structure at
 * all and the sheet header says nothing about legs.
 */
const MATCH_FORMATS: readonly MatchFormatChoice[] = [
  { id: "single", label: "Single leg" },
  { id: "bo3", label: "Best of 3 legs", legs: 3 },
  { id: "bo5", label: "Best of 5 legs", legs: 5 },
];

/**
 * The leg and set progress of the match, when it has any.
 *
 * `LegSetManager` only runs when the match is configured with legs or sets,
 * and the engine seeds its slice into the state when the match starts — so
 * the slice is the proof that the match has a leg structure at all.
 *
 * The **sizes** are not part of that slice: they are the configuration the
 * match was started with, so the view keeps them beside the checkout rule
 * and the board source and combines them with the engine's won-counts.
 * Without them there is no honest "2/5" to show.
 */
function legSetProgress(
  matchState: MatchState,
  sizes: { legs?: number; sets?: number },
): {
  leg?: { current: number; total: number };
  set?: { current: number; total: number };
} {
  const progress = (matchState.modeData as Record<string, unknown> | undefined)?.[
    LEG_SET_MODE_DATA_KEY
  ] as LegSetProgress | undefined;
  if (!progress) return {};
  return {
    ...(sizes.legs === undefined
      ? {}
      : { leg: { current: legsPlayed(progress) + 1, total: sizes.legs } }),
    ...(sizes.sets === undefined
      ? {}
      : { set: { current: setsWon(progress) + 1, total: sizes.sets } }),
  };
}

/**
 * The number of legs played in the set in play.
 *
 * Every leg somebody won is a leg that was played, so the sum of the
 * won-counts is the number of legs behind the one in play.
 */
function legsPlayed(progress: LegSetProgress): number {
  return Object.values(progress.legsWon).reduce((sum, count) => sum + count, 0);
}

/** The number of sets won in the match. */
function setsWon(progress: LegSetProgress): number {
  return Object.values(progress.setsWon).reduce((sum, count) => sum + count, 0);
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
  // The sizes of the match format. They are the configuration the match was
  // started with, so they travel with the checkout rule and the board source
  // — the engine's own state carries the won-counts, not the sizes.
  const [legs, setLegs] = useState<number | undefined>(undefined);
  const [sets, setSets] = useState<number | undefined>(undefined);
  const [armedSegment, setArmedSegment] = useState<ArmedSegment>("single");
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The engine's ledger is the only record of the darts; the strip, the
  // score sheet, the undo button and the correction flow all read from it.
  const history = useMatchHistory({ engine, matchState });
  // The dart a correction replaces. It is read by name so the callback
  // below does not close over a stale value.
  const { correctionTarget } = history;
  const inputMode = useInputMode();

  const startMatch = useCallback(
    (names: string[], options: PlayerSetupOptions) => {
      // The mode carries no rule of its own: the rule the player chose
      // travels with the match configuration, so the choice governs.
      const mode = new StandardMode({ startScore });
      const nextEngine = new GameEngine(mode);
      const playerIds = names.map((_, index) => `player${index + 1}`);
      const state = nextEngine.startMatch({
        playerIds,
        outRule: options.outRule,
        ...(options.legs === undefined ? {} : { legs: options.legs }),
        ...(options.sets === undefined ? {} : { sets: options.sets }),
      });

      const namesById: Record<string, string> = {};
      playerIds.forEach((id, index) => {
        namesById[id] = names[index] ?? id;
      });

      setEngine(nextEngine);
      setMatchState(state);
      setPlayerNames(namesById);
      setOutRule(options.outRule);
      setBoardSource(options.boardSource);
      setLegs(options.legs);
      setSets(options.sets);
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
        // The bust branch belongs to a **new** dart, never to a correction.
        // While a correction is armed, `bust` was computed from the score
        // that is left *now* — and the score now is not the score the
        // corrected dart was thrown at, so the computation says nothing
        // about the dart. A refused correction changed nothing at all, and
        // announcing a bust would tell the player that something happened
        // that did not happen. The armed target survives a refusal, so the
        // check is stable inside this catch.
        if (correctionTarget === null && bust && error instanceof GameEngineStateError) {
          // A bust counts for nothing but is still entered in the ledger,
          // so the strip shows it from there.
          setMatchState(engine.getState());
          setAnnouncement(`Bust. ${remainingBefore} remaining.`);
        } else {
          // The refusal is reported by its code, never by its message: the
          // message is developer text and may change.
          setAnnouncement(playerErrorText(error));
          setMatchState(engine.getState());
        }
      }
    },
    [engine, matchState, outRule, history, correctionTarget],
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
    // The format travels with the match: "Play again" must not silently
    // drop the best-of-N the players chose.
    startMatch(names, {
      outRule,
      boardSource,
      ...(legs === undefined ? {} : { legs }),
      ...(sets === undefined ? {} : { sets }),
    });
  }, [boardSource, legs, outRule, playerNames, sets, startMatch]);

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-[1440px] py-2xl">
        <PlayerSetup
          modeName={modeName}
          modeDescription={`Classic x01 — start at ${startScore} and count down to zero. The match format and the checkout rule are chosen below.`}
          modeIcon={Target}
          minPlayers={1}
          maxPlayers={4}
          matchFormat={MATCH_FORMATS}
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
  // The leg and the set in play. The won-counts come from the engine's own
  // state, the sizes from the configuration the match was started with.
  const legSet = matchState ? legSetProgress(matchState, { legs, sets }) : {};
  // The darts of the turn in progress, straight from the ledger. The turn is
  // not the visit: it belongs to the player who is throwing, so it is empty
  // right after a player change — the reset the input area needs.
  const turn = history.currentTurn;

  return (
    <MatchLayout
      input={
        <ThrowInputPad
          throwsInCurrentTurn={matchState?.throwsInCurrentTurn ?? 0}
          armedSegment={armedSegment}
          onArmedSegmentChange={setArmedSegment}
          onThrow={recordThrow}
          disabled={matchState?.status === "completed"}
          showSegmentControl={inputMode.mode !== "board"}
        />
      }
      inputMode={inputMode.mode}
      onInputModeChange={inputMode.onChange}
      modeName={modeName}
      badge={checkoutLabel(outRule)}
      sourceLabel={boardSourceLabel(boardSource)}
      scoreboard={
        matchState && (
          <PlayerScoreboard
            players={matchState.players.map((player) => ({
              id: player.id,
              name: playerNames[player.id] ?? player.id,
              value: player.totalPoints,
              isCurrent: player.id === currentPlayerId,
            }))}
            // The leg and the set stand in the score sheet's header, so the
            // fact is on the screen once and not twice.
            data={{
              kind: "x01",
              checkoutLabel: checkoutLabel(outRule),
            }}
          />
        )
      }
      visit={
        <VisitTracker canUndo={history.canUndo} onUndo={handleUndo}>
          <ThrowHistoryControls
            throws={turn}
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
      onBackToHub={() => router.push(withBasePath("/game-center"))}
      armedSegment={armedSegment}
      onArmedSegmentChange={setArmedSegment}
      onBoardThrow={handleBoardThrow}
    >
      {matchState && (
        <ScoreDisplay
          players={[...matchState.players]}
          currentPlayerId={currentPlayerId}
          playerNames={playerNames}
          throwHistory={[...matchState.throws]}
          leg={legSet.leg}
          set={legSet.set}
          caption="Remaining"
        />
      )}
      <MatchStatus message={announcement} />
    </MatchLayout>
  );
}

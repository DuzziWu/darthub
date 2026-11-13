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
import { VisitChips, visitBadge } from "@/components/game/VisitChips";
import { SECONDARY_BUTTON } from "@/components/game/classes";
import type { PlayerSetupOptions, VisitEntry } from "@/components/game/types";
import { GameEngine } from "@/game-engine/GameEngine";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { OUT_RULE_CHOICES } from "@/game-engine/modes/registry";
import { getOutRule, type OutRule } from "@/game-engine/rules";
import {
  GameEngineStateError,
  type MatchState,
  type OutRuleId,
  type ThrowInput,
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
 * - the **visit** of every player — the darts of the turn in progress, each
 *   with the segment it landed on, so the score sheet can name a visit `T20`,
 *   `D16` or `S7`;
 * - the **bust record**, which is this view's own: the engine rejects a
 *   busting throw with a `GameEngineStateError` and leaves the match state
 *   untouched, so the BUST chip is decided here — from the rule in force and
 *   the score before the dart, never by reading the error's message.
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
  /** The visit of every player: the darts of the turn in progress. */
  const [visits, setVisits] = useState<Record<string, VisitEntry[]>>({});
  /** The player whose visit the strip shows — the last one to throw a dart. */
  const [visitOwner, setVisitOwner] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

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
      setVisits({});
      setVisitOwner(null);
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

      const previous = visits[playerId] ?? [];
      // A visit opens when the engine starts a new turn, and a busted visit
      // is void: the next dart opens a fresh one.
      const opensVisit =
        matchState.throwsInCurrentTurn === 0 || previous[previous.length - 1]?.bust === true;

      try {
        // A miss carries no segment at all: the engine rejects a segment on
        // a zero-scoring throw.
        const throwInput: ThrowInput =
          segment === undefined
            ? { playerId, points: input.points }
            : { playerId, points: input.points, segment };
        const state = engine.recordThrow(throwInput);
        const remainingAfter =
          state.players.find((player) => player.id === playerId)?.totalPoints ?? remainingBefore;
        const entry: VisitEntry = {
          playerId,
          points: input.points,
          remaining: remainingAfter,
          segment,
        };

        setVisits((current) => ({
          ...current,
          [playerId]: opensVisit ? [entry] : [...(current[playerId] ?? []), entry],
        }));
        setMatchState(state);
        setVisitOwner(playerId);
        setAnnouncement(
          `${visitBadge(entry)}, ${input.points} points. ${remainingAfter} remaining.`,
        );

        if (state.status === "completed") {
          setWinnerId(playerId);
          setPhase("result");
        }
      } catch (error) {
        if (bust && error instanceof GameEngineStateError) {
          // A bust consumes no dart and leaves the score alone, so the chip
          // is this view's own record of it.
          const entry: VisitEntry = {
            playerId,
            points: input.points,
            remaining: remainingBefore,
            segment,
            bust: true,
          };
          setVisits((current) => ({ ...current, [playerId]: [entry] }));
          setVisitOwner(playerId);
          setAnnouncement(`Bust. ${remainingBefore} remaining.`);
        } else {
          setAnnouncement(error instanceof Error ? error.message : "Invalid throw");
        }
      }
    },
    [engine, matchState, outRule, visits],
  );

  const handleBoardThrow = useCallback(
    (hit: { points: number; segment: ThrowSegment | null; label: string }) => {
      recordThrow({ points: hit.points, segment: hit.segment ?? undefined });
    },
    [recordThrow],
  );

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
  const stripOwner = visitOwner ?? currentPlayerId;
  const strip = stripOwner ? (visits[stripOwner] ?? []) : [];

  return (
    <MatchLayout
      modeName={modeName}
      badge={checkoutLabel(outRule)}
      sourceLabel={boardSourceLabel(boardSource)}
      visit={<VisitChips visit={strip} />}
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
          throwHistory={Object.values(visits).flat()}
          caption="Remaining"
        />
      )}

      <MatchStatus message={announcement} />

      <ThrowInputPad
        throwsInCurrentTurn={matchState?.throwsInCurrentTurn ?? 0}
        armedSegment={armedSegment}
        onArmedSegmentChange={setArmedSegment}
        onThrow={recordThrow}
        disabled={matchState?.status === "completed"}
      />
    </MatchLayout>
  );
}

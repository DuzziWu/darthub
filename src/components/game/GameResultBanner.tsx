"use client";

import { Trophy } from "lucide-react";
import type { GameResultBannerProps } from "./types";
import { DISABLED, FOCUS_RING, TARGET_SIZE } from "./classes";

/**
 * The result state.
 *
 * The display face, the leg it took, the final scores as a mini sheet and
 * two actions. No emoji: the trophy is a Lucide icon beside the headline,
 * never instead of it, and the winner is marked with the word WIN.
 */

/** The placing of a row, so the sheet never relies on colour. */
function placing(index: number, isWinner: boolean): string {
  if (isWinner) return "WIN";
  return `${index + 1}${["ST", "ND", "RD"][index] ?? "TH"}`;
}

export function GameResultBanner({
  winnerId,
  players,
  playerNames,
  onPlayAgain,
  onBackToHub,
  onUndo,
  leg,
  set,
}: GameResultBannerProps) {
  // The lowest remaining score won: the sheet is ordered by the result.
  const sheet = [...players].sort((a, b) => a.totalPoints - b.totalPoints);
  const winner = sheet.find((player) => player.id === winnerId) ?? null;
  const winnerName = winnerId ? (playerNames[winnerId] ?? winnerId) : null;
  const runnerUp = sheet.find((player) => player.id !== winnerId) ?? null;
  // The margin is the difference in the engine's own numbers: how many
  // points the runner-up was still behind with.
  const margin = winner && runnerUp ? runnerUp.totalPoints - winner.totalPoints : null;

  return (
    <section
      aria-label="Match result"
      className="rounded-md border border-rule bg-surface p-2xl space-y-xl"
    >
      <div className="flex items-start gap-md">
        <Trophy aria-hidden="true" className="h-8 w-8 shrink-0 text-brass" />
        <div>
          <h2 data-result-headline className="font-display text-display text-ink">
            {winnerName
              ? leg
                ? `${winnerName} takes leg ${leg.current}`
                : `${winnerName} wins`
              : "No winner"}
          </h2>
          <p className="font-body text-body text-ink-muted">
            {margin === null ? "The match is over." : `Won by ${margin} points.`}
            {leg && set && ` Leg ${leg.current}/${leg.total}, set ${set.current}/${set.total}.`}
          </p>
        </div>
      </div>

      {/* The final scores: a mini sheet, one row per player. */}
      <ul className="rounded-md border border-rule">
        {sheet.map((player, index) => {
          const isWinner = player.id === winnerId;
          return (
            <li
              key={player.id}
              data-result-row={player.id}
              className={`relative flex items-center justify-between border-b border-rule px-md py-sm last:border-b-0 ${
                isWinner ? "bg-raised" : ""
              }`}
            >
              {isWinner && (
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-brass" />
              )}
              <span
                className={`truncate font-label text-label ${
                  isWinner ? "text-ink" : "text-ink-muted"
                }`}
              >
                {playerNames[player.id] ?? player.id}
              </span>
              <span className="flex items-center gap-md">
                <span
                  className={`font-caption text-caption tracking-[0.04em] ${
                    isWinner ? "text-brass" : "text-ink-faint"
                  }`}
                >
                  {placing(index, isWinner)}
                </span>
                <span className="min-w-[3ch] text-right font-mono text-label tabular-nums text-ink">
                  {player.totalPoints}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-md">
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className={`${TARGET_SIZE} flex-1 rounded-sm border border-edge bg-raised font-label text-label text-ink transition-colors duration-fast hover:border-brass-deep hover:bg-board ${FOCUS_RING} ${DISABLED}`}
          >
            Undo last dart
          </button>
        )}
        <button
          type="button"
          onClick={onPlayAgain}
          className={`${TARGET_SIZE} flex-1 rounded-sm bg-brass font-label text-label text-board transition-colors duration-fast hover:bg-brass-deep ${FOCUS_RING} ${DISABLED}`}
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onBackToHub}
          className={`${TARGET_SIZE} flex-1 rounded-sm border border-edge bg-raised font-label text-label text-ink transition-colors duration-fast hover:border-brass-deep hover:bg-board ${FOCUS_RING} ${DISABLED}`}
        >
          Game Center
        </button>
      </div>
    </section>
  );
}

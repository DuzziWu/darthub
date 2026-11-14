"use client";

import { Check, X } from "lucide-react";
import type { ScoreDisplayProps } from "./types";
import { VISIT_BUST_CLASS, VISIT_COUNTED_CLASS, visitBadge } from "./VisitChips";

/**
 * The score sheet.
 *
 * A ruled list, one row per player: the remaining score in tabular figures,
 * the player's last visit, and the turn indicator. No cards, no colour wash
 * per player — a row is a row.
 */
export function ScoreDisplay({
  players,
  currentPlayerId,
  playerNames,
  throwHistory = [],
  leg,
  set,
  caption,
}: ScoreDisplayProps) {
  return (
    <section aria-label="Score sheet" className="rounded-md border border-rule bg-surface">
      <header className="flex items-center gap-md border-b border-rule px-md py-sm">
        <h2 className="flex-1 font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Players
        </h2>
        {leg && (
          <span className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
            Leg {leg.current}/{leg.total}
          </span>
        )}
        {set && (
          <span className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
            Set {set.current}/{set.total}
          </span>
        )}
        {/*
          The caption says what the number is — REMAINING, HIT, MARKS — and
          sits over the score column: the tally dots' width is reserved
          beside it, so the caption's right edge is the score's right edge.
        */}
        {caption && (
          <span className="min-w-[3ch] text-right font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
            {caption}
          </span>
        )}
        <span aria-hidden="true" className="w-[28px]" />
      </header>

      <ul>
        {players.map((player) => {
          const isCurrent = player.id === currentPlayerId;
          const visit = throwHistory.filter((entry) => entry.playerId === player.id).slice(-3);
          const name = playerNames[player.id] ?? player.id;

          return (
            <li
              key={player.id}
              data-row={player.id}
              className="relative flex min-h-11 items-center gap-md border-b border-rule px-md md:min-h-14"
            >
              {isCurrent && (
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-brass" />
              )}
              <span className="min-w-0 flex-1">
                <span
                  title={name}
                  className={`block truncate font-label text-label ${
                    isCurrent ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {name}
                </span>
                {isCurrent && (
                  <span className="font-caption text-caption tracking-[0.04em] text-brass">
                    ON TURN
                  </span>
                )}
              </span>

              {/* The visit: counted darts and busts, both named. */}
              <span className="flex items-center gap-sm">
                {visit.map((entry, index) =>
                  entry.bust ? (
                    <span key={index} data-visit="bust" className={VISIT_BUST_CLASS}>
                      <X aria-hidden="true" className="h-3 w-3" />
                      BUST
                    </span>
                  ) : (
                    <span key={index} data-visit="counted" className={VISIT_COUNTED_CLASS}>
                      <Check aria-hidden="true" className="h-3 w-3" />
                      {visitBadge(entry)}
                    </span>
                  ),
                )}
              </span>

              {/* The remaining score: a fixed column of tabular figures. */}
              <span
                data-score={player.id}
                className="min-w-[3ch] text-right font-mono text-score-lg font-bold tabular-nums text-ink md:text-score-xl"
              >
                {player.totalPoints}
              </span>

              {/* Three dots, always three: the darts of the last visit. */}
              <span className="flex items-center gap-xs" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className={`h-2 w-2 rounded-full ${
                      dot < visit.length ? "bg-brass" : "border border-edge"
                    }`}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

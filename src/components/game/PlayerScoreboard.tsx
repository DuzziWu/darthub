"use client";

import type { PlayerScoreboardProps, ScoreboardData } from "./types";
import { SCOREBOARD_ACTIVE_RAIL, SCOREBOARD_HEADER, SCOREBOARD_SURFACE } from "./classes";

/**
 * The player overview: the ruled rows above the input.
 *
 * The active player is a **row**, not a card: a 2 px brass rail, the name in
 * `text-ink` and the words "AM ZUG". The other players are plain rows
 * underneath — no cards, no rounded boxes, no colour wash per player
 * (design-system/darthub/pages/match.md §4).
 *
 * The number is a fixed column of tabular figures, so the value never
 * reflows as it falls. Its *meaning* is the mode's: REMAINING in x01, HIT in
 * around the clock, MARKS in shanghai, and no score column at all in
 * cricket, where the targets are the score (§5).
 *
 * The data is a union, not a merged record: the switch on `kind` is
 * exhaustive, so a new mode has to bring its own shape instead of being
 * squeezed into a generic field that every mode would then interpret on its
 * own.
 *
 * The markers are `data-remaining` and `data-active-player`. There is
 * deliberately **no** `data-score` here: that marker belongs to the existing
 * score sheet, and two elements carrying it would make a `.first()` lookup
 * ambiguous.
 */

/** The caption of the score column, per mode. */
const SCORE_CAPTION: Record<Exclude<ScoreboardData["kind"], "cricket">, string> = {
  x01: "Remaining",
  aroundTheClock: "Hit",
  shanghai: "Marks",
};

/**
 * The mode's own facts, read from the variant that belongs to it.
 *
 * Only the facts the mode's own sheet does **not** already show belong
 * here: the Shanghai sheet states its round and its target, and the
 * Around the Clock sheet states its target, so repeating them here would
 * put the same words on the screen twice.
 */
function modeFacts(data: ScoreboardData): string {
  switch (data.kind) {
    case "x01":
      return data.checkoutLabel;
    case "cricket":
      return `${data.marksToClose} marks to close`;
    case "aroundTheClock":
      return `${data.targetIndex + 1} / ${data.targetCount}`;
    case "shanghai":
      return `${data.totalRounds} rounds`;
  }
}

/** The extra line of a row, per mode: what its number means right now. */
function rowDetail(playerId: string, data: ScoreboardData): string | null {
  switch (data.kind) {
    case "x01":
      return null;
    case "cricket": {
      // Cricket has no score column: the marks on the closed targets are
      // the score, and they are counted here rather than in the number.
      const marks = data.marks[playerId] ?? {};
      const closed = data.targets.filter(
        (target) => (marks[String(target)] ?? 0) >= data.marksToClose,
      ).length;
      return `${closed} / ${data.targets.length} closed`;
    }
    case "aroundTheClock": {
      const progress = data.playerProgress[playerId] ?? 0;
      return `${progress} / ${data.targetCount} targets hit`;
    }
    case "shanghai": {
      const record = data.roundRecords[playerId];
      if (!record) return null;
      const segments = [
        record.hitSingle ? "S" : null,
        record.hitDouble ? "D" : null,
        record.hitTriple ? "T" : null,
      ].filter((segment) => segment !== null);
      return segments.length === 0
        ? "no segment hit"
        : `${segments.join(" ")} · ${record.marks} marks`;
    }
  }
}

export function PlayerScoreboard({ players, data }: PlayerScoreboardProps) {
  const caption = data.kind === "cricket" ? null : SCORE_CAPTION[data.kind];
  const leg = data.kind === "x01" ? data.leg : undefined;
  const set = data.kind === "x01" ? data.set : undefined;

  return (
    <section aria-label="Player overview" className={SCOREBOARD_SURFACE}>
      <header className={SCOREBOARD_HEADER}>
        <span className="flex-1 truncate">Players</span>
        {leg && (
          <span className="shrink-0">
            Leg {leg.current}/{leg.total}
          </span>
        )}
        {set && (
          <span className="shrink-0">
            Set {set.current}/{set.total}
          </span>
        )}
        <span className="truncate">{modeFacts(data)}</span>
        {caption && <span className="min-w-[3ch] text-right">{caption}</span>}
      </header>

      <ul>
        {players.map((player) => {
          const detail = rowDetail(player.id, data);
          return (
            <li
              key={player.id}
              data-active-player={player.isCurrent ? "true" : "false"}
              className={`flex items-center gap-md border-b border-rule px-md ${
                // The active player is promoted: a taller row, so the eye
                // finds it before it reads the number.
                player.isCurrent ? "min-h-16" : "min-h-11"
              } ${player.isCurrent ? SCOREBOARD_ACTIVE_RAIL : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span
                  title={player.name}
                  className={`block truncate font-label text-label ${
                    player.isCurrent ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {player.name}
                </span>
                {player.isCurrent && (
                  <span className="font-caption text-caption tracking-[0.04em] text-brass">
                    AM ZUG
                  </span>
                )}
              </span>

              {/* The mode's own detail for this player: the closed cricket
                  targets, the targets hit, the segments of the round. */}
              {detail && (
                <span className="max-w-[14ch] truncate font-caption text-caption text-ink-faint">
                  {detail}
                </span>
              )}

              {/* The score: a fixed column of tabular figures, so the
                  number does not jump when it changes. */}
              {caption && (
                <span
                  data-remaining={player.id}
                  className={`min-w-[3ch] text-right font-mono tabular-nums ${
                    player.isCurrent
                      ? "text-score-xl font-bold text-ink"
                      : "text-score-lg font-bold text-ink-muted"
                  }`}
                >
                  {player.value}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

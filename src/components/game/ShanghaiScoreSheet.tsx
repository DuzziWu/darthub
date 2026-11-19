"use client";

import { Check } from "lucide-react";
import type { ShanghaiScoreSheetProps } from "./types";

/**
 * The shanghai score surface.
 *
 * The mode has rounds, not legs: the round in play, its target, the marks
 * scored in every round, and the three segments that make a Shanghai.
 *
 * The sheet is **one table**: a row per player, a column per round and a
 * total column. Shanghai has no shared score — the marks belong to the
 * player who threw them — so the marks of a round sit in that player's own
 * row and the two players' rounds can never mix.
 *
 * The numbers are tabular and the columns are fixed, so a mark that arrives
 * never moves the grid (MASTER.md §4.2). The round in play is marked by
 * the brass column head and by `aria-current`, never by colour alone.
 */

/** The three segments of a round, in the order they are hit. */
const SEGMENTS = [
  { id: "single", label: "S", name: "Single" },
  { id: "double", label: "D", name: "Double" },
  { id: "triple", label: "T", name: "Triple" },
] as const;

export function ShanghaiScoreSheet({
  currentRound,
  totalRounds,
  targets,
  players,
  currentPlayerId,
  hit,
}: ShanghaiScoreSheetProps) {
  const round = Math.min(currentRound, totalRounds);
  const target = targets[round - 1] ?? round;
  const shanghai = hit.single && hit.double && hit.triple;
  const finished = currentRound > totalRounds;

  return (
    <section aria-label="Shanghai rounds" className="rounded-md border border-rule bg-surface">
      <header className="flex items-baseline justify-between gap-md border-b border-rule px-md py-sm">
        <h2 className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Round {round} / {totalRounds}
        </h2>
        <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Target {target}
        </p>
      </header>

      {/* The round table: a row per player, a column per round, a total. */}
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-rule">
            <th
              scope="col"
              className="px-sm py-xs text-left font-caption text-caption uppercase tracking-[0.04em] text-ink-faint"
            >
              Player
            </th>
            {targets.map((value, index) => {
              const number = index + 1;
              const active = number === round && !finished;

              return (
                <th
                  key={number}
                  scope="col"
                  /* The head names the round and its target, so the column
                     is never a bare digit. The visible figure is the target:
                     it is what the player has to hit, and in Shanghai it is
                     the round's own number. */
                  aria-label={`Round ${number}, target ${value}`}
                  aria-current={active ? "true" : undefined}
                  className="w-[1.75rem] px-xs py-xs text-center font-normal"
                >
                  <span
                    className={`block font-mono text-label font-medium ${
                      active ? "text-brass" : "text-ink-muted"
                    }`}
                  >
                    {value}
                  </span>
                </th>
              );
            })}
            <th
              scope="col"
              className="w-[3rem] border-l border-rule px-xs py-xs text-center font-caption text-caption uppercase tracking-[0.04em] text-ink-faint"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const total = player.marksByRound.reduce((sum, marks) => sum + marks, 0);

            return (
              <tr key={player.id} className="border-b border-rule last:border-b-0">
                <th scope="row" className="px-sm py-xs text-left font-normal">
                  {/* The name is its own element and the marker is its
                      sibling: a cell that concatenated them could not be
                      found by the player's name. */}
                  <span className="flex items-baseline gap-xs">
                    <span
                      title={player.name}
                      className="min-w-0 truncate font-label text-label text-ink"
                    >
                      {player.name}
                    </span>
                    {player.id === currentPlayerId && (
                      <span className="shrink-0 font-caption text-caption uppercase tracking-[0.04em] text-brass">
                        · ON TURN
                      </span>
                    )}
                  </span>
                </th>
                {targets.map((value, index) => {
                  const number = index + 1;
                  const marks = player.marksByRound[index] ?? 0;

                  return (
                    <td
                      key={number}
                      aria-label={`Round ${number}, target ${value}, ${marks} marks`}
                      className={`px-xs py-xs text-center font-mono text-label tabular-nums ${
                        marks > 0 ? "text-treble" : "text-ink-faint"
                      }`}
                    >
                      {marks}
                    </td>
                  );
                })}
                <td className="border-l border-rule px-xs py-xs text-center font-mono text-label font-medium tabular-nums text-ink">
                  {total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* The three segments of the round in play. */}
      <div className="flex items-center gap-md border-t border-rule px-md py-sm">
        {SEGMENTS.map((segment) => (
          <span
            key={segment.id}
            aria-label={`${segment.name}, ${hit[segment.id] ? "hit" : "missed"}`}
            className={`flex items-center gap-xs font-mono text-caption ${
              hit[segment.id] ? "text-treble" : "text-ink-faint"
            }`}
          >
            {segment.label}
            {hit[segment.id] ? (
              <Check aria-hidden="true" className="h-3 w-3" />
            ) : (
              <span aria-hidden="true">·</span>
            )}
          </span>
        ))}
        <span className="ml-auto font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          {finished ? "Match complete" : shanghai ? "Shanghai" : "Shanghai possible"}
        </span>
      </div>
    </section>
  );
}

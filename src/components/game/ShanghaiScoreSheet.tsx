"use client";

import { Check } from "lucide-react";
import type { ShanghaiScoreSheetProps } from "./types";

/**
 * The shanghai score surface.
 *
 * The mode has rounds, not legs: the round in play, its target, the marks
 * scored in every round, and the three segments that make a Shanghai.
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
  marksByRound,
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

      {/* Every round: its number, its target and the marks it scored. */}
      <ul className="grid grid-cols-7 gap-xs p-sm md:grid-cols-7 md:p-md">
        {targets.map((value, index) => {
          const number = index + 1;
          const marks = marksByRound[String(number)] ?? 0;
          const active = number === round && !finished;

          return (
            <li
              key={number}
              aria-label={`Round ${number}, target ${value}, ${marks} marks`}
              className={`rounded-xs border px-xs py-xs text-center ${
                active ? "border-brass bg-raised" : "border-rule bg-sunken"
              }`}
            >
              <span className="block font-caption text-caption text-ink-faint">{number}</span>
              <span
                className={`block font-mono text-label ${active ? "text-brass" : "text-ink-muted"}`}
              >
                {value}
              </span>
              <span
                className={`block font-mono text-caption ${
                  marks > 0 ? "text-treble" : "text-ink-faint"
                }`}
              >
                {marks}
              </span>
            </li>
          );
        })}
      </ul>

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

"use client";

import type { AroundTheClockScoreSheetProps } from "./types";

/**
 * The around the clock score surface.
 *
 * The mode has one live number — the target in play — and one piece of
 * progress: how many of the targets have been hit. The target is a single
 * large figure in the mono face; the strip below it shows the whole run.
 */
export function AroundTheClockScoreSheet({ targets, currentIndex }: AroundTheClockScoreSheetProps) {
  const total = targets.length;
  const target = targets[currentIndex];
  const complete = target === undefined;

  return (
    <section
      aria-label="Around the clock target"
      className="rounded-md border border-rule bg-surface p-md"
    >
      <div className="flex items-baseline justify-between gap-md">
        <h2 className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          {complete ? "All targets hit" : "Current target"}
        </h2>
        <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Progress {currentIndex} / {total}
        </p>
      </div>

      <p
        data-current-target
        className="mt-md font-mono text-score-xl font-bold tabular-nums text-brass"
      >
        {complete ? currentIndex : target}
      </p>

      {/* The run: every target, hit, in play or still to come. */}
      <ul className="mt-md grid grid-cols-7 gap-xs">
        {targets.map((value, index) => {
          const hit = index < currentIndex;
          const active = index === currentIndex;

          return (
            <li
              key={value}
              aria-label={`${value}, ${active ? "current target" : hit ? "hit" : "not yet"}`}
              className={`rounded-xs border px-xs py-xs text-center font-mono text-caption ${
                active
                  ? "border-brass bg-raised text-brass"
                  : hit
                    ? "border-rule bg-sunken text-ink-muted"
                    : "border-rule bg-sunken text-ink-faint"
              }`}
            >
              {value}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

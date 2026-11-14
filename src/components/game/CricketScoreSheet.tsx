"use client";

import type { CricketScoreSheetProps } from "./types";

/**
 * The cricket score surface.
 *
 * Cricket has no remaining score: the targets are the score. Every target
 * shows its marks and whether it is closed, and the state is carried by the
 * marks and the word CLOSED — never by the colour alone.
 */

/** The bullseye is the target 25 and is named BULL on the sheet. */
function targetLabel(target: number): string {
  return target === 25 ? "BULL" : String(target);
}

export function CricketScoreSheet({
  targets,
  marks,
  marksToClose,
  playerName,
}: CricketScoreSheetProps) {
  return (
    <section aria-label="Cricket targets" className="rounded-md border border-rule bg-surface">
      <header className="flex items-center justify-between border-b border-rule px-md py-sm">
        <h2 className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Targets
        </h2>
        <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          {playerName ? `${playerName} · ` : ""}
          {marksToClose} marks to close
        </p>
      </header>

      {/* Five columns on a phone: the twenty targets are a readout, not
          touch targets, so they can be denser than the input pad. */}
      <ul className="grid grid-cols-5 gap-sm p-sm md:grid-cols-4 md:gap-md md:p-md">
        {targets.map((target) => {
          const key = String(target);
          const count = marks[key] ?? 0;
          const closed = count >= marksToClose;
          const label = targetLabel(target);

          return (
            <li
              key={key}
              aria-label={`${label}, ${count} of ${marksToClose} marks${closed ? ", closed" : ""}`}
              className={`rounded-sm border p-xs text-center md:p-md ${
                closed ? "border-brass bg-raised" : "border-rule bg-sunken"
              }`}
            >
              <span
                className={`block font-mono text-body font-bold md:text-heading ${
                  closed ? "text-brass" : "text-ink"
                }`}
              >
                {label}
              </span>

              {/* The marks: three pips, filled up to the marks taken. */}
              <span aria-hidden="true" className="mt-xs flex justify-center gap-xs">
                {[0, 1, 2].map((pip) => (
                  <span
                    key={pip}
                    className={`h-2 w-2 rounded-full ${
                      pip < count ? "bg-brass" : "border border-edge"
                    }`}
                  />
                ))}
              </span>

              <span
                className={`mt-xs block font-caption text-caption ${
                  closed ? "text-brass" : "text-ink-muted"
                }`}
              >
                {closed ? "CLOSED" : `${count}/${marksToClose}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

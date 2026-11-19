"use client";

import type { CricketScoreSheetProps } from "./types";

/**
 * The cricket score surface.
 *
 * Cricket has no remaining score: the targets are the score. Every target
 * shows its marks and whether it is closed, and the state is carried by the
 * marks and the word CLOSED — never by the colour alone.
 *
 * The sheet is **one sheet per player**: a cricket match has no shared
 * score, so every seated player gets their own target grid. The grid is
 * extracted into {@link PlayerTargets}, so the per-target markup exists
 * once and is not duplicated per player.
 */

/** The bullseye is the target 25 and is named BULL on the sheet. */
function targetLabel(target: number): string {
  return target === 25 ? "BULL" : String(target);
}

/** The target grid of one player: every target, its marks and its state. */
function PlayerTargets({
  targets,
  marks,
  marksToClose,
}: {
  targets: readonly number[];
  marks: Record<string, number>;
  marksToClose: number;
}) {
  return (
    /* Five columns on a phone: the twenty targets are a readout, not
        touch targets, so they can be denser than the input pad. */
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
  );
}

export function CricketScoreSheet({
  targets,
  marksToClose,
  players,
  currentPlayerId,
}: CricketScoreSheetProps) {
  return (
    <div className="space-y-lg">
      {players.map((player) => (
        <section
          key={player.id}
          aria-label={`${player.name} cricket targets`}
          className="rounded-md border border-rule bg-surface"
        >
          <header className="flex items-center justify-between gap-md border-b border-rule px-md py-sm">
            {/* The name is its own element and the marker is its sibling:
                a heading that concatenated them could not be found by the
                player's name, and "ON TURN" would become part of it. */}
            <h2 className="flex items-center gap-xs font-label text-label text-ink">
              <span>{player.name}</span>
              {player.id === currentPlayerId && (
                <span className="font-caption text-caption uppercase tracking-[0.04em] text-brass">
                  · ON TURN
                </span>
              )}
            </h2>
            <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
              {marksToClose} marks to close
            </p>
          </header>

          <PlayerTargets targets={targets} marks={player.marks} marksToClose={marksToClose} />
        </section>
      ))}
    </div>
  );
}

"use client";

import type { AroundTheClockScoreSheetProps } from "./types";

/**
 * The around the clock score surface.
 *
 * The mode has one live number **per player** — the target that player is
 * aiming at — and one piece of progress per player: how many of the targets
 * they have hit. The target is a single large figure in the mono face; the
 * strip below it shows that player's whole run.
 *
 * The sheet is **one sheet per player**: around the clock has no shared
 * score, so every seated player walks their own run of the 21 targets and a
 * component that could show one player's target could never show a match.
 */
export function AroundTheClockScoreSheet({
  targets,
  players,
  currentPlayerId,
}: AroundTheClockScoreSheetProps) {
  const total = targets.length;

  return (
    <div className="space-y-lg">
      {players.map((player) => {
        const target = targets[player.currentIndex];
        const complete = target === undefined;

        return (
          <section
            key={player.id}
            aria-label={`${player.name} around the clock`}
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
            </header>

            <div className="p-md">
              <div className="flex items-baseline justify-between gap-md">
                <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
                  {complete ? "All targets hit" : "Current target"}
                </p>
                {/* The progress belongs to this player, so it lives in this
                    player's section: with two players an unscoped lookup
                    finds two of them. */}
                <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
                  Progress {player.hits} / {total}
                </p>
              </div>

              <p
                data-current-target
                className="mt-xs font-mono text-score-md font-bold tabular-nums text-brass md:mt-md md:text-score-xl"
              >
                {complete ? player.currentIndex : target}
              </p>

              {/* The run: every target, hit, in play or still to come. */}
              <ul className="mt-xs grid grid-cols-11 gap-xs md:mt-md md:grid-cols-7">
                {targets.map((value, index) => {
                  const hit = index < player.hits;
                  const active = index === player.currentIndex;

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
            </div>
          </section>
        );
      })}
    </div>
  );
}

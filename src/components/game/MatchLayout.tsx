"use client";

import { DartBoard } from "@/components/board";
import { useIsCompact } from "./useIsCompact";
import type { MatchLayoutProps } from "./types";
import { MATCH_BADGE, MATCH_SOURCE, MATCH_STRIP, MATCH_TITLE, SECONDARY_BUTTON } from "./classes";

/**
 * The match view.
 *
 * The throw strip runs along the top, the board sits in its well on the left
 * and the mode's score surface stands on the right. The board is the only
 * pointer path: the dart pad beside it is the keyboard and touch path, and
 * the two share one armed band, owned by the match view.
 *
 * Below the md breakpoint the board stops being an input — its treble band
 * is a few pixels tall and a finger is far wider — so it becomes a read-only
 * preview and the pad is the input. The same rule governs all five modes.
 *
 * All five modes share this layout, so the strip's type and chrome come from
 * `classes.ts` rather than from each view.
 */
export function MatchLayout({
  modeName,
  badge,
  sourceLabel,
  visit,
  actions,
  onBackToHub,
  armedSegment,
  onBoardThrow,
  children,
}: MatchLayoutProps) {
  const compact = useIsCompact();

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-xl py-xl">
      {/* The throw strip. */}
      <section aria-label="Match header" className={MATCH_STRIP}>
        <div className="flex items-baseline gap-lg">
          <h1 className={MATCH_TITLE}>{modeName}</h1>
          {badge && <span className={MATCH_BADGE}>{badge}</span>}
          {sourceLabel && <span className={MATCH_SOURCE}>{sourceLabel}</span>}
        </div>

        {visit}

        <div className="ml-auto flex items-center gap-md">
          {actions}
          <button type="button" onClick={onBackToHub} className={SECONDARY_BUTTON}>
            Game Center
          </button>
        </div>
      </section>

      {/* The board on one side, the mode's surface on the other. */}
      <div className="grid gap-xl lg:grid-cols-[minmax(0,1fr)_25rem] xl:grid-cols-[minmax(0,1fr)_30rem] lg:items-start">
        {/* The board is last in the reading order on a phone: the pad is the input. */}
        <div className="order-2 flex flex-col items-center lg:order-1">
          <DartBoard armedSegment={armedSegment} onThrow={onBoardThrow} readOnly={compact} />
          {compact && (
            <div className="mt-md max-w-[44ch] text-center">
              <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
                Last dart
              </p>
              <p className="mt-xs font-body text-caption text-ink-faint">
                The board is a preview at this width — the pad is the input.
              </p>
            </div>
          )}
        </div>
        <div className="order-1 space-y-xl lg:order-2">{children}</div>
      </div>
    </div>
  );
}

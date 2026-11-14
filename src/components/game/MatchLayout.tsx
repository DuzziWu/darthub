"use client";

import { LayoutGrid } from "lucide-react";
import { DartBoard } from "@/components/board";
import { InputModeSwitch } from "./InputModeSwitch";
import { SegmentControl } from "./SegmentControl";
import { useIsCompact } from "./useIsCompact";
import type { MatchLayoutProps } from "./types";
import {
  FOCUS_RING,
  MATCH_BADGE,
  MATCH_SOURCE,
  MATCH_STRIP,
  MATCH_TITLE,
  SECONDARY_BUTTON,
  TARGET_SIZE,
} from "./classes";

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
  inputMode = "manual",
  onInputModeChange,
  badge,
  sourceLabel,
  visit,
  actions,
  onBackToHub,
  armedSegment,
  onArmedSegmentChange,
  onBoardThrow,
  children,
  input,
}: MatchLayoutProps) {
  const compact = useIsCompact();
  // Below the md breakpoint the board stops being an input of its own: its
  // treble band is a handful of pixels tall and a finger is far wider. The
  // player chooses the board explicitly, so the board follows that choice
  // rather than the width.
  const boardIsInput = inputMode === "board";
  const boardReadOnly = compact && !boardIsInput;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-xl py-xl">
      {/* The throw strip. */}
      <section aria-label="Match header" className={MATCH_STRIP}>
        <div className="flex flex-wrap items-center gap-lg">
          <h1 className={MATCH_TITLE}>{modeName}</h1>
          {badge && <span className={MATCH_BADGE}>{badge}</span>}
          {/* The source is a note, not a control: on a phone it costs a
              whole extra row in the strip, so it stays on the wide layout. */}
          {sourceLabel && <span className={`${MATCH_SOURCE} hidden md:inline`}>{sourceLabel}</span>}
          {onInputModeChange && <InputModeSwitch mode={inputMode} onChange={onInputModeChange} />}
        </div>

        {/* The darts of the visit and the actions share one row on a phone:
            three rows of strip push the board and the score sheet out of
            the fold. */}
        <div className="flex flex-wrap items-center gap-md">
          <div className="min-w-0 flex-1">{visit}</div>
          <div className="ml-auto flex items-center gap-sm md:hidden">
            {actions}
            <button
              type="button"
              onClick={onBackToHub}
              aria-label="Game Center"
              className={`${TARGET_SIZE} rounded-sm border border-edge bg-raised px-sm font-label text-label text-ink transition-colors duration-fast hover:border-brass-deep hover:bg-board ${FOCUS_RING}`}
            >
              <LayoutGrid aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="hidden items-center gap-md md:ml-auto md:flex">
          {actions}
          <button type="button" onClick={onBackToHub} className={SECONDARY_BUTTON}>
            Game Center
          </button>
        </div>
      </section>

      {/* The board on one side, the mode's surface on the other. On a phone the
          grid has one column and the three blocks are sorted with order: the
          pad first, because it holds the miss key, then the board, then the
          score sheet. From lg on the two columns return and the desktop
          arrangement is placed explicitly: board left, pad and score right. */}
      <div className="grid gap-xl lg:grid-cols-[minmax(0,1fr)_25rem] lg:grid-rows-[auto_auto] xl:grid-cols-[minmax(0,1fr)_30rem] lg:items-start">
        {/* The board. On a phone it is the read-only preview at the end in the
            manual mode and the scored surface right under the pad in the
            board mode. */}
        <div className="order-2 flex flex-col items-center lg:order-1 lg:col-start-1 lg:row-start-1">
          {/* The band the board scores is chosen above the board: a treble
              band on a phone board is a few pixels tall and a finger is far
              wider, so the arming comes first and the wide single band is
              the tap target. On a phone the pad above carries the same
              arming, so the board does not repeat it in a block of its own. */}
          {boardIsInput && onArmedSegmentChange && (
            <div className="mb-md hidden w-full max-w-[400px] rounded-md border border-rule bg-surface p-md lg:block">
              <SegmentControl
                armedSegment={armedSegment}
                onArmedSegmentChange={onArmedSegmentChange}
                idPrefix="board-segment"
                compact
              />
            </div>
          )}
          <DartBoard armedSegment={armedSegment} onThrow={onBoardThrow} readOnly={boardReadOnly} />
          {compact && !boardIsInput && (
            /* The preview's label, not a separate block: the design calls the
               board a preview labelled "LAST DART", and a caption of its own
               costs a whole row of the phone's fold. One line, so it costs a
               line and not two. */
            <p className="mt-sm text-center font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
              Last dart · preview only
            </p>
          )}
        </div>
        {/* The pad. It comes first on a phone in both modes: the miss key has
            to stay above the tab bar, also when the board is the surface. */}
        {input && <div className="order-1 lg:order-2 lg:col-start-2 lg:row-start-1">{input}</div>}
        {/* The score sheet. On a phone it is the last block, under the board:
            the pad and the board are the input, the sheet is read. */}
        <div className="order-3 lg:order-3 lg:col-start-2 lg:row-start-2">{children}</div>
      </div>
    </div>
  );
}

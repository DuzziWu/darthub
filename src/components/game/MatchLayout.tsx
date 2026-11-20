"use client";

import { LayoutGrid } from "lucide-react";
import { DartBoard } from "@/components/board";
import { InputModeSwitch } from "./InputModeSwitch";
import { SegmentControl } from "./SegmentControl";
import { useIsCompact } from "./useIsCompact";
import type { MatchLayoutProps } from "./types";
import { MATCH_BADGE, MATCH_SOURCE, MATCH_STRIP, MATCH_TITLE, SECONDARY_BUTTON } from "./classes";

/**
 * The match view.
 *
 * The screen is read in one order, and the order is the whole point of the
 * layout on a phone:
 *
 * 1. the match strip — the mode, the rule in force, the input mode;
 * 2. the player overview — who is on throw and what is left;
 * 3. the turn tracker — the darts of the turn and the undo;
 * 4. the band switch, above the surface that uses it;
 * 5. the active input surface — the pad **or** the board, never both;
 * 6. everything else — the score sheet, the status line, the mode's panels.
 *
 * The two input surfaces are separated: in the manual mode the pad is the
 * input and the board stays a read-only preview, in the board mode the board
 * is the input and the pad is not in the document at all. A hidden but
 * focusable pad would be a trap for the keyboard and a lie for the screen
 * reader.
 *
 * The band switch is rendered **once**: it stands above whichever surface is
 * the input. Two switches with the same radio name would make the end-to-end
 * suite's strict role queries ambiguous.
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
  scoreboard,
  visit,
  history,
  actions,
  onBackToHub,
  armedSegment,
  onArmedSegmentChange,
  onBoardThrow,
  children,
  input,
}: MatchLayoutProps) {
  const compact = useIsCompact();
  // The player chooses the board explicitly, so the board follows that
  // choice rather than the width: below the md breakpoint the board's treble
  // band is a handful of pixels tall and a finger is far wider, so it is a
  // read-only preview unless it has been chosen as the input.
  const boardIsInput = inputMode === "board";
  const boardReadOnly = compact && !boardIsInput;

  return (
    <div
      /* The rhythm of the page is tighter on a phone: the score sheet, the
         tracker and the input all have to fit above the tab bar, and the
         design asks for density on this page. The wide layout keeps the
         roomier rhythm. */
      className="mx-auto w-full max-w-[1200px] space-y-sm py-sm md:space-y-lg md:py-lg"
    >
      {/* 1 — the match strip. One row: the mode, the rule in force and the
          input mode. The visit and the undo live in the input area now, so
          the strip no longer wraps to three rows on a phone.

          On a phone the badge and the source step aside: the mode's own
          facts are in the overview's header, right below, and the strip has
          to stay on one line for the pad to fit above the tab bar. */}
      <section aria-label="Match header" className={MATCH_STRIP}>
        <h1 className={`${MATCH_TITLE} min-w-0 truncate`}>{modeName}</h1>
        {badge && <span className={`${MATCH_BADGE} hidden shrink-0 md:inline-block`}>{badge}</span>}
        {/* The source is a note, not a control: on a phone it costs a
            whole extra row in the strip, so it stays on the wide layout. */}
        {sourceLabel && <span className={`${MATCH_SOURCE} hidden md:inline`}>{sourceLabel}</span>}

        <div className="ml-auto flex shrink-0 items-center gap-sm">
          {actions}
          {onInputModeChange && <InputModeSwitch mode={inputMode} onChange={onInputModeChange} />}
          {/* The mobile tab bar carries the Game Center, so the strip only
              offers it where the tab bar does not exist. */}
          <button
            type="button"
            onClick={onBackToHub}
            className={`${SECONDARY_BUTTON} hidden md:inline-flex`}
          >
            <LayoutGrid aria-hidden="true" className="h-5 w-5" />
            Game Center
          </button>
        </div>
      </section>

      {/* 2 — the player overview: who is on throw and what is left. It is
          not sticky: a second sticky band would eat a third of the fold. */}
      {scoreboard}

      {/* 3 — the turn tracker, with the undo. */}
      {visit}

      {/* 4 and 5 — the band switch and the active input surface. The switch
          belongs to the surface that uses it: inside the pad in the manual
          mode, above the board in the board mode. */}
      <div className="grid gap-md md:gap-lg lg:grid-cols-[minmax(0,1fr)_25rem] lg:grid-rows-[auto_auto] xl:grid-cols-[minmax(0,1fr)_30rem] lg:items-start">
        {/* The pad. It is the input in the manual mode only: in the board
            mode it is not in the document at all, so there is no second,
            focusable input surface competing with the board. */}
        {input && !boardIsInput && (
          <div className="order-1 lg:order-2 lg:col-start-2 lg:row-start-1">{input}</div>
        )}

        {/* The board. In the board mode it is the input and carries the band
            switch above it. In the manual mode it stays in the document as
            the read-only preview, but it never takes the tap.

            On a phone the preview is the **last** block, below the mode's own
            panels: board.md §8.3 puts the board preview at the end of the
            phone's reading order, and the fixed tab bar owns the bottom of
            the viewport — a preview whose middle sat under it would hand a
            tap on the board to the navigation. Below the fold, it is read
            by scrolling and never competes with the tab bar. */}
        <div
          className={`flex flex-col items-center lg:col-start-1 lg:row-start-1 ${
            boardIsInput ? "order-1 lg:order-1" : "order-3 lg:order-1"
          }`}
        >
          {boardIsInput && onArmedSegmentChange && (
            <div className="mb-md w-full max-w-[400px] rounded-md border border-rule bg-surface p-md">
              <SegmentControl
                armedSegment={armedSegment}
                onArmedSegmentChange={onArmedSegmentChange}
                idPrefix="board-segment"
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

        {/* 6 — everything else: the score sheet, the history, the status
            line, the mode's own panels. It is read, never tapped for a
            throw. On a phone it sits between the input and the board
            preview. */}
        <div className="order-2 lg:order-3 lg:col-start-2 lg:row-start-2">
          {children}
          {history}
        </div>
      </div>
    </div>
  );
}

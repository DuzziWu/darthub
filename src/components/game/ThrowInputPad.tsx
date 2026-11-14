"use client";

import type { ThrowInputPadProps } from "./types";
import { SegmentControl, SEGMENT_MULTIPLIER, SEGMENT_NAME } from "./SegmentControl";
import { DISABLED, FOCUS_RING, TARGET_SIZE } from "./classes";

/**
 * The dart pad — the keyboard, touch and screen-reader path to a throw.
 *
 * The old pad was a flat grid of every score from 0 to 60, which cannot
 * express a double: `16` is a single 16 or a double 16, and under double
 * out that ambiguity is a bug. The pad therefore arms a band first and then
 * picks a sector, and it sends the segment with the score.
 *
 * The armed band is shared state: it is owned by the match view and read by
 * the board as well, so the two surfaces are two views of one thing.
 */

/** The twenty sectors of the board. */
const SECTORS: readonly number[] = Array.from({ length: 20 }, (_unused, index) => index + 1);

/** The key face: 44px, a radius of 3px, and the surface colours. */
const KEY = `${TARGET_SIZE} rounded-sm border border-edge bg-raised text-body text-ink transition-colors duration-fast hover:border-brass-deep hover:bg-board active:translate-y-px active:bg-sunken ${FOCUS_RING} ${DISABLED}`;

/** A sector key: a number, so it wears the tabular mono face. */
const NUMBER_KEY = `${KEY} font-mono`;

export function ThrowInputPad({
  throwsInCurrentTurn,
  armedSegment,
  onArmedSegmentChange,
  onThrow,
  disabled = false,
}: ThrowInputPadProps) {
  return (
    <section
      aria-label="Dart pad"
      className="rounded-md border border-rule bg-surface p-md space-y-md md:p-lg md:space-y-lg"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Dart pad
        </h2>
        <p className="font-mono text-caption text-ink-muted">{throwsInCurrentTurn} / 3 darts</p>
      </div>

      {/* The armed band. The only segment control in the product. */}
      <SegmentControl
        armedSegment={armedSegment}
        onArmedSegmentChange={onArmedSegmentChange}
        disabled={disabled}
      />

      {/* The twenty sectors. */}
      <div>
        {/* On a phone the caption shares the row with the keys: stacked, it
            costs a row of the fold that the pad cannot spare. */}
        <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint md:mt-sm">
          Sectors
        </p>
        {/* Five columns keep the pad one row shorter on a phone, which is
            what lifts the miss row above the tab bar. */}
        <div className="mt-xs grid grid-cols-5 gap-sm md:mt-sm">
          {SECTORS.map((sector) => {
            const points = sector * SEGMENT_MULTIPLIER[armedSegment];
            return (
              <button
                key={sector}
                type="button"
                disabled={disabled}
                aria-label={`${SEGMENT_NAME[armedSegment]} ${sector}, ${points} points`}
                onClick={() => onThrow({ points, segment: armedSegment })}
                className={NUMBER_KEY}
              >
                {sector}
              </button>
            );
          })}
        </div>
      </div>

      {/* The bulls and the miss. The bull is a place, not a multiplier. */}
      <div>
        <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint md:mt-sm">
          Bull &amp; miss
        </p>
        <div className="mt-xs grid grid-cols-3 gap-md md:mt-sm">
          <button
            type="button"
            disabled={disabled}
            aria-label="Inner bull, 50 points"
            onClick={() => onThrow({ points: 50, segment: "bull" })}
            className={NUMBER_KEY}
          >
            50
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label="Outer bull, 25 points"
            onClick={() => onThrow({ points: 25, segment: "bull" })}
            className={NUMBER_KEY}
          >
            25
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label="Miss, 0 points"
            // A miss carries no segment: the engine rejects a segment on a
            // zero-scoring throw.
            onClick={() => onThrow({ points: 0 })}
            className={KEY}
          >
            MISS
          </button>
        </div>
      </div>
    </section>
  );
}

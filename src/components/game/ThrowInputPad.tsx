"use client";

import type { ArmedSegment, ThrowInputPadProps } from "./types";
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

/** The three bands the numeral route can score. */
const SEGMENTS: ReadonlyArray<{
  id: ArmedSegment;
  label: string;
  name: string;
  multiplier: number;
}> = [
  { id: "single", label: "1× Single", name: "Single", multiplier: 1 },
  { id: "double", label: "2× Double", name: "Double", multiplier: 2 },
  { id: "triple", label: "3× Treble", name: "Treble", multiplier: 3 },
];

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
  const armed = SEGMENTS.find((segment) => segment.id === armedSegment) ?? SEGMENTS[0]!;

  /** Arrow keys move the armed band, the way a radio group does. */
  function handleSegmentKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const next = SEGMENTS[(index + (forward ? 1 : -1) + SEGMENTS.length) % SEGMENTS.length]!;
    onArmedSegmentChange(next.id);
    document.getElementById(`dart-pad-segment-${next.id}`)?.focus();
  }

  return (
    <section
      aria-label="Dart pad"
      className="rounded-md border border-rule bg-surface p-lg space-y-lg"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Dart pad
        </h2>
        <p className="font-mono text-caption text-ink-muted">{throwsInCurrentTurn} / 3 darts</p>
      </div>

      {/* The armed band. The only segment control in the product. */}
      <div role="radiogroup" aria-labelledby="dart-pad-segment-label">
        <p
          id="dart-pad-segment-label"
          className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint"
        >
          Segment: {armed.name} ×{armed.multiplier}
        </p>
        <div className="mt-sm grid grid-cols-3 gap-md">
          {SEGMENTS.map((segment, index) => {
            const selected = segment.id === armedSegment;
            return (
              <button
                key={segment.id}
                id={`dart-pad-segment-${segment.id}`}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => onArmedSegmentChange(segment.id)}
                onKeyDown={(event) => handleSegmentKeyDown(event, index)}
                className={`${TARGET_SIZE} rounded-sm border font-label text-label transition-colors duration-fast ${
                  selected
                    ? "border-brass bg-brass text-board"
                    : "border-edge bg-raised text-ink hover:border-brass-deep hover:bg-board"
                } ${FOCUS_RING} ${DISABLED}`}
              >
                {segment.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* The twenty sectors. */}
      <div>
        <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Sectors
        </p>
        <div className="mt-sm grid grid-cols-4 gap-md">
          {SECTORS.map((sector) => {
            const points = sector * armed.multiplier;
            return (
              <button
                key={sector}
                type="button"
                disabled={disabled}
                aria-label={`${armed.name} ${sector}, ${points} points`}
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
        <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          Bull &amp; miss
        </p>
        <div className="mt-sm grid grid-cols-3 gap-md">
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

"use client";

import type { ArmedSegment } from "@/components/board";
import { DISABLED, FOCUS_RING, TARGET_SIZE } from "./classes";

/**
 * The segment control: which band a numeral scores.
 *
 * One control, two places. The pad shows it above the sectors, and the board
 * mode shows it above the board — a treble band on a phone board is about
 * eleven pixels tall, so the band is chosen first and the wide single band
 * is the tap target.
 *
 * The armed band is shared state: the match view owns it and both surfaces
 * read it, so the two are two views of one thing.
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

/** The band names, for the places that only need to name one. */
export const SEGMENT_NAME: Record<ArmedSegment, string> = {
  single: "Single",
  double: "Double",
  triple: "Treble",
};

/** What each band scores a sector at. */
export const SEGMENT_MULTIPLIER: Record<ArmedSegment, number> = {
  single: 1,
  double: 2,
  triple: 3,
};

export interface SegmentControlProps {
  readonly armedSegment: ArmedSegment;
  readonly onArmedSegmentChange: (segment: ArmedSegment) => void;
  readonly disabled?: boolean;
  /** The id prefix, so the pad and the board control do not share ids. */
  readonly idPrefix?: string;
  /** A compact rendering for the board mode, where space is tight. */
  readonly compact?: boolean;
}

export function SegmentControl({
  armedSegment,
  onArmedSegmentChange,
  disabled = false,
  idPrefix = "dart-pad-segment",
  compact = false,
}: SegmentControlProps) {
  const armed = SEGMENTS.find((segment) => segment.id === armedSegment) ?? SEGMENTS[0]!;

  /** Arrow keys move the armed band, the way a radio group does. */
  function handleSegmentKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const next = SEGMENTS[(index + (forward ? 1 : -1) + SEGMENTS.length) % SEGMENTS.length]!;
    onArmedSegmentChange(next.id);
    document.getElementById(`${idPrefix}-${next.id}`)?.focus();
  }

  const labelId = `${idPrefix}-label`;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      /* In the pad the label sits beside the buttons: stacked, the caption
         costs a row of the phone's fold and the pad is the input. */
      className={compact ? "" : "flex items-center gap-sm md:block"}
    >
      <p
        id={labelId}
        className={`font-caption text-caption uppercase tracking-[0.04em] text-ink-faint ${
          compact ? "" : "shrink-0"
        }`}
      >
        Segment: {armed.name} ×{armed.multiplier}
      </p>
      <div
        className={`grid grid-cols-3 ${compact ? "mt-sm max-w-xs gap-md" : "min-w-0 flex-1 gap-sm md:mt-sm md:gap-md"}`}
      >
        {SEGMENTS.map((segment, index) => {
          const selected = segment.id === armedSegment;
          return (
            <button
              key={segment.id}
              id={`${idPrefix}-${segment.id}`}
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
              {compact ? segment.name : segment.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

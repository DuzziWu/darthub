"use client";

import type { RecordedThrow } from "@/game-engine/types";
import { VisitChip, VISIT_BUST_CLASS, VISIT_COUNTED_CLASS, visitBadge } from "./VisitChips";
import { DISABLED, FOCUS_RING, SECONDARY_BUTTON } from "./classes";

/**
 * The throw-history strip of a match: the darts of the visit in progress as
 * tappable chips, the correction flow on top of them, and the undo button.
 *
 * Purely presentational: the view owns the engine and the correction state
 * (see `useMatchHistory`) and routes every event back. A dart is a button,
 * not a span: tapping it arms it as the correction target, and the house
 * 44 px floor keeps it a real touch target on a phone.
 */
export interface ThrowHistoryControlsProps {
  /** The darts of the visit in progress, oldest first. */
  readonly throws: readonly RecordedThrow[];
  /** The dart armed as the correction target, or null. */
  readonly correctionTarget: number | null;
  /** The armed target sits in a finished visit and needs confirmation. */
  readonly awaitingConfirmation: boolean;
  /** Whether there is a dart to undo. */
  readonly canUndo: boolean;
  /** Darts cannot be corrected while the match is over. */
  readonly correctionsDisabled?: boolean;
  readonly onSelectThrow: (dartIndex: number) => void;
  readonly onUndo: () => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** One dart chip: a 44 px button wearing the visit's chip vocabulary. */
function DartChipButton(props: {
  dart: RecordedThrow;
  index: number;
  armed: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { dart, index, armed, disabled, onSelect } = props;
  const label = dart.bust ? "BUST" : visitBadge(dart);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={armed}
      aria-label={`Dart ${index + 1}: ${label}`}
      data-visit={dart.bust ? "bust" : "counted"}
      className={`${dart.bust ? VISIT_BUST_CLASS : VISIT_COUNTED_CLASS} min-h-11 min-w-11 justify-center rounded-sm ${
        armed ? "border border-brass" : "border border-transparent"
      } ${DISABLED} ${FOCUS_RING}`}
    >
      <VisitChip entry={dart} />
    </button>
  );
}

export function ThrowHistoryControls(props: ThrowHistoryControlsProps) {
  const {
    throws,
    correctionTarget,
    awaitingConfirmation,
    canUndo,
    correctionsDisabled = false,
    onSelectThrow,
    onUndo,
    onConfirm,
    onCancel,
  } = props;
  const armedDart = correctionTarget === null ? null : (throws[correctionTarget] ?? null);

  return (
    <div className="flex flex-wrap items-center gap-xs">
      <ul className="flex flex-wrap items-center gap-xs" aria-label="Current visit">
        {throws.map((dart, index) => (
          <li key={index}>
            <DartChipButton
              dart={dart}
              index={index}
              armed={correctionTarget === index}
              disabled={correctionsDisabled}
              onSelect={() => onSelectThrow(index)}
            />
          </li>
        ))}
      </ul>

      {awaitingConfirmation && (
        <span className="flex items-center gap-xs font-caption text-ink" role="alert">
          Finished visit — correct?
          <button type="button" onClick={onConfirm} className={SECONDARY_BUTTON}>
            Confirm
          </button>
          <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
            Cancel
          </button>
        </span>
      )}

      {!awaitingConfirmation && armedDart !== null && (
        <span className="flex items-center gap-xs font-caption text-ink" role="status">
          Correcting {visitBadge(armedDart)} — enter the new value
          <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
            Cancel
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className={`${SECONDARY_BUTTON} ${DISABLED}`}
      >
        Undo
      </button>
    </div>
  );
}

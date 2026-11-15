"use client";

import type { RecordedThrow } from "@/game-engine/types";
import { VisitChip, VISIT_BUST_CLASS, VISIT_COUNTED_CLASS, visitBadge } from "./VisitChips";
import { DISABLED, FOCUS_RING, SECONDARY_BUTTON, VISIT_SLOT_EMPTY } from "./classes";

/**
 * The darts of the turn in progress, and the correction flow on top of them.
 *
 * Purely presentational: the view owns the engine and the correction state
 * (see `useMatchHistory`) and routes every event back. A dart is a button,
 * not a span: tapping it arms it as the correction target, and the house
 * 44 px floor keeps it a real touch target on a phone.
 *
 * The undo used to live here too, in the throw strip. It does not any more:
 * the mistake happens at the pad or at the board, so the undo belongs next
 * to them — see `VisitTracker`, which owns it now.
 *
 * The list keeps the name "Current visit": it is the list the match views
 * and the end-to-end suite address, and it holds the darts of the turn.
 */
export interface ThrowHistoryControlsProps {
  /** The darts of the turn in progress, oldest first. */
  readonly throws: readonly RecordedThrow[];
  /**
   * Where the turn in progress starts in the ledger.
   *
   * The tracker shows one turn, the engine indexes the whole ledger: a
   * chip's position in the tracker is not its index in the ledger, and the
   * two differ from the second turn on. The offset maps one onto the other.
   */
  readonly turnOffset?: number;
  /** The darts a turn holds. The tracker reserves a slot for each of them. */
  readonly dartsPerTurn?: number;
  /** The dart armed as the correction target, or null. */
  readonly correctionTarget: number | null;
  /** The armed target sits in a finished visit and needs confirmation. */
  readonly awaitingConfirmation: boolean;
  /** Darts cannot be corrected while the match is over. */
  readonly correctionsDisabled?: boolean;
  readonly onSelectThrow: (dartIndex: number) => void;
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
    turnOffset = 0,
    dartsPerTurn = 3,
    correctionTarget,
    awaitingConfirmation,
    correctionsDisabled = false,
    onSelectThrow,
    onConfirm,
    onCancel,
  } = props;
  const armedDart =
    correctionTarget === null ? null : (throws[correctionTarget - turnOffset] ?? null);
  /**
   * The slots of the turn that are still free.
   *
   * A slot that is not filled yet is shown, not hidden: the player sees how
   * many darts the turn still holds. The placeholders are not list items —
   * the list holds the darts that were thrown, and nothing else.
   */
  const freeSlots = Math.max(0, dartsPerTurn - throws.length);

  return (
    <div className="flex flex-wrap items-center gap-xs">
      <ul className="flex flex-wrap items-center gap-xs" aria-label="Current visit">
        {throws.map((dart, index) => (
          <li key={index}>
            <DartChipButton
              dart={dart}
              index={index}
              armed={correctionTarget === index + turnOffset}
              disabled={correctionsDisabled}
              onSelect={() => onSelectThrow(index + turnOffset)}
            />
          </li>
        ))}
      </ul>

      {Array.from({ length: freeSlots }, (_unused, index) => {
        const slot = throws.length + index + 1;
        return (
          <span
            key={slot}
            role="img"
            aria-label={`Dart ${slot}: not thrown`}
            className={VISIT_SLOT_EMPTY}
          />
        );
      })}

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
    </div>
  );
}

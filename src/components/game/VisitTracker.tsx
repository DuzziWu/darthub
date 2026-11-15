"use client";

import type { ReactNode } from "react";
import { DISABLED, SECONDARY_BUTTON, VISIT_TRACKER } from "./classes";

/**
 * The turn tracker: the darts of the turn in progress, and the undo.
 *
 * The tracker belongs to the **input area**, not to the header. The undo
 * used to sit in the sticky throw strip, roughly 900 px away from the pad
 * where the mistake happened — a phone is held in one hand, and the finger
 * that typed the wrong dart is the one that has to undo it. So the tracker
 * stands directly above the input surface, and the strip keeps only what
 * belongs to the match itself.
 *
 * There is exactly **one** undo in the screen, and it is named exactly
 * "Undo": the end-to-end suite and the unit tests address it by that name,
 * and two of them would break on a second, differently named one.
 */
export interface VisitTrackerProps {
  /** The darts of the turn in progress, as the throw list renders them. */
  readonly children: ReactNode;
  /** Whether there is a dart to undo. */
  readonly canUndo: boolean;
  /** Fired when the player takes back the last dart. */
  readonly onUndo: () => void;
}

export function VisitTracker({ children, canUndo, onUndo }: VisitTrackerProps) {
  return (
    <div className={VISIT_TRACKER}>
      {/* The label tells the player what the slots are; the list itself
          names every dart. */}
      <p className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">Turn</p>

      {children}

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        className={`${SECONDARY_BUTTON} ml-auto ${DISABLED}`}
      >
        Undo
      </button>
    </div>
  );
}

"use client";

import { Check, X } from "lucide-react";
import type { ThrowSegment } from "@/game-engine/types";

/**
 * The visit: the darts of the turn in progress, each named by the band it
 * landed on.
 *
 * The strip and the score sheet read the same chips, so the two surfaces
 * cannot drift apart — and neither of them depends on colour alone: a
 * counted dart carries a check, a bust carries a cross and the word BUST.
 */

/** A dart as shown in a chip: everything the chip renders is here. */
export interface ChipDart {
  readonly points: number;
  readonly segment?: ThrowSegment;
  readonly bust?: boolean;
}

/** The badge of one dart: `T20`, `D16`, `S7`, `BULL 50`, `MISS`. */
export function visitBadge(entry: ChipDart): string {
  if (entry.points === 0) return "MISS";
  switch (entry.segment) {
    case "double":
      return `D${entry.points / 2}`;
    case "triple":
      return `T${entry.points / 3}`;
    case "bull":
      return `BULL ${entry.points}`;
    default:
      return `S${entry.points}`;
  }
}

/**
 * The content of one chip: a counted dart carries a check and its badge, a
 * bust carries a cross and the word BUST. Colour is never the only signal.
 */
export function VisitChip({ entry }: { entry: ChipDart }) {
  return entry.bust ? (
    <>
      <X aria-hidden="true" className="h-3 w-3" />
      BUST
    </>
  ) : (
    <>
      <Check aria-hidden="true" className="h-3 w-3" />
      {visitBadge(entry)}
    </>
  );
}

/** A dart that counted: green, with a check. */
export const VISIT_COUNTED_CLASS = "flex items-center gap-xs font-mono text-caption text-treble";

/** A bust: a filled red chip with a cross and the word BUST. */
export const VISIT_BUST_CLASS =
  "flex items-center gap-xs rounded-sm bg-double px-sm py-xs font-label text-caption tracking-[0.04em] text-board";

export function VisitChips({ visit }: { visit: ReadonlyArray<ChipDart> }) {
  return (
    <ul className="flex items-center gap-xs" aria-label="Current visit">
      {visit.map((entry, index) => (
        <li
          key={index}
          data-visit={entry.bust ? "bust" : "counted"}
          className={entry.bust ? VISIT_BUST_CLASS : VISIT_COUNTED_CLASS}
        >
          <VisitChip entry={entry} />
        </li>
      ))}
    </ul>
  );
}

"use client";

import type { MatchVisit, RecordedThrow } from "@/game-engine/types";
import { VisitChip, VISIT_BUST_CLASS, VISIT_COUNTED_CLASS, visitBadge } from "./VisitChips";
import { DISABLED, FOCUS_RING, SECONDARY_BUTTON } from "./classes";

/**
 * The history of the match: every visit it has seen, not only the one in
 * progress.
 *
 * The turn tracker shows the darts of the turn in progress — that is where
 * the mistake happens and where the undo belongs. This list answers the
 * other question: *what has happened so far*. It is the basis for two
 * things the 501 needs: correcting a dart of an earlier visit (501-I14) and
 * reading the match back afterwards.
 *
 * The visits come from the engine (`engine.getVisits()`), so the list
 * cannot drift from the ledger: a correction rewrites the ledger and the
 * engine regroups it. The component derives nothing of its own.
 *
 * The list is **switchable**: a match of a whole evening would be unreadable
 * as one wall of chips, so the player sees the current visit by default and
 * can open the full history. On a phone that matters twice as much, which
 * is why the switch is a real button and not a hover menu.
 */
export interface MatchHistoryProps {
  /** Every visit of the match, oldest first. */
  readonly visits: readonly MatchVisit[];
  /** The name of each player, by player id. */
  readonly playerNames: Readonly<Record<string, string>>;
  /** The dart armed as the correction target, or null. */
  readonly correctionTarget: number | null;
  /** Darts cannot be corrected while the match is over. */
  readonly correctionsDisabled?: boolean;
  /** Whether the full history is open. */
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onSelectThrow: (dartIndex: number) => void;
}

/**
 * One dart of the history: a 44 px button wearing the visit's chip
 * vocabulary.
 *
 * The chip is the same component the turn tracker and the score sheet use,
 * so a bust looks the same everywhere and is never carried by colour alone.
 */
function HistoryDartButton(props: {
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
      // The name says **which** dart of the match it is: the ledger index is
      // the input of `correctThrow`, and the visit number tells the player
      // where in the match they are looking.
      //
      // The name differs from the turn tracker's on purpose: both surfaces
      // show darts, and two controls with the same name would be ambiguous
      // to a screen reader and to the tests that address them.
      aria-label={`History dart ${index + 1}: ${label}`}
      data-visit={dart.bust ? "bust" : "counted"}
      className={`${dart.bust ? VISIT_BUST_CLASS : VISIT_COUNTED_CLASS} min-h-11 min-w-11 justify-center rounded-sm ${
        armed ? "border border-brass" : "border border-transparent"
      } ${DISABLED} ${FOCUS_RING}`}
    >
      <VisitChip entry={dart} />
    </button>
  );
}

export function MatchHistory({
  visits,
  playerNames,
  correctionTarget,
  correctionsDisabled = false,
  expanded,
  onToggle,
  onSelectThrow,
}: MatchHistoryProps) {
  // The visits that are shown: the last one by default, all of them when the
  // history is open. The last visit is the one in progress.
  const shown = expanded ? visits : visits.slice(-1);
  const visitCount = visits.length;

  return (
    <section aria-label="Match history" className="rounded-md border border-rule bg-surface">
      <header className="flex items-center gap-md border-b border-rule px-md py-sm">
        <h2 className="flex-1 font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
          History
        </h2>
        <span className="font-caption text-caption text-ink-faint">
          {visitCount} {visitCount === 1 ? "visit" : "visits"}
        </span>
        {visitCount > 1 && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className={SECONDARY_BUTTON}
          >
            {expanded ? "Current visit" : "All visits"}
          </button>
        )}
      </header>

      <ul className="flex flex-col">
        {shown.map((visit) => (
          <li key={visit.index} className="border-b border-rule px-md py-sm last:border-b-0">
            <div className="flex items-center gap-md">
              <span className="min-w-0 flex-1 truncate font-caption text-caption text-ink-muted">
                {playerNames[visit.playerId] ?? visit.playerId}
                {visit.index === visitCount - 1 && (
                  <span className="text-brass"> · current visit</span>
                )}
              </span>
              <span className="shrink-0 font-caption text-caption text-ink-faint">
                {visit.throws.length} {visit.throws.length === 1 ? "dart" : "darts"}
              </span>
            </div>
            <ul className="mt-xs flex flex-wrap items-center gap-xs">
              {visit.throws.map((dart, position) => {
                // The ledger index of the dart: the visits carry their darts
                // in order, and the visits before this one hold the darts
                // before it. The engine's own grouping is the source, so the
                // index cannot drift from the ledger.
                const dartIndex = ledgerIndexOf(visits, visit.index, position);
                return (
                  <li key={position}>
                    <HistoryDartButton
                      dart={dart}
                      index={dartIndex}
                      armed={correctionTarget === dartIndex}
                      disabled={correctionsDisabled}
                      onSelect={() => onSelectThrow(dartIndex)}
                    />
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {/*
        The confirmation itself lives in the turn tracker, not here: it is
        one alert for the whole screen, and the tracker stands above the
        fold, right next to the input the player is correcting. This list
        selects the dart; the tracker confirms it.
      */}
    </section>
  );
}

/**
 * The index of a dart in the ledger.
 *
 * The visits are grouped in order and hold their darts in order, so the
 * ledger index of a dart is the number of darts in the visits before it plus
 * its own position in its visit.
 */
function ledgerIndexOf(
  visits: readonly MatchVisit[],
  visitIndex: number,
  position: number,
): number {
  let index = position;
  for (const visit of visits) {
    if (visit.index >= visitIndex) break;
    index += visit.throws.length;
  }
  return index;
}

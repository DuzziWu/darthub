"use client";

import { ChevronDown, ChevronUp, Cpu, User } from "lucide-react";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import type { PlayerSeat, SeatConfig, SeatKind } from "./types";
import { DISABLED, FOCUS_RING, RADIO_CELL, RADIO_INPUT, RADIO_MARK, TARGET_SIZE } from "./classes";

/**
 * The seat list of a mode that seats its players explicitly.
 *
 * A seat is a place at the table: it carries a name, it is either a person
 * or the AI, and — for the AI — the average that sets its strength. The
 * order of the seats is the order of the visits, so the list can be
 * rearranged before the first dart.
 *
 * The component is only rendered when the mode passes a `SeatConfig`. The
 * modes without AI seats keep their plain name fields.
 */

export interface PlayerSeatSetupProps {
  /** The seats, in the order they will play. */
  readonly seats: readonly PlayerSeat[];
  /** Fired with the new seat list whenever a seat changes. */
  readonly onChange: (seats: readonly PlayerSeat[]) => void;
  /** What the mode offers: the averages and the level an AI seat falls back to. */
  readonly config: SeatConfig;
  /** The fewest players the match accepts. */
  readonly minPlayers: number;
  /** The most players the match accepts. */
  readonly maxPlayers: number;
}

/** The label of the seat at a position: "Player 1", "Player 2" … */
function seatLabel(index: number): string {
  return `Player ${index + 1}`;
}

/**
 * The name the seat is addressed by in an assistive name.
 *
 * The seat's own player name comes first — "Alice nach oben" names the
 * player, which is what the player wants to hear. A seat without a name
 * yet is addressed by its position, and that position is worded
 * differently from the name field's label, so the two never read alike.
 */
function seatAddress(index: number, name: string): string {
  return name.trim() === "" ? `Sitzplatz ${index + 1}` : name.trim();
}

/**
 * The name an AI seat gets when it has none: "KI 1", "KI 2" …
 *
 * The number is the seat's own position, so the names stay unique and
 * readable. The player may rename an AI seat — the name is only a default.
 */
function aiSeatName(index: number): string {
  return `KI ${index + 1}`;
}

export function PlayerSeatSetup({
  seats,
  onChange,
  config,
  minPlayers,
  maxPlayers,
}: PlayerSeatSetupProps) {
  function update(index: number, change: Partial<PlayerSeat>): void {
    onChange(seats.map((seat, position) => (position === index ? { ...seat, ...change } : seat)));
  }

  function setKind(index: number, kind: SeatKind): void {
    const seat = seats[index];
    if (!seat) return;
    if (kind === "ai") {
      update(index, {
        kind,
        // An AI seat without an average falls back to the default level, so
        // it can never keep the match from starting.
        average: seat.average ?? config.defaultAverage,
        // A fresh AI seat is named; a renamed one keeps its name.
        name: seat.name.trim() === "" ? aiSeatName(index) : seat.name,
      });
      return;
    }
    // Back to a person: the AI name would be wrong, so it goes.
    update(index, {
      kind,
      name: /^KI \d+$/.test(seat.name) ? "" : seat.name,
    });
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= seats.length) return;
    const reordered = [...seats];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(target, 0, moved);
    onChange(reordered);
  }

  function addSeat(): void {
    if (seats.length >= maxPlayers) return;
    onChange([...seats, { id: `seat-${seats.length + 1}`, name: "", kind: "human" }]);
  }

  function removeSeat(index: number): void {
    // The fewest players the match accepts may not be undercut.
    if (seats.length <= minPlayers) return;
    onChange(seats.filter((_seat, position) => position !== index));
  }

  return (
    <div className="space-y-md">
      {seats.map((seat, index) => {
        const name = seat.name.trim();
        const isAi = seat.kind === "ai";
        const label = seatLabel(index);
        return (
          <div key={seat.id} className="rounded-sm border border-rule bg-sunken p-md">
            {/* The seat kind: a person or the AI. A radio group, so the
                keyboard reaches it and the choice is announced. */}
            <div
              role="radiogroup"
              aria-labelledby={`seat-kind-label-${seat.id}`}
              className="flex items-center justify-between gap-md"
            >
              <span id={`seat-kind-label-${seat.id}`}>
                <VisuallyHidden>{`Sitzplatz ${index + 1}: Typ`}</VisuallyHidden>
              </span>
              <label
                className={`flex cursor-pointer items-center gap-xs font-label text-label text-ink ${FOCUS_RING}`}
              >
                <span className={RADIO_CELL}>
                  <input
                    type="radio"
                    name={`seat-kind-${seat.id}`}
                    value="human"
                    checked={!isAi}
                    onChange={() => setKind(index, "human")}
                    className={`${RADIO_INPUT} ${DISABLED}`}
                  />
                  <span aria-hidden="true" className={RADIO_MARK} />
                </span>
                <User aria-hidden="true" className="h-4 w-4 text-ink-muted" />
                <span>Mensch</span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-xs font-label text-label text-ink ${FOCUS_RING}`}
              >
                <span className={RADIO_CELL}>
                  <input
                    type="radio"
                    name={`seat-kind-${seat.id}`}
                    value="ai"
                    checked={isAi}
                    onChange={() => setKind(index, "ai")}
                    className={`${RADIO_INPUT} ${DISABLED}`}
                  />
                  <span aria-hidden="true" className={RADIO_MARK} />
                </span>
                <Cpu aria-hidden="true" className="h-4 w-4 text-ink-muted" />
                <span>KI</span>
              </label>
            </div>

            <label
              htmlFor={`player-name-${seat.id}`}
              className="mt-md mb-xs block font-label text-label text-ink-muted"
            >
              {label}
            </label>
            <input
              id={`player-name-${seat.id}`}
              type="text"
              maxLength={24}
              value={seat.name}
              aria-describedby={`player-name-${seat.id}-hint`}
              onChange={(event) => update(index, { name: event.target.value })}
              placeholder={isAi ? aiSeatName(index) : "Name"}
              className={`${TARGET_SIZE} w-full rounded-sm border border-edge bg-surface px-md font-body text-body text-ink placeholder:text-ink-faint transition-colors duration-fast hover:border-brass-deep focus-visible:border-brass ${FOCUS_RING} ${DISABLED}`}
            />

            {/* The average belongs to the AI seat alone: a person's strength
                is not a setting. */}
            {isAi && (
              <div className="mt-md">
                <label
                  htmlFor={`player-average-${seat.id}`}
                  className="mb-xs block font-label text-label text-ink-muted"
                >
                  Average
                </label>
                <select
                  id={`player-average-${seat.id}`}
                  value={seat.average ?? config.defaultAverage}
                  onChange={(event) => update(index, { average: Number(event.target.value) })}
                  className={`${TARGET_SIZE} w-full rounded-sm border border-edge bg-surface px-md font-body text-body text-ink transition-colors duration-fast hover:border-brass-deep focus-visible:border-brass ${FOCUS_RING} ${DISABLED}`}
                >
                  {config.averages.map((average) => (
                    <option key={average} value={average}>
                      {average}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <p
              id={`player-name-${seat.id}-hint`}
              className="mt-xs font-body text-caption text-ink-faint"
            >
              {isAi
                ? "Shown on the score sheet. The AI throws on its own."
                : "Shown on the score sheet."}
            </p>

            {/* The order of the seats is the order of the visits, so it is
                changed here — before the first dart, never during a match. */}
            <div className="mt-md flex items-center gap-sm">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`${seatAddress(index, name)} nach oben`}
                className={`${TARGET_SIZE} inline-flex items-center justify-center rounded-sm border border-edge bg-raised px-md font-label text-label text-ink transition-colors duration-fast hover:border-brass-deep ${FOCUS_RING} ${DISABLED}`}
              >
                <ChevronUp aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === seats.length - 1}
                aria-label={`${seatAddress(index, name)} nach unten`}
                className={`${TARGET_SIZE} inline-flex items-center justify-center rounded-sm border border-edge bg-raised px-md font-label text-label text-ink transition-colors duration-fast hover:border-brass-deep ${FOCUS_RING} ${DISABLED}`}
              >
                <ChevronDown aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeSeat(index)}
                disabled={seats.length <= minPlayers}
                aria-label={`${seatAddress(index, name)} entfernen`}
                className={`${TARGET_SIZE} ml-auto inline-flex items-center justify-center rounded-sm border border-edge bg-raised px-md font-label text-label text-ink transition-colors duration-fast hover:border-brass-deep ${FOCUS_RING} ${DISABLED}`}
              >
                Entfernen
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addSeat}
        disabled={seats.length >= maxPlayers}
        className={`${TARGET_SIZE} w-full rounded-sm border border-edge bg-raised font-label text-label text-ink transition-colors duration-fast hover:border-brass-deep ${FOCUS_RING} ${DISABLED}`}
      >
        Spieler hinzufügen
      </button>
    </div>
  );
}

"use client";

import { BOARD_SOURCES, type BoardSourceId } from "@/board";
import { RADIO_CELL, RADIO_INPUT, RADIO_MARK } from "./classes";

/** The board source a match is played on. */
export interface BoardSourceSelectorProps {
  /** The chosen source. */
  readonly value: BoardSourceId;
  /** Called with the newly chosen source. An unavailable source never gets here. */
  readonly onChange: (id: BoardSourceId) => void;
}

/**
 * The board source radio group.
 *
 * The two planned sources carry `aria-disabled` and stay focusable — the
 * `disabled` attribute would take them out of the tab order and hide the
 * reason they are unavailable. `aria-disabled` alone is not a lock: a
 * radio with it can still be changed by click and by keyboard, so the
 * change handler ignores an unavailable source and keeps the current one.
 */
export function BoardSourceSelector({ value, onChange }: BoardSourceSelectorProps) {
  return (
    <fieldset className="space-y-md">
      <legend className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
        Board source
      </legend>
      {BOARD_SOURCES.map((source) => {
        const inputId = `board-source-${source.id}`;
        const reasonId = `${inputId}-reason`;
        const unavailable = !source.available;

        return (
          <div key={source.id} className="flex items-center gap-md">
            <span className={RADIO_CELL}>
              <input
                id={inputId}
                type="radio"
                name="board-source"
                value={source.id}
                checked={value === source.id}
                aria-disabled={unavailable ? "true" : undefined}
                aria-describedby={source.note ? reasonId : undefined}
                onChange={() => {
                  if (!unavailable) {
                    onChange(source.id);
                  }
                }}
                className={RADIO_INPUT}
              />
              <span aria-hidden="true" className={RADIO_MARK} />
            </span>
            <span className="space-y-xs">
              <span className="flex items-center gap-sm">
                <label htmlFor={inputId} className="font-label text-label text-ink">
                  {source.label}
                </label>
                {unavailable && (
                  <span className="rounded-xs border border-edge px-xs font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
                    PLANNED
                  </span>
                )}
              </span>
              {source.note && (
                <span id={reasonId} className="block font-body text-body text-ink-muted">
                  {source.note}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </fieldset>
  );
}

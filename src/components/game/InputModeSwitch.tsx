"use client";

import { DISABLED, FOCUS_RING, TARGET_SIZE } from "./classes";

/**
 * The switch between the two ways of entering a dart.
 *
 * A segmented control, not a tablist: the two options are two paths to the
 * same action, not two panels of content, so the group is a radio group.
 * The pattern is the one the dart pad already uses for its band, so the
 * keyboard behaves the same everywhere on the play surface.
 */
export type InputMode = "board" | "manual";

/** The two options, in the order they read. */
const MODES: ReadonlyArray<{ id: InputMode; label: string; hint: string }> = [
  { id: "board", label: "Board", hint: "Board — tap the board to score" },
  { id: "manual", label: "Manual", hint: "Manual — score with the pad" },
];

export interface InputModeSwitchProps {
  readonly mode: InputMode;
  readonly onChange: (mode: InputMode) => void;
}

export function InputModeSwitch({ mode, onChange }: InputModeSwitchProps) {
  /** Arrow keys move the selection, the way a radio group does. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const next = MODES[(index + (forward ? 1 : -1) + MODES.length) % MODES.length]!;
    onChange(next.id);
    document.getElementById(`input-mode-${next.id}`)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Input mode"
      className="inline-flex shrink-0 items-center gap-xs rounded-sm border border-edge bg-sunken p-xs"
    >
      {MODES.map((option, index) => {
        const selected = mode === option.id;
        return (
          <button
            key={option.id}
            id={`input-mode-${option.id}`}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.hint}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`${TARGET_SIZE} rounded-xs px-md font-label text-label transition-colors duration-fast ${
              selected ? "bg-brass font-semibold text-board" : "text-ink-muted hover:text-ink"
            } ${FOCUS_RING} ${DISABLED}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Target, TriangleAlert } from "lucide-react";
import type { BoardSourceId } from "@/board";
import type { OutRuleId } from "@/game-engine/types";
import { BoardSourceSelector } from "./BoardSourceSelector";
import type { PlayerSetupProps } from "./types";
import { DISABLED, FOCUS_RING, RADIO_CELL, RADIO_INPUT, RADIO_MARK, TARGET_SIZE } from "./classes";

/**
 * The setup form: the mode, the players, the checkout rule and the board
 * source. Every field has a visible label — a placeholder is a hint, never
 * the label — and the error is announced, not just coloured.
 */

/** The three checkout rules the engine supports. */
const OUT_RULES: ReadonlyArray<{ id: OutRuleId; label: string; note: string }> = [
  { id: "double", label: "Double out", note: "finish on a double" },
  { id: "master", label: "Master out", note: "finish on a double or the inner bull (50)" },
  { id: "straight", label: "Straight out", note: "any finish counts" },
];

export function PlayerSetup({
  modeName,
  modeDescription,
  modeIcon: ModeIcon = Target,
  minPlayers = 1,
  maxPlayers = 2,
  outRule,
  onOutRuleChange,
  showCheckoutRule = true,
  boardSource,
  onBoardSourceChange,
  onStart,
}: PlayerSetupProps) {
  const [names, setNames] = useState<string[]>(Array(maxPlayers).fill(""));
  const [error, setError] = useState("");
  const [localRule, setLocalRule] = useState<OutRuleId>("double");
  const [localSource, setLocalSource] = useState<BoardSourceId>("virtual");

  const rule = outRule ?? localRule;
  const source = boardSource ?? localSource;

  function selectRule(next: OutRuleId) {
    setLocalRule(next);
    onOutRuleChange?.(next);
  }

  function selectSource(next: BoardSourceId) {
    setLocalSource(next);
    onBoardSourceChange?.(next);
  }

  function handleStart() {
    const filled = names.map((name) => name.trim()).filter(Boolean);
    if (filled.length < minPlayers) {
      setError(`At least ${minPlayers} player${minPlayers > 1 ? "s" : ""} required`);
      return;
    }
    setError("");
    onStart(filled, { outRule: rule, boardSource: source });
  }

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (index < maxPlayers - 1) {
      document.getElementById(`player-name-${index + 1}`)?.focus();
    } else {
      handleStart();
    }
  }

  return (
    <section
      aria-label={`${modeName} setup`}
      className="mx-auto max-w-[420px] rounded-md border border-rule bg-surface p-2xl space-y-xl"
    >
      {/* The mode. The icon is decorative: it sits beside a visible heading. */}
      <header className="flex items-start gap-md">
        <ModeIcon aria-hidden="true" className="h-6 w-6 shrink-0 text-brass" />
        <div>
          <h2 className="font-display text-title text-ink">{modeName}</h2>
          <p className="font-body text-body text-ink-muted">{modeDescription}</p>
        </div>
      </header>

      {/* The players. */}
      <div className="space-y-md">
        {names.map((name, index) => (
          <div key={index}>
            <label
              htmlFor={`player-name-${index}`}
              className="mb-xs block font-label text-label text-ink-muted"
            >
              Player {index + 1}
            </label>
            <input
              id={`player-name-${index}`}
              type="text"
              maxLength={24}
              value={name}
              aria-describedby={`player-name-${index}-hint`}
              onChange={(event) => {
                const updated = [...names];
                updated[index] = event.target.value;
                setNames(updated);
                setError("");
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
              placeholder="Name"
              className={`${TARGET_SIZE} w-full rounded-sm border border-edge bg-sunken px-md font-body text-body text-ink placeholder:text-ink-faint transition-colors duration-fast hover:border-brass-deep focus-visible:border-brass ${FOCUS_RING} ${DISABLED}`}
            />
            <p
              id={`player-name-${index}-hint`}
              className="mt-xs font-body text-caption text-ink-faint"
            >
              Shown on the score sheet.
            </p>
          </div>
        ))}
      </div>

      {/* The checkout rule. The modes without a checkout are not offered one. */}
      {showCheckoutRule && (
        <div role="radiogroup" aria-labelledby="checkout-rule-label">
          <p
            id="checkout-rule-label"
            className="mb-sm font-caption text-caption uppercase tracking-[0.04em] text-ink-faint"
          >
            Checkout
          </p>
          <div className="space-y-sm">
            {OUT_RULES.map((option) => (
              <label key={option.id} className="flex items-center gap-md">
                <span className={RADIO_CELL}>
                  <input
                    type="radio"
                    name="checkout-rule"
                    value={option.id}
                    checked={rule === option.id}
                    onChange={() => selectRule(option.id)}
                    className={`${RADIO_INPUT} ${DISABLED}`}
                  />
                  <span aria-hidden="true" className={RADIO_MARK} />
                </span>
                <span className="space-y-xs">
                  <span className="block font-label text-label text-ink">{option.label}</span>
                  <span className="block font-body text-caption text-ink-muted">{option.note}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* The board source. */}
      <BoardSourceSelector value={source} onChange={selectSource} />

      {/* The error is announced, and it carries an icon. */}
      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="flex items-center gap-sm font-body text-label text-double"
        >
          <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleStart}
        className={`${TARGET_SIZE} w-full rounded-sm bg-brass font-label text-label text-board transition-colors duration-fast hover:bg-brass-deep ${FOCUS_RING} ${DISABLED}`}
      >
        Start match
      </button>
    </section>
  );
}

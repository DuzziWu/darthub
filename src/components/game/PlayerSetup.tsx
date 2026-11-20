"use client";

import { useState } from "react";
import { Target, TriangleAlert } from "lucide-react";
import type { BoardSourceId } from "@/board";
import { OUT_RULE_CHOICES } from "@/game-engine/modes/registry";
import type { OutRuleId } from "@/game-engine/types";
import { BoardSourceSelector } from "./BoardSourceSelector";
import { PlayerSeatSetup } from "./PlayerSeatSetup";
import type { MatchFormatChoice, PlayerSeat, PlayerSetupProps } from "./types";
import { DISABLED, FOCUS_RING, RADIO_CELL, RADIO_INPUT, RADIO_MARK, TARGET_SIZE } from "./classes";

/**
 * The setup form: the mode, the players, the checkout rule and the board
 * source. Every field has a visible label — a placeholder is a hint, never
 * the label — and the error is announced, not just coloured.
 *
 * The players come in two shapes. A mode without a seat management asks for
 * plain names; a mode with one (the 501) manages *seats*: a name, a person
 * or the AI, and — for the AI — the average that sets its strength.
 */

export function PlayerSetup({
  modeName,
  modeDescription,
  modeIcon: ModeIcon = Target,
  minPlayers = 1,
  maxPlayers = 2,
  outRule,
  onOutRuleChange,
  showCheckoutRule = true,
  outRuleChoices = OUT_RULE_CHOICES,
  seatConfig,
  boardSource,
  onBoardSourceChange,
  matchFormat,
  onStart,
}: PlayerSetupProps) {
  const [names, setNames] = useState<string[]>(Array(maxPlayers).fill(""));
  // The seats exist only in the modes that manage them; the other modes
  // keep their plain name fields.
  const [seats, setSeats] = useState<readonly PlayerSeat[]>(() => createSeats(minPlayers));
  const [error, setError] = useState("");
  const [localRule, setLocalRule] = useState<OutRuleId>("double");
  const [localSource, setLocalSource] = useState<BoardSourceId>("virtual");
  // The format is a choice, so it starts on the first one: the form never
  // starts with nothing selected.
  const [format, setFormat] = useState<MatchFormatChoice | null>(matchFormat?.[0] ?? null);

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
    if (seatConfig) {
      // A seat takes part when it carries a name. An AI seat is named from
      // the start, so it always takes part.
      const playing = seats.filter((seat) => seat.name.trim() !== "");
      if (playing.length < minPlayers) {
        setError(`At least ${minPlayers} player${minPlayers > 1 ? "s" : ""} required`);
        return;
      }
      // A match needs someone at the table: the AI alone cannot play it.
      if (!playing.some((seat) => seat.kind === "human")) {
        setError("At least one human player is required");
        return;
      }
      setError("");
      onStart(
        playing.map((seat) => seat.name.trim()),
        {
          outRule: rule,
          boardSource: source,
          ...(format?.legs === undefined ? {} : { legs: format.legs }),
          ...(format?.sets === undefined ? {} : { sets: format.sets }),
          seats: playing,
        },
      );
      return;
    }

    const filled = names.map((name) => name.trim()).filter(Boolean);
    if (filled.length < minPlayers) {
      setError(`At least ${minPlayers} player${minPlayers > 1 ? "s" : ""} required`);
      return;
    }
    setError("");
    onStart(filled, {
      outRule: rule,
      boardSource: source,
      // The sizes are reported only when the format has them: a single-leg
      // match reports neither legs nor sets.
      ...(format?.legs === undefined ? {} : { legs: format.legs }),
      ...(format?.sets === undefined ? {} : { sets: format.sets }),
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
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
      {seatConfig ? (
        <PlayerSeatSetup
          seats={seats}
          onChange={setSeats}
          config={seatConfig}
          minPlayers={minPlayers}
          maxPlayers={maxPlayers}
        />
      ) : (
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
      )}

      {/* The match format. Only the modes with a leg/set structure offer a
          choice; the others have no such choice to make. */}
      {matchFormat && matchFormat.length > 1 && (
        <div role="radiogroup" aria-labelledby="match-format-label">
          <p
            id="match-format-label"
            className="mb-sm font-caption text-caption uppercase tracking-[0.04em] text-ink-faint"
          >
            Match format
          </p>
          <div className="space-y-sm">
            {matchFormat.map((choice) => (
              <label key={choice.id} className="flex items-center gap-md">
                <span className={RADIO_CELL}>
                  <input
                    type="radio"
                    name="match-format"
                    value={choice.id}
                    checked={format?.id === choice.id}
                    onChange={() => setFormat(choice)}
                    className={`${RADIO_INPUT} ${DISABLED}`}
                  />
                  <span aria-hidden="true" className={RADIO_MARK} />
                </span>
                <span className="block font-label text-label text-ink">{choice.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
            {outRuleChoices.map((option) => (
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
                  <span className="block font-body text-caption text-ink-muted">
                    {option.description}
                  </span>
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

/**
 * The seats a fresh match starts with: the fewest the mode accepts.
 *
 * The list grows from there — the player adds seats up to the mode's
 * maximum — so the form never starts with more seats than the match needs.
 */
function createSeats(count: number): PlayerSeat[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `seat-${index + 1}`,
    name: "",
    kind: "human" as const,
  }));
}

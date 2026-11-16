import { describe, expect, it } from "vitest";
import {
  GameEngineBustError,
  GameEngineStateError,
  GameEngineValidationError,
  type GameEngineErrorCode,
} from "@/game-engine";
import {
  FALLBACK_ERROR_TEXT,
  PLAYER_ERROR_TEXTS,
  playerErrorText,
} from "@/components/game/playerErrors";

/**
 * Every code of the engine's union, written out by hand.
 *
 * The list is the contract of this test: if the engine gains a code, the
 * table must gain a text with it, and this list is what says so.
 */
const ALL_CODES: readonly GameEngineErrorCode[] = [
  "INVALID_STATE",
  "MATCH_COMPLETED",
  "NOT_YOUR_TURN",
  "NO_MATCH",
  "NOTHING_TO_UNDO",
  "NO_DART_AT_INDEX",
  "BUST",
  "CORRECTION_WOULD_BUST",
  "LATER_DART_WOULD_BUST",
  "TURN_ROTATION_CHANGED",
];

/** The text of the refusal this whole feature was written for. */
const TURN_ROTATION_TEXT =
  "Diese Änderung würde die Reihenfolge der Würfe ändern. Bitte einen anderen Wert eingeben.";

/**
 * The engine's vocabulary, which must never reach the player.
 *
 * The texts speak about the game ("Wurf", "Spiel", "Zug"), never about the
 * engine's internals ("Ledger", "Rotation", "Index", "Replay").
 */
const FORBIDDEN_WORDS = ["dart", "ledger", "rotation", "replay", "turn", "index", "player"];

describe("PLAYER_ERROR_TEXTS", () => {
  it("has exactly one text per code of the union", () => {
    expect(Object.keys(PLAYER_ERROR_TEXTS).sort()).toEqual([...ALL_CODES].sort());
  });

  it("gives every code a non-empty text", () => {
    for (const code of ALL_CODES) {
      expect(PLAYER_ERROR_TEXTS[code]).toBeTypeOf("string");
      expect(PLAYER_ERROR_TEXTS[code].trim().length).toBeGreaterThan(0);
    }
  });

  it("says the same thing for no two codes", () => {
    const texts = ALL_CODES.map((code) => PLAYER_ERROR_TEXTS[code]);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("names the turn rotation in the player's language", () => {
    expect(PLAYER_ERROR_TEXTS.TURN_ROTATION_CHANGED).toBe(TURN_ROTATION_TEXT);
  });
});

describe("playerErrorText", () => {
  it("maps the code of a state error to its text", () => {
    expect(playerErrorText(new GameEngineStateError("irrelevant", "TURN_ROTATION_CHANGED"))).toBe(
      TURN_ROTATION_TEXT,
    );
  });

  it("maps a bust, which is a state error of its own", () => {
    expect(playerErrorText(new GameEngineBustError("Bust: 1 remaining"))).toBe(
      PLAYER_ERROR_TEXTS.BUST,
    );
  });

  it("maps the default code of a state error", () => {
    expect(playerErrorText(new GameEngineStateError("something went wrong"))).toBe(
      PLAYER_ERROR_TEXTS.INVALID_STATE,
    );
  });

  it("does not depend on the message", () => {
    const first = new GameEngineStateError(
      "The correction would change the turn order: dart 3 would no longer belong to the same turn",
      "TURN_ROTATION_CHANGED",
    );
    const second = new GameEngineStateError("something else entirely", "TURN_ROTATION_CHANGED");

    expect(playerErrorText(first)).toBe(playerErrorText(second));
    expect(playerErrorText(first)).toBe(TURN_ROTATION_TEXT);
  });

  it("maps by its own code even when the message carries another code's text", () => {
    const error = new GameEngineStateError(TURN_ROTATION_TEXT, "NO_MATCH");

    expect(playerErrorText(error)).toBe(PLAYER_ERROR_TEXTS.NO_MATCH);
    expect(playerErrorText(error)).not.toBe(TURN_ROTATION_TEXT);
  });

  it("falls back for every error without a code", () => {
    expect(playerErrorText(new GameEngineValidationError("points must be positive"))).toBe(
      FALLBACK_ERROR_TEXT,
    );
    expect(playerErrorText(new Error("boom"))).toBe(FALLBACK_ERROR_TEXT);
    expect(playerErrorText("boom")).toBe(FALLBACK_ERROR_TEXT);
    expect(playerErrorText(undefined)).toBe(FALLBACK_ERROR_TEXT);
    expect(playerErrorText(null)).toBe(FALLBACK_ERROR_TEXT);
    expect(playerErrorText({ code: "NOT_YOUR_TURN" })).toBe(FALLBACK_ERROR_TEXT);
  });
});

describe("the player texts themselves", () => {
  const texts = [...ALL_CODES.map((code) => PLAYER_ERROR_TEXTS[code]), FALLBACK_ERROR_TEXT];

  it("carry no digit and no dart-index specification", () => {
    for (const text of texts) {
      expect(text).not.toMatch(/\d/);
    }
  });

  it("carry no English engine vocabulary", () => {
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        expect(lower).not.toContain(word);
      }
    }
  });

  it("are never empty", () => {
    for (const text of texts) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});

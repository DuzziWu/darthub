/**
 * The player text of the engine's refusals.
 *
 * The engine's error **message** is English developer text: it names the
 * ledger, the turn rotation and the dart index, and it changes whenever the
 * engine is refactored. It is not a contract, so no view may branch on it
 * and no player may read it.
 *
 * The **code** is the contract. The engine attaches a stable
 * {@link GameEngineErrorCode} to every refusal it throws on purpose, and
 * this module is the single place where a code becomes a sentence the
 * player can read.
 *
 * One module for the **four** match views — the x01 view and the three mode
 * pages — so the same refusal cannot read differently in 501 and in
 * cricket. The **five** screens (501, 301, cricket, around the clock and
 * shanghai) are built from those four: 501 and 301 share the x01 view.
 *
 * The texts are short on purpose: the status line is a caption, read
 * mid-turn, and a sentence that has to be scrolled is a sentence nobody
 * reads.
 *
 * **A refusal text must never promise a remedy that does not exist, and
 * must never send the player into a loop of refusals.**
 *
 * The turn-rotation refusal is the proof. In the very scenario the
 * correction flow exists for — a bust in the middle of a turn, corrected
 * afterwards — *no* value the player can enter is accepted: every value of
 * that journey was refused without exception (the figures are in
 * `design-system/darthub/pages/match.md` §6, rule 5). Its text therefore
 * asks for no other value; it names the one way out that always exists —
 * take the dart back and throw again.
 *
 * The other two refusals ask for another value, which is the thing the
 * player can change: a dart corrected to a busting value is refused, and a
 * smaller value is accepted there. Where even that is refused, the next
 * refusal says so — the turn-rotation text names the way out.
 */
import { GameEngineStateError, type GameEngineErrorCode } from "@/game-engine";

/**
 * The player text of every refusal code.
 *
 * The texts speak the player's language, not the engine's: no ledger, no
 * rotation, no replay, no dart index, no English leftovers. A refusal tells
 * the player what to do next — a next step that really exists, and never a
 * round-trip into the same refusal. It never names the internal rule that
 * stopped them.
 */
export const PLAYER_ERROR_TEXTS: Readonly<Record<GameEngineErrorCode, string>> = {
  INVALID_STATE: "Das hat nicht geklappt. Bitte versuche es noch einmal.",
  MATCH_COMPLETED: "Das Spiel ist bereits beendet.",
  NOT_YOUR_TURN: "Du bist gerade nicht am Zug.",
  NO_MATCH: "Es läuft noch kein Spiel.",
  NOTHING_TO_UNDO: "Da ist nichts zurückzunehmen.",
  NO_DART_AT_INDEX: "Diesen Wurf gibt es nicht.",
  BUST: "Bust — der Wurf zählt nicht.",
  CORRECTION_WOULD_BUST:
    "Mit diesem Wert wäre der Wurf ungültig. Bitte einen anderen Wert eingeben.",
  LATER_DART_WOULD_BUST:
    "Diese Änderung würde einen späteren Wurf ungültig machen. Bitte einen anderen Wert eingeben.",
  TURN_ROTATION_CHANGED:
    "Diesen Wurf kannst du nicht mehr ändern. Bitte zurücknehmen und neu werfen.",
};

/**
 * The text of an error that carries no code.
 *
 * A validation error, a plain `Error` and a value that is not an error at
 * all all end here. The player gets a sentence — never a stack trace, never
 * an English developer string.
 */
export const FALLBACK_ERROR_TEXT: string = "Das hat nicht geklappt. Bitte versuche es noch einmal.";

/**
 * The player text of an error the engine threw.
 *
 * The code is read **only** from a {@link GameEngineStateError} — the one
 * error class that carries a contract. The message is never read: it is
 * developer text, and matching on it would break the moment the engine
 * rewords it.
 */
export function playerErrorText(error: unknown): string {
  if (!(error instanceof GameEngineStateError)) return FALLBACK_ERROR_TEXT;
  const text: string | undefined = PLAYER_ERROR_TEXTS[error.code];
  return text ?? FALLBACK_ERROR_TEXT;
}

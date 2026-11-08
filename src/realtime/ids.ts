/**
 * Identifier helpers for the realtime layer.
 *
 * Room codes are human-friendly; invite codes and player tokens are
 * secret, high-entropy strings. Values are generated with the crypto
 * module and never loggable.
 */
import { randomBytes, randomInt } from "node:crypto";

/** Alphabet without visually ambiguous characters (0/O/1/I/S, 5/8). */
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWY234679";
const ROOM_CODE_LENGTH = 6;
const SECRET_TOKEN_BYTES = 32;

/** Generates a public, unambiguous room code, e.g. "RTVWY2". */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Generates a URL-safe secret token (invite codes, player tokens). */
export function generateSecretToken(): string {
  return randomBytes(SECRET_TOKEN_BYTES).toString("base64url");
}

/** Generates a display-stable player id such as "player-1". */
export function generatePlayerId(roomCode: string, seatIndex: number): string {
  return `${roomCode}-p${seatIndex + 1}`;
}

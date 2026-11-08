/**
 * Shared types and constants for the DartHub realtime (Socket.IO) layer.
 */
import type { MatchState } from "@/game-engine";

/** Socket.IO event names used between the realtime server and its clients. */
export const REALTIME_EVENTS = {
  /** Emitted by the server once a socket connection is established. */
  welcome: "realtime:welcome",
  /** Client → server: creates a private room (host of the room). */
  roomCreate: "room:create",
  /** Client → server: joins an existing room with an invite code. */
  roomJoin: "room:join",
  /** Client → server: asks for the current match state snapshot. */
  stateRequest: "state:request",
  /** Client → server: starts the match for the room (host only). */
  matchStart: "match:start",
  /** Client → server: submits one dart throw for server-side validation. */
  throwRecord: "throw:record",
  /** Server → room: broadcasts the current authoritative match state. */
  stateUpdate: "state:update",
} as const;

/** Acknowledgement envelope returned by every client → server event. */
export type Ack<TPayload = undefined> =
  { ok: true; data: TPayload } | { ok: false; error: string; code: ErrorCode };

/** Stable, non-leaking error codes sent to clients. */
export type ErrorCode =
  | "invalidPayload"
  | "roomNotFound"
  | "invalidInvite"
  | "alreadyInRoom"
  | "notAuthorized"
  | "matchAlreadyStarted"
  | "matchNotStarted"
  | "notYourTurn"
  | "invalidThrow"
  | "roomFull";

/** Options accepted by the realtime server factory. */
export interface RealtimeServerOptions {
  /**
   * Injectable seam for the AI engine (task 007). The server never
   * imports `@/ai` directly; callers provide the implementation.
   */
  readonly aiProvider?: AIProvider;
}

/**
 * Seam for automated players. Throwing is still executed and validated
 * by the server exactly like any human throw (server authority).
 */
export interface AIProvider {
  /** Returns the points to throw for the given state, or null to pass. */
  selectThrowPoints(state: MatchState): number | null;
}

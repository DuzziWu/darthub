/**
 * A private game room: roster of players, invite gate and the
 * authoritative match state managed by a {@link GameStateMachine}.
 *
 * The room is the only component that knows its invite code and player
 * tokens; views handed to clients never contain secret material.
 */
import { GameStateMachine } from "@/realtime/GameStateMachine";
import { generatePlayerId, generateRoomCode, generateSecretToken } from "@/realtime/ids";
import type { MatchState } from "@/game-engine";

/** A player seat inside a room. */
export interface RoomPlayer {
  readonly playerId: string;
  readonly playerName: string;
  /** Secret credential the client uses for reconnection. */
  readonly playerToken: string;
  /** True for automated seats (throws come from the injected AI). */
  readonly isAI: boolean;
}

/** Public roster entry (secret-free). */
export interface RosterPlayer {
  readonly playerId: string;
  readonly playerName: string;
  readonly isAI: boolean;
}

/** Membership view handed only to the socket that joined. */
export interface RoomMembership {
  readonly roomCode: string;
  readonly inviteCode: string;
  readonly playerId: string;
  readonly playerToken: string;
  readonly isHost: boolean;
  readonly status: MatchState["status"] | "waiting";
  readonly roster: readonly RosterPlayer[];
  readonly matchState: MatchState | null;
}

/** Stable rejection reasons a room can produce. */
export const RoomRejectionCode = {
  invalidInvite: "invalidInvite",
  roomFull: "roomFull",
  matchAlreadyStarted: "matchAlreadyStarted",
  hostOnly: "hostOnly",
} as const;
/** Type view of {@link RoomRejectionCode}. */
export type RoomRejectionCodeValue = keyof typeof RoomRejectionCode;

/** Thrown when the room rejects a membership or game request. */
export class RoomChangeError extends Error {
  constructor(public readonly code: RoomRejectionCodeValue) {
    super(`Room rejected the request (${code})`);
    this.name = "RoomChangeError";
  }
}

/** Maximum players that fit into one private room. */
export const ROOM_MAX_PLAYERS = 4;

/** One private room with its authoritative game state. */
export class GameRoom {
  /** Creates a fresh room with the given host as its first player. */
  static create(hostPlayerName: string, withAiOpponent = false): GameRoom {
    const roomCode = generateRoomCode();
    const hostSeat: RoomPlayer = {
      playerId: generatePlayerId(roomCode, 0),
      playerName: hostPlayerName,
      playerToken: generateSecretToken(),
      isAI: false,
    };
    const room = new GameRoom(roomCode, generateSecretToken(), hostSeat);
    if (withAiOpponent) {
      room.players.push(this.createAiSeat(roomCode, 1));
    }
    return room;
  }

  /** Builds the automated seat placed right after the host. */
  private static createAiSeat(roomCode: string, seatIndex: number): RoomPlayer {
    return {
      playerId: `ai-${generatePlayerId(roomCode, seatIndex)}`,
      playerName: "ai-opponent",
      playerToken: generateSecretToken(),
      isAI: true,
    };
  }

  private readonly machine = new GameStateMachine();
  private readonly hostSeat: RoomPlayer;
  private players: RoomPlayer[];

  private constructor(
    readonly roomCode: string,
    readonly inviteCode: string,
    hostSeat: RoomPlayer,
  ) {
    this.hostSeat = hostSeat;
    this.players = [hostSeat];
  }

  /** The first seat, which created the room (host). */
  getHostSeat(): RoomPlayer {
    return this.hostSeat;
  }

  /** The public, secret-free roster (turn order). */
  getRoster(): readonly RosterPlayer[] {
    return this.players.map(({ playerId, playerName, isAI }) => ({ playerId, playerName, isAI }));
  }

  /** True when the given player id is the host seat. */
  isHostSeat(playerId: string): boolean {
    return this.hostSeat.playerId === playerId;
  }

  /** True when the given seat is automated. */
  isAiSeat(playerId: string): boolean {
    return this.players.some((player) => player.playerId === playerId && player.isAI);
  }

  /** Human-readable room lifecycle: "waiting" until a match started. */
  getStatus(): MatchState["status"] | "waiting" {
    return this.machine.getStatus();
  }

  /** True when a match has been started in this room. */
  hasStarted(): boolean {
    return this.machine.hasStarted();
  }

  /** Validates a room invite code; mismatch is a rejection. */
  assertInvite(inviteCode: string): void {
    if (inviteCode !== this.inviteCode) {
      throw new RoomChangeError(RoomRejectionCode.invalidInvite);
    }
  }

  /**
   * Admits a socket to the room. A player token matching an existing
   * seat reclaims that seat (reconnection); otherwise a new seat is
   * created, which is only possible while the room is still a lobby.
   */
  join(inviteCode: string, playerToken?: string): RoomPlayer {
    this.assertInvite(inviteCode);
    const existing = playerToken === undefined ? undefined : this.byToken(playerToken);
    if (existing !== undefined) {
      return existing;
    }
    if (this.machine.hasStarted()) {
      throw new RoomChangeError(RoomRejectionCode.matchAlreadyStarted);
    }
    if (this.players.length >= ROOM_MAX_PLAYERS) {
      throw new RoomChangeError(RoomRejectionCode.roomFull);
    }
    const player: RoomPlayer = {
      playerId: generatePlayerId(this.roomCode, this.players.length),
      playerName: `player-${this.players.length + 1}`,
      playerToken: generateSecretToken(),
      isAI: false,
    };
    this.players.push(player);
    return player;
  }

  /** Starts the match over the current seating order (host only, once). */
  startMatch(callerPlayerId: string): MatchState {
    if (!this.isHostSeat(callerPlayerId)) {
      throw new RoomChangeError(RoomRejectionCode.hostOnly);
    }
    if (this.machine.hasStarted()) {
      throw new RoomChangeError(RoomRejectionCode.matchAlreadyStarted);
    }
    return this.machine.startMatch(this.players.map((player) => player.playerId));
  }

  /** Records one dart throw through the state machine (authoritative). */
  recordThrow(playerId: string, points: number): MatchState {
    return this.machine.recordThrow(playerId, points);
  }

  /** Membership view for the given seat, containing only its secrets. */
  getMembership(player: RoomPlayer): RoomMembership {
    return {
      roomCode: this.roomCode,
      inviteCode: this.inviteCode,
      playerId: player.playerId,
      playerToken: player.playerToken,
      isHost: player.playerId === this.hostSeat.playerId,
      status: this.machine.getStatus(),
      roster: this.getRoster(),
      matchState: this.machine.getSnapshot(),
    };
  }

  /** Current JSON-safe match state snapshot, or null in the lobby. */
  getMatchSnapshot(): MatchState | null {
    return this.machine.getSnapshot();
  }

  private byToken(playerToken: string): RoomPlayer | undefined {
    return this.players.find((player) => player.playerToken === playerToken);
  }
}

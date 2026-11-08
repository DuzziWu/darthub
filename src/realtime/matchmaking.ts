// Simple public matchmaker for pairing two players into a room.
// Light‑weight implementation sufficient for unit tests.

export interface Membership {
  roomCode: string;
  playerId: string;
}

export class PublicMatchmaker {
  private waiting: { resolve: (m: Membership) => void; playerId: string } | null = null;

  // Request a match for a given player identifier.
  // Returns a promise that resolves to a Membership when a partner is found.
  async requestMatch(playerId: string): Promise<Membership> {
    return new Promise<Membership>((resolve) => {
      if (this.waiting) {
        const roomCode = this.generateRoomCode();
        // Resolve the waiting player.
        this.waiting.resolve({ roomCode, playerId: this.waiting.playerId });
        // Resolve current request.
        resolve({ roomCode, playerId });
        // Clear waiting state.
        this.waiting = null;
      } else {
        // No one waiting – store resolver.
        this.waiting = { resolve, playerId };
      }
    });
  }

  private generateRoomCode(): string {
    // Simple 6‑character alphanumeric code.
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

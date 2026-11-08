/**
 * GDPR export service.
 * Returns a serialisable object containing a user's personal data.
 * For now returns static empty collections for game history, rankings, friends, and quests.
 * Profile omits sensitive fields such as passwordHash.
 */

import type { UserRow } from "@/auth/repository";

/** Minimal user profile for export, derived from UserRow without passwordHash. */
export interface ExportProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportData {
  profile: ExportProfile;
  gameSessions: unknown[]; // placeholder for future implementation
  rankings: unknown[];
  friends: unknown[];
  quests: unknown[];
}

// Helper to strip internal fields.
function toExportProfile(user: UserRow): ExportProfile {
  const { id, email, displayName, role, createdAt, updatedAt } = user;
  return { id, email, displayName, role, createdAt, updatedAt };
}

export async function exportUserData(userId: string): Promise<ExportData> {
  // In a real implementation we would fetch from various repositories.
  // Here we only fetch the user profile via Prisma repository for demonstration.
  // Lazy implementation: import repository lazily to avoid circular deps.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  // Direct query to get user row.
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }
  const profile = toExportProfile(user as UserRow);
  // Empty collections as placeholder.
  return {
    profile,
    gameSessions: [],
    rankings: [],
    friends: [],
    quests: [],
  };
}

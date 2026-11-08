// GDPR delete service.
// Deletes a user account and all related data.
// Uses Prisma cascade delete for related tables and removes guest sessions manually.

import type { PrismaClient } from "@prisma/client";

/** Delete a user and related data.
 * @param userId ID of the user to delete.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  // Audit log – lightweight.
  console.log(`[Audit] GDPR delete for user ${userId}`);

  // Lazy import to avoid loading Prisma when not needed (e.g., in tests).
  const { PrismaClient } = await import("@prisma/client");
  const prisma: PrismaClient = new PrismaClient();

  // Remove any guest sessions linked to this user.
  await prisma.guest.deleteMany({ where: { userId } });

  // Delete the user. Cascades will handle related records per schema.
  await prisma.user.delete({ where: { id: userId } });

  // Close connection.
  await prisma.$disconnect();
}

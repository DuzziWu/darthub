// POST /api/auth/link-guest – link a guest session to a newly created user account.
// Thin handler that delegates all business logic to the Auth and Guest services.

import { NextResponse } from "next/server";
import { defaultAuthRuntime } from "@/auth/runtime";
import { GuestMigrationError, InvalidEmailError, EmailAlreadyRegisteredError } from "@/auth/errors";

export async function POST(request: Request) {
  try {
    const {
      guestId,
      migrationToken,
      email,
      password,
      displayName,
    }: {
      guestId: string;
      migrationToken: string;
      email: string;
      password: string;
      displayName: string;
    } = await request.json();

    // 1. Create the real user account.
    const { user, sessionToken } = await defaultAuthRuntime.authService.registerUser({
      email,
      password,
      displayName,
    });

    // 2. Migrate the guest data atomically.
    await defaultAuthRuntime.guestService.migrateGuestToUser({
      guestId,
      migrationToken,
      targetUserId: user.id,
    });

    // 3. Return a fresh JWT for the linked account.
    return NextResponse.json({ sessionToken });
  } catch (err) {
    // Map known domain errors to user‑friendly HTTP responses.
    if (
      err instanceof GuestMigrationError ||
      err instanceof InvalidEmailError ||
      err instanceof EmailAlreadyRegisteredError
    ) {
      return new NextResponse("Bad Request", { status: 400 });
    }
    // Unexpected errors – propagate as 500.
    console.error(err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

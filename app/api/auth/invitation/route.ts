import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createAuthService } from "@/auth/authService";
import { createPrismaAuthRepository } from "@/auth/prismaAuthRepository";
import { consumeInvitationCode, generateInvitationCode } from "@/auth/invitationStore";

// Service instance – in a real app this would be injected via DI.
const prisma = new PrismaClient();
const authService = createAuthService({ repository: createPrismaAuthRepository(prisma) });

/**
 * POST /api/auth/invitation
 *   { "action": "generate" }            -> returns { code }
 *   { "action": "register", "code": "ABCD1234", "email": "...", "password": "...", "displayName": "..." }
 *        -> registers user only if code is valid.
 */
export async function POST(request: Request): Promise<Response> {
  let body: {
    action?: string;
    code?: string;
    email?: string;
    password?: string;
    displayName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  if (action === "generate") {
    const code = generateInvitationCode();
    return NextResponse.json({ code });
  }

  if (action === "register") {
    const { code, email, password, displayName } = body;
    if (!code || !email || !password || !displayName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!consumeInvitationCode(code)) {
      return NextResponse.json({ error: "Invalid or used invitation code" }, { status: 400 });
    }
    try {
      const result = await authService.registerUser({ email, password, displayName });
      return NextResponse.json({ user: result.user, token: result.sessionToken }, { status: 201 });
    } catch (e) {
      // Forward auth errors (e.g., InvalidEmailError) as 400.
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

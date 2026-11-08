import type { NextApiRequest, NextApiResponse } from "next";
import { createAuthService } from "@/auth/authService";
import { prismaAuthRepository } from "@/auth/prismaAuthRepository";
import { consumeInvitationCode, generateInvitationCode } from "@/auth/invitationStore";

// Service instance – in a real app this would be injected via DI.
const authService = createAuthService({ repository: prismaAuthRepository });

/**
 * POST /api/auth/invitation
 *   { "action": "generate" }            -> returns { code }
 *   { "action": "register", "code": "ABCD1234", "email": "...", "password": "...", "displayName": "..." }
 *        -> registers user only if code is valid.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  const { action } = req.body as { action?: string };

  if (action === "generate") {
    const code = generateInvitationCode();
    return res.status(200).json({ code });
  }

  if (action === "register") {
    const { code, email, password, displayName } = req.body as {
      code?: string;
      email?: string;
      password?: string;
      displayName?: string;
    };
    if (!code || !email || !password || !displayName) {
      return res.status(400).json({ error: "Missing fields" });
    }
    if (!consumeInvitationCode(code)) {
      return res.status(400).json({ error: "Invalid or used invitation code" });
    }
    try {
      const result = await authService.registerUser({ email, password, displayName });
      return res.status(201).json({ user: result.user, token: result.sessionToken });
    } catch (e) {
      // Forward auth errors (e.g., InvalidEmailError) as 400.
      return res.status(400).json({ error: (e as Error).message });
    }
  }

  return res.status(400).json({ error: "Invalid action" });
}

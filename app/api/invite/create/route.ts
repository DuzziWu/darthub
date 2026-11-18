import { NextRequest, NextResponse } from "next/server";
import { createInviteCode } from "@/realtime/inviteService";
import { getDefaultRateLimiter } from "@/security/defaultRateLimiter";
import { INVITE_CREATE_POLICY } from "@/security/rateLimitPolicies";
import { RateLimitGuard } from "@/security/rateLimiter";

/**
 * POST /api/invite/create
 * Body: { roomId: string }
 * Returns: { code: string }
 *
 * **The route is rate limited.** A code that can be minted without a limit
 * is a code that can be minted in bulk — see
 * `src/security/rateLimitPolicies.ts`.
 */
const guard = new RateLimitGuard(getDefaultRateLimiter(), INVITE_CREATE_POLICY);

export async function POST(req: NextRequest) {
  const addressRefusal = await guard.checkAddress(req);
  if (addressRefusal !== null) {
    return addressRefusal;
  }

  const { roomId } = (await req.json()) as { roomId?: string };
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }
  const code = createInviteCode(roomId);
  return NextResponse.json({ code });
}

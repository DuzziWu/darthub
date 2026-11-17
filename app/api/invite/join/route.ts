import { NextRequest, NextResponse } from "next/server";
import { consumeInviteCode } from "@/realtime/inviteService";
import { getDefaultRateLimiter } from "@/security/defaultRateLimiter";
import { INVITE_JOIN_POLICY } from "@/security/rateLimitPolicies";
import { RateLimitGuard } from "@/security/rateLimiter";

/**
 * POST /api/invite/join
 * Body: { code: string }
 * Returns: { roomId: string } on success.
 *
 * **The route is rate limited.** A code is single use, but a short code can
 * be guessed — the limit is what stops a bulk guess — see
 * `src/security/rateLimitPolicies.ts`.
 */
const guard = new RateLimitGuard(getDefaultRateLimiter(), INVITE_JOIN_POLICY);

export async function POST(req: NextRequest) {
  const addressRefusal = await guard.checkAddress(req);
  if (addressRefusal !== null) {
    return addressRefusal;
  }

  const { code } = (await req.json()) as { code?: string };
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const roomId = consumeInviteCode(code);
  if (!roomId) {
    return NextResponse.json({ error: "Invalid or used invitation code" }, { status: 400 });
  }
  return NextResponse.json({ roomId });
}

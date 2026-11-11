import { NextRequest, NextResponse } from "next/server";
import { consumeInviteCode } from "@/realtime/inviteService";

/**
 * POST /api/invite/join
 * Body: { code: string }
 * Returns: { roomId: string } on success.
 */
export async function POST(req: NextRequest) {
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

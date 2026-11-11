import { NextRequest, NextResponse } from "next/server";
import { createInviteCode } from "@/realtime/inviteService";

/**
 * POST /api/invite/create
 * Body: { roomId: string }
 * Returns: { code: string }
 */
export async function POST(req: NextRequest) {
  const { roomId } = (await req.json()) as { roomId?: string };
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }
  const code = createInviteCode(roomId);
  return NextResponse.json({ code });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { createInviteCode } from "@/realtime/inviteService";

/**
 * POST /api/invite/create
 * Body: { roomId: string }
 * Returns: { code: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }
  const { roomId } = req.body as { roomId?: string };
  if (!roomId) {
    return res.status(400).json({ error: "Missing roomId" });
  }
  const code = createInviteCode(roomId);
  return res.status(200).json({ code });
}

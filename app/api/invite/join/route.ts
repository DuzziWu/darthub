import type { NextApiRequest, NextApiResponse } from "next";
import { consumeInviteCode } from "@/realtime/inviteService";

/**
 * POST /api/invite/join
 * Body: { code: string }
 * Returns: { roomId: string } on success.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }
  const { code } = req.body as { code?: string };
  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }
  const roomId = consumeInviteCode(code);
  if (!roomId) {
    return res.status(400).json({ error: "Invalid or used invitation code" });
  }
  return res.status(200).json({ roomId });
}

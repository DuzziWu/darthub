import { requireAuth } from "@/auth/requireAuth";
import { createFriendService } from "@/friends/FriendService";
import { createPrismaFriendRepository } from "@/friends/prismaFriendRepository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
): Promise<Response> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  const userId = authResult.identity.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { requestId } = await params;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (body.action !== "accept" && body.action !== "decline") {
    return new Response(JSON.stringify({ error: "action must be 'accept' or 'decline'" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const repo = createPrismaFriendRepository();
    const service = createFriendService({ repository: repo });

    if (body.action === "accept") {
      const updated = await service.acceptFriendRequest({ requestId, userId });
      return new Response(JSON.stringify({ friend: updated }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } else {
      // decline
      const updated = await service.declineFriendRequest({ requestId, userId });
      return new Response(JSON.stringify({ friend: updated }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const status = msg.includes("not found") ? 404 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }
}

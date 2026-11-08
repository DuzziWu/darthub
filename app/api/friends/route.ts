import { requireAuth } from "@/auth/requireAuth";
import { createFriendService } from "@/friends/FriendService";
import { createPrismaFriendRepository } from "@/friends/prismaFriendRepository";

export async function GET(request: Request): Promise<Response> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  const userId = authResult.identity.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const repo = createPrismaFriendRepository();
    const service = createFriendService({ repository: repo });
    const friends = await service.listFriends({ userId });
    return new Response(JSON.stringify({ friends }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error listing friends", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  const userId = authResult.identity.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: { addresseeId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body.addresseeId) {
    return new Response(JSON.stringify({ error: "addresseeId is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const repo = createPrismaFriendRepository();
    const service = createFriendService({ repository: repo });
    const friend = await service.sendFriendRequest({
      requesterId: userId,
      addresseeId: body.addresseeId,
    });
    return new Response(JSON.stringify({ friend }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const status =
      msg === "User not found" || msg === "Cannot send friend request to yourself"
        ? 400
        : msg === "Friend request already exists"
          ? 409
          : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }
}

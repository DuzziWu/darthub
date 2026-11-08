import { requireAuth } from "@/auth/requireAuth";
import { exportUserData } from "@/privacy/exportService";

export async function GET(request: Request): Promise<Response> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  const userId = authResult.identity.userId;
  if (!userId) {
    // Guest export not supported yet.
    return new Response(JSON.stringify({ error: "Guest export not supported" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Audit log – lightweight.
  console.log(`[Audit] GDPR export for user ${userId}`);

  const data = await exportUserData(userId);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

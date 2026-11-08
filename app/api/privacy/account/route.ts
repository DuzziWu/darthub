import { requireAuth } from "@/auth/requireAuth";
import { deleteUserAccount } from "@/privacy/deleteService";

export async function DELETE(request: Request): Promise<Response> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  const userId = authResult.identity.userId;
  if (!userId) {
    // Guests cannot delete account.
    return new Response(JSON.stringify({ error: "Guest accounts cannot be deleted" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    await deleteUserAccount(userId);
    // Audit already logged in service.
    return new Response(JSON.stringify({ success: true, message: "Account deleted" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error deleting user account", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

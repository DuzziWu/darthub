import { defaultAuthRuntime } from "@/auth/runtime";
import { createInvitationRouteHandlers } from "@/auth/invitationRoutes";

/**
 * POST /api/auth/invitation
 *   { "action": "generate" }            -> returns { code }
 *   { "action": "register", "code": "ABCD1234", "email": "...", "password": "...", "displayName": "..." }
 *        -> registers user only if code is valid.
 *
 * The behaviour lives in `src/auth/invitationRoutes.ts`; this file wires the
 * production runtime. The answer never carries the password hash, and the
 * route is rate limited — see the module for the details.
 */
const { POST } = createInvitationRouteHandlers({
  authService: defaultAuthRuntime.authService,
});

export { POST };

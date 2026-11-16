// POST /api/auth/register – create a player account.
// Thin handler that delegates all business logic to the auth service.

import { defaultAuthRuntime } from "@/auth/runtime";
import { createRegisterRouteHandlers } from "@/auth/registerRoutes";

const { POST } = createRegisterRouteHandlers({
  authService: defaultAuthRuntime.authService,
});

export { POST };

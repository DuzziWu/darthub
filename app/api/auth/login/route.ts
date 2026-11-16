// POST /api/auth/login – sign in to an existing account.
// Thin handler that delegates all business logic to the auth service.

import { defaultAuthRuntime } from "@/auth/runtime";
import { createLoginRouteHandlers } from "@/auth/loginRoutes";

const { POST } = createLoginRouteHandlers({
  authService: defaultAuthRuntime.authService,
});

export { POST };

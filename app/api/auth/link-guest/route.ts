// POST /api/auth/link-guest – link a guest session to a newly created user account.
// Thin handler that delegates all business logic to the Auth and Guest services.

import { defaultAuthRuntime } from "@/auth/runtime";
import { createLinkGuestRouteHandlers } from "@/auth/linkGuestRoutes";

const { POST } = createLinkGuestRouteHandlers({
  authService: defaultAuthRuntime.authService,
  guestService: defaultAuthRuntime.guestService,
});

export { POST };

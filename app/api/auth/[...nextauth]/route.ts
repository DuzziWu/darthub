// Thin App Router route handler for `/api/auth/[...nextauth]`.
//
// All configuration and logic live in `@/auth/nextauth` and the auth
// services; the provider callbacks are counted by `@/auth/authjsRoute`, so
// that a credential sign-in and a guest session cannot be attempted
// without a limit.
import { nextAuthHandlers } from "@/auth/nextauth";
import { createAuthJsRouteHandlers } from "@/auth/authjsRoute";

const { GET, POST } = createAuthJsRouteHandlers({ authHandlers: nextAuthHandlers });

export { GET, POST };

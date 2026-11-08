// Thin Auth.js catch-all handler. The repo uses the `app/` (root) layout, so
// this lives under `app/api/...` rather than `src/app/...`.
// All configuration and logic live in `@/auth/nextauth` and the auth services.
import { nextAuthHandlers } from "@/auth/nextauth";

export const { GET, POST } = nextAuthHandlers;

/**
 * The rate-limit guard for the Auth.js callback routes.
 *
 * ## Why the guard sits in front of Auth.js and not inside a provider
 *
 * Auth.js runs a credentials provider inside its `authorize` callback, and
 * a provider can only answer with a user or with nothing. A provider that
 * finds the limit reached cannot answer with **429** — the best it can do
 * is refuse, and Auth.js turns that into a redirect to its error page. A
 * client would then see "your request failed" instead of "you are sending
 * too many requests", and it could not tell the two apart.
 *
 * So the check runs **in front of** the Auth.js handler, in the route
 * module. There the answer is an ordinary HTTP response: `429` with a
 * `Retry-After` header for a reached limit, `503` for a counter store that
 * does not answer, and the untouched Auth.js response for everything else.
 *
 * ## Which paths are guarded
 *
 * Auth.js parses its own path the same way this module does: the base path
 * (`/api/auth`), then the **action**, then optionally the **provider id**
 * (see `parseActionAndProviderId` in `@auth/core`). A provider is only
 * ever reached through the `callback` action, and a credentials provider is
 * only ever reached through a **POST** (see the `provider.type ===
 * "credentials" && method === "POST"` branch in `@auth/core`). Both the
 * credential provider and the guest provider are credentials providers.
 *
 * The guard therefore matches every POST whose last two path segments are
 * `callback` and a provider id — the same shape Auth.js itself accepts, so
 * there is no path that reaches a provider without passing the guard.
 *
 * ## One counting point
 *
 * The guard is the **only** place that counts these requests. A second
 * check inside the provider would count the same request twice and halve
 * the effective limit. The provider is therefore left alone — it does the
 * credential check, the guard does the counting.
 */

import {
  AUTH_CALLBACK_POLICY,
  AUTH_GUEST_POLICY,
  AUTH_LOGIN_POLICY,
} from "@/security/rateLimitPolicies";
import { RateLimitGuard, type RateLimiter, type RateLimitPolicy } from "@/security/rateLimiter";
import { isValidEmail, normalizeEmail } from "./email";

/** The action of the Auth.js path that runs a provider. */
const CALLBACK_ACTION = "callback";

/** The provider id of the credential sign-in. */
const CREDENTIALS_PROVIDER = "credentials";

/** The provider id of the guest session. */
const GUEST_PROVIDER = "guest";

/**
 * The policy that applies to a path, or `null` when the path is not a
 * provider callback.
 *
 * The path is read the way Auth.js reads it: the last two segments are the
 * action and the provider id.
 */
export function callbackPolicy(pathname: string): RateLimitPolicy | null {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return null;
  }
  const providerId = segments[segments.length - 1] ?? "";
  const action = segments[segments.length - 2] ?? "";
  if (action !== CALLBACK_ACTION) {
    return null;
  }
  if (providerId === CREDENTIALS_PROVIDER) {
    // The **same bucket** as the own sign-in route: the two paths must
    // not be able to spend each other's budget, and a caller must not get
    // twice the limit by alternating between them.
    return AUTH_LOGIN_POLICY;
  }
  if (providerId === GUEST_PROVIDER) {
    return AUTH_GUEST_POLICY;
  }
  return AUTH_CALLBACK_POLICY;
}

/**
 * The address the request came from, read out of the body.
 *
 * The credential callback sends the address as a form field. The body is
 * read from a **clone**, so the original request still carries its body to
 * Auth.js.
 */
async function readAccountFromBody(request: Request): Promise<string | null> {
  try {
    const clone = request.clone();
    const contentType = clone.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await clone.formData();
      const email = form.get("email");
      return typeof email === "string" && isValidEmail(email) ? normalizeEmail(email) : null;
    }
    if (contentType.includes("application/json")) {
      const body = (await clone.json()) as { email?: unknown };
      return typeof body.email === "string" && isValidEmail(body.email)
        ? normalizeEmail(body.email)
        : null;
    }
  } catch {
    // A body that cannot be read leaves the account uncounted. The address
    // limit still applies, and a body that cannot be read cannot carry a
    // valid credential either.
  }
  return null;
}

/**
 * Counts one Auth.js callback request and decides.
 *
 * Returns the response the route must answer with, or `null` when the
 * request may proceed to Auth.js.
 *
 * The check runs **before** the credential comparison and before the guest
 * session is created: both are expensive, and neither may happen for a
 * request that the limit has already refused.
 */
export async function guardAuthJsCallback(
  request: Request,
  limiter: RateLimiter,
): Promise<Response | null> {
  const policy = callbackPolicy(new URL(request.url).pathname);
  if (policy === null) {
    return null;
  }

  const guard = new RateLimitGuard(limiter, policy);

  // The address is counted first: it needs nothing but the request.
  const addressRefusal = await guard.checkAddress(request);
  if (addressRefusal !== null) {
    return addressRefusal;
  }

  // The account is counted only for a policy that has one — and only for
  // an address that has the accepted shape.
  if (policy.perAccount === undefined) {
    return null;
  }
  const accountRefusal = await guard.checkAccount(await readAccountFromBody(request));
  return accountRefusal;
}

/**
 * The limits that apply to the endpoints of the product.
 *
 * Every number here is a decision, so every number carries its reason.
 * The two rules that shaped them:
 *
 * 1. **The account limit is the one that matters.** The address of a
 *    request comes from a header the client controls, so an address limit
 *    can be dodged by anyone who reaches the application directly. The
 *    account limit cannot: the account is looked up, not declared.
 * 2. **A limit must not lock out a legitimate player.** People share
 *    addresses — a household, an office, a mobile carrier's NAT — so the
 *    address limits are set well above what one person needs, and the
 *    account limits are set at the level where a single attacker guessing
 *    a single password is stopped.
 *
 * The windows are long enough that a player who trips a limit can wait it
 * out without writing to the support queue, and short enough that a
 * sustained attack spends the account in minutes rather than days.
 */

import type { RateLimitPolicy } from "./rateLimiter";

/** Fifteen minutes. */
const QUARTER_HOUR_SECONDS = 15 * 60;
/** One hour. */
const HOUR_SECONDS = 60 * 60;

/**
 * Signing in.
 *
 * Ten attempts per account and quarter hour is what stops a password
 * guess: a billion-entry dictionary needs a hundred million hours against
 * that limit, while a player who mistypes twice in a row never notices it.
 *
 * Thirty per address and quarter hour covers a shared address (an office
 * with twenty people signing in) with room to spare, while stopping one
 * host from spraying a thousand accounts.
 */
export const AUTH_LOGIN_POLICY: RateLimitPolicy = {
  name: "auth.login",
  perAddress: { limit: 30, windowSeconds: QUARTER_HOUR_SECONDS },
  perAccount: { limit: 10, windowSeconds: QUARTER_HOUR_SECONDS },
};

/**
 * Creating an account.
 *
 * Ten per address and hour stops an address from filling the database with
 * accounts; five per account and hour stops a loop of retries from
 * hammering one address. A person who registers an account and mistypes
 * the confirmation never comes near either limit.
 *
 * **No route of the product uses this bucket today.** The two paths that
 * create an account — the invitation flow and the guest conversion — have
 * their own buckets (`auth.invitation` and `auth.link-guest`), because they
 * are not the same act: one spends a code, the other converts a guest. The
 * numbers are here so that a dedicated registration route cannot be added
 * without a limit.
 */
export const AUTH_REGISTER_POLICY: RateLimitPolicy = {
  name: "auth.register",
  perAddress: { limit: 10, windowSeconds: HOUR_SECONDS },
  perAccount: { limit: 5, windowSeconds: HOUR_SECONDS },
};

/**
 * Turning a guest session into an account.
 *
 * The same numbers as the registration, because it is the same act: it
 * creates an account. It has its own bucket so that the two paths cannot
 * be used to double the other's budget.
 */
export const AUTH_LINK_GUEST_POLICY: RateLimitPolicy = {
  name: "auth.link-guest",
  perAddress: { limit: 10, windowSeconds: HOUR_SECONDS },
  perAccount: { limit: 5, windowSeconds: HOUR_SECONDS },
};

/**
 * The invitation endpoint.
 *
 * Ten per address and hour covers both halves of the flow: minting a code
 * and spending it. Five per account and hour stops one address from
 * registering many accounts through a single code.
 */
export const AUTH_INVITATION_POLICY: RateLimitPolicy = {
  name: "auth.invitation",
  perAddress: { limit: 10, windowSeconds: HOUR_SECONDS },
  perAccount: { limit: 5, windowSeconds: HOUR_SECONDS },
};

/**
 * Creating a guest session through Auth.js.
 *
 * A guest session is not free: it writes a mirror account, a guest row and
 * a bcrypt hash. Ten per address and hour leaves a player who wants to try
 * the game without an account room to spare, and stops an address from
 * filling the database with mirror accounts.
 *
 * The Auth.js callback uses this bucket, and **not** the registration
 * bucket: the two paths must not be able to spend each other's budget.
 */
export const AUTH_GUEST_POLICY: RateLimitPolicy = {
  name: "auth.guest",
  perAddress: { limit: 10, windowSeconds: HOUR_SECONDS },
};

/**
 * Any other Auth.js callback.
 *
 * A safety net for a provider that is added later: it gets the same
 * address budget as a sign-in and no account budget, because a callback
 * that carries no address in its body cannot be counted per account.
 */
export const AUTH_CALLBACK_POLICY: RateLimitPolicy = {
  name: "auth.callback",
  perAddress: { limit: 30, windowSeconds: QUARTER_HOUR_SECONDS },
};

/**
 * Creating a private room's invitation code.
 *
 * Thirty per address and hour: a player opens a private room and shares
 * its code; nobody needs more than a handful.
 */
export const INVITE_CREATE_POLICY: RateLimitPolicy = {
  name: "invite.create",
  perAddress: { limit: 30, windowSeconds: HOUR_SECONDS },
};

/**
 * Spending a private room's invitation code.
 *
 * Sixty per address and hour: a code is single use, and a player who
 * mistypes it needs to try again. The limit is here to stop a code being
 * guessed in bulk, not to stop a player from retrying.
 */
export const INVITE_JOIN_POLICY: RateLimitPolicy = {
  name: "invite.join",
  perAddress: { limit: 60, windowSeconds: HOUR_SECONDS },
};

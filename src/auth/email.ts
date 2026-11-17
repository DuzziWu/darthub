/**
 * The one address pattern and the one normalisation the product accepts.
 *
 * Both used to live in three places — `authService.ts`, `loginRoutes.ts` and
 * `registerRoutes.ts` — each with its own copy of the pattern and its own
 * idea of how an address is normalised. That is how a second spelling of an
 * address can end up as a second account: the account lookup normalises one
 * way, the rate limiter another way, and the two never meet.
 *
 * One module owns both now. The rate limiter keys its per-account counters
 * on {@link normalizeEmail}, and the account lookup uses the same function,
 * so `Player@Darthub.DEV`, `player@darthub.dev` and `  player@darthub.dev `
 * are one account and one counter.
 */

/** The address shape the product accepts: one `@`, no whitespace, a dot in
 * the domain. Hand-written on purpose — the product validates two fields and
 * does not need a schema library for them. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The canonical form of an address.
 *
 * Trimming and lower-casing are what the database lookup does as well
 * (`src/auth/prismaAuthRepository.ts` lower-cases the address it looks up),
 * so this function is the single definition of "the same address".
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when the address has the accepted shape. The address is normalised
 * first, so leading and trailing whitespace never decides the outcome. */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

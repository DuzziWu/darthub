/**
 * The address of the client that sent a request.
 *
 * The address is one of the two keys the rate limiter counts on, so how it
 * is read decides how easily the limit can be dodged.
 *
 * ## The assumption this module rests on
 *
 * **The application must only be reachable through a proxy that sets the
 * client address correctly.** Everything below is only as trustworthy as
 * that network path:
 *
 * - The headers a request carries are set by whoever sent it. A client
 *   that reaches the application directly can put any address into
 *   `x-forwarded-for`.
 * - A proxy that **appends** its own observation leaves the entries a
 *   client supplied at the **front** of the list. Those are the forgeable
 *   ones.
 * - A proxy that **overwrites** the header leaves a single entry, which is
 *   the real address.
 *
 * **This module therefore reads the last entry of the list**, never the
 * first. The last entry is the one the proxy closest to the application
 * added — the only entry a client cannot prepend to. Under the "overwrite"
 * semantics there is exactly one entry and "last" is that entry. The rule
 * is therefore correct under both behaviours and does not depend on which
 * one the proxy in front of this deployment happens to use.
 *
 * A value that is not a valid IP address is **not** used at all: it would
 * otherwise create a new counter bucket per request, and the limit would
 * be worth nothing. Such a request shares the single "unknown" bucket
 * with every other request that carries no usable address.
 *
 * The per-account limit (`src/security/rateLimitPolicies.ts`) is the limit
 * that holds in any case: the account is looked up, not declared, so no
 * header can forge it. It is the backstop for the whole mechanism.
 */

import { isIP } from "node:net";

/** The bucket used when a request carries no usable address. Every such
 * request shares one bucket, which is the safe direction: the limit still
 * applies, it is simply shared. */
export const UNKNOWN_ADDRESS = "unknown";

/** The header a reverse proxy uses to name the client it served. */
const FORWARDED_FOR_HEADER = "x-forwarded-for";

/** The header Nginx-style proxies use. Consulted only when the standard
 * header is absent entirely — never when it is present but unusable, and
 * never for the account of an entry in the list. */
const REAL_IP_HEADER = "x-real-ip";

/**
 * The address of the client that sent the request.
 *
 * The result is either a valid IP address or {@link UNKNOWN_ADDRESS}.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get(FORWARDED_FOR_HEADER);
  if (forwarded !== null) {
    // The list grows at the front when a client supplies entries of its
    // own, so the **last** entry is the one the closest proxy added. The
    // last non-empty entry is used; an empty tail means the header is not
    // trustworthy and the request falls into the shared bucket.
    const entries = forwarded.split(",");
    const last = entries[entries.length - 1]?.trim() ?? "";
    if (last.length > 0) {
      const address = normalizeAddress(last);
      if (isValidAddress(address)) {
        return address;
      }
      // The proxy wrote something that is not an address. The request is
      // not counted in a bucket of its own — that would let a caller
      // create a new bucket per request.
      return UNKNOWN_ADDRESS;
    }
  }

  const realIp = request.headers.get(REAL_IP_HEADER);
  if (realIp !== null) {
    const address = normalizeAddress(realIp);
    if (isValidAddress(address)) {
      return address;
    }
  }

  return UNKNOWN_ADDRESS;
}

/**
 * The canonical form of an address.
 *
 * The same client must always produce the same key, whatever the proxy
 * wrote into the header: `203.0.113.7` and `203.0.113.7:51000` are one
 * client, `[::1]` and `::1` are one client, and `::ffff:203.0.113.7` is
 * the IPv4 client `203.0.113.7`.
 */
export function normalizeAddress(value: string): string {
  let address = value.trim().toLowerCase();
  if (address.length === 0) {
    return "";
  }

  if (address.startsWith("[")) {
    // [::1]:8080 → ::1
    const end = address.indexOf("]");
    if (end !== -1) {
      address = address.slice(1, end);
    }
  } else if (address.includes(":")) {
    // An IPv6 address has several colons and no port; an IPv4 address with
    // a port has exactly one.
    const parts = address.split(":");
    const port = parts[1];
    if (parts.length === 2 && port !== undefined && /^\d+$/.test(port)) {
      address = parts[0] ?? address;
    }
  }

  // ::ffff:203.0.113.7 → 203.0.113.7
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mapped !== null) {
    address = mapped[1] ?? address;
  }

  return address;
}

/**
 * True when the value is an IP address.
 *
 * Anything else is not an address and must not become a counter bucket of
 * its own.
 */
export function isValidAddress(value: string): boolean {
  return isIP(value) !== 0;
}

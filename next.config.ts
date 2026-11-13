import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Origins the dev server accepts requests from.
 *
 * The dev server allows `localhost` and its subdomains out of the box, but
 * rejects every other host with 403. A rejected request breaks hydration:
 * the page renders from the server HTML, but no React handler is ever
 * attached, so the controls look live and do nothing when clicked. That is
 * the "Start match does nothing" failure.
 *
 * These are the loopback addresses a developer reaches the dev server on.
 * Entries are hostnames only — no scheme, no port — because Next.js matches
 * the `Origin` header's hostname against them.
 */
const LOOPBACK_DEV_ORIGINS = ["127.0.0.1", "[::1]", "0.0.0.0"];

/**
 * The addresses of this machine's network interfaces. The dev server prints
 * a "Network:" URL built from one of these, so a developer who opens that
 * URL gets the same 403-blocked, never-hydrating page unless the address is
 * allowlisted.
 *
 * IPv6 addresses are bracketed, because that is the form Next.js parses an
 * `Origin` header's hostname into.
 */
const NETWORK_DEV_ORIGINS = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => !address.internal)
  .map((address) => (address.family === "IPv6" ? `[${address.address}]` : address.address));

/**
 * Extra origins from the environment, for a dev server reached over the LAN
 * or through a tunnel: `ALLOWED_DEV_ORIGINS=my-host.lan,tunnel.example.com`.
 */
const EXTRA_DEV_ORIGINS = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const allowedDevOrigins = [
  ...new Set([...LOOPBACK_DEV_ORIGINS, ...NETWORK_DEV_ORIGINS, ...EXTRA_DEV_ORIGINS]),
];

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle in .next/standalone, which the
  // production Docker image copies into the final (runner) stage. This keeps
  // the image free of node_modules/devDependencies and node_modules tracing
  // artifacts outside the server bundle.
  output: "standalone",
  allowedDevOrigins,
};

export default nextConfig;

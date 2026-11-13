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

/**
 * The path prefix the application is published under, e.g. `/darthub`.
 *
 * Set `BASE_PATH` when the app is served behind a proxy that mounts it on a
 * sub-path, as Tailscale Serve does with `tailscale serve --set-path=/darthub`.
 * The prefix then appears in every URL the app hands out: stylesheets, scripts
 * and fonts are requested as `/darthub/_next/...` instead of `/_next/...`.
 *
 * Tailscale Serve strips the mount prefix before it forwards a request, so
 * the backend receives `/game` for a browser that asked for `/darthub/game`.
 * The browser, however, resolves the stylesheet and the client bundle
 * against the URL it was given and therefore asks for `/darthub/_next/...`.
 * Without the prefix those requests find no mount and answer 404: the HTML
 * arrives, but the page is unstyled and nothing is interactive.
 *
 * `assetPrefix` is the option that fixes this. It moves the asset URLs under
 * the prefix and leaves the routes where they are. `basePath` would move the
 * routes as well, which does not survive the prefix being stripped: Next.js
 * answers 404 for a request whose path does not start with the `basePath`.
 *
 * Empty by default, so local development on `http://localhost:3000` keeps
 * serving at the root. The value is read when the config is loaded and is
 * inlined into the client bundles at build time, so a production build needs
 * it set in the build stage.
 */
const BASE_PATH = (process.env.BASE_PATH ?? "").trim();

/** A base path must start with a slash and must not end with one. */
function normalizeBasePath(value: string): string {
  if (!value.startsWith("/")) {
    throw new Error(`BASE_PATH must start with a slash, got "${value}"`);
  }
  return value.replace(/\/+$/, "");
}

const basePath = BASE_PATH ? normalizeBasePath(BASE_PATH) : "";

/**
 * Where the build output goes.
 *
 * The end-to-end suite needs two builds side by side: one served from the
 * root, as a developer runs it, and one built with the prefix, as the
 * published app is. `NEXT_DIST_DIR` gives the second build its own
 * directory so neither overwrites the other.
 */
const distDir = process.env.NEXT_DIST_DIR?.trim() ?? "";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle in .next/standalone, which the
  // production Docker image copies into the final (runner) stage. This keeps
  // the image free of node_modules/devDependencies and node_modules tracing
  // artifacts outside the server bundle.
  output: "standalone",
  allowedDevOrigins,
  ...(distDir ? { distDir } : {}),
  ...(basePath ? { assetPrefix: basePath } : {}),
  // The prefix the app builds its own links with. `assetPrefix` moves the
  // asset URLs, this moves the links the router follows.
  ...(basePath ? { env: { NEXT_PUBLIC_BASE_PATH: basePath } } : {}),
};

export default nextConfig;

/**
 * The path prefix the app is published under, e.g. `/darthub`.
 *
 * The prefix is needed on both sides of the render: the server renders the
 * markup, and the client hydrates it. `NEXT_PUBLIC_` variables are inlined
 * into both bundles at build time, which is what makes the same value
 * available to a server component and to a client component.
 *
 * The prefix is empty for local development, where the app is served from
 * the root of `http://localhost:3000`.
 */
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();

/**
 * The path prefix, normalized: a leading slash, no trailing slash, or an
 * empty string when the app is served from the root.
 */
export const BASE_PATH_PREFIX: string = (() => {
  if (!BASE_PATH) return "";
  const withLeadingSlash = BASE_PATH.startsWith("/") ? BASE_PATH : `/${BASE_PATH}`;
  return withLeadingSlash.replace(/\/+$/, "");
})();

/**
 * Puts the prefix in front of an app path.
 *
 * `/game` becomes `/darthub/game` when the app is published under
 * `/darthub`, and stays `/game` otherwise. An external URL, a hash or a
 * query-only link is left alone — the prefix belongs to this app's routes,
 * not to somebody else's.
 */
export function withBasePath(path: string): string {
  if (!BASE_PATH_PREFIX) return path;
  if (!path.startsWith("/")) return path;
  if (path === "/") return BASE_PATH_PREFIX;
  return `${BASE_PATH_PREFIX}${path}`;
}

/**
 * Removes the prefix from a path that carries it.
 *
 * `usePathname()` reports the path without the prefix, so a route that was
 * reached through the prefix has to be compared without it as well.
 */
export function withoutBasePath(path: string): string {
  if (!BASE_PATH_PREFIX) return path;
  if (path === BASE_PATH_PREFIX) return "/";
  if (path.startsWith(`${BASE_PATH_PREFIX}/`)) return path.slice(BASE_PATH_PREFIX.length);
  return path;
}

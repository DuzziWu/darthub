import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * The app is published under a path prefix, e.g. `/darthub`, behind a proxy
 * that mounts it there — as Tailscale Serve does with
 * `tailscale serve --set-path=/darthub`.
 *
 * Tailscale Serve strips the mount prefix before it forwards the request, so
 * the backend sees `/game` for a browser that asked for `/darthub/game`. The
 * browser resolves the stylesheet and the client bundle against the URL it was
 * given and asks for `/darthub/_next/...`. Those requests find no mount and
 * answer 404, which is what makes the page arrive unstyled, unhydrated and
 * with both navigation bars visible at once.
 *
 * `assetPrefix` moves the asset URLs under the prefix while leaving the
 * routes alone, so it survives the prefix being stripped. `basePath` would
 * move the routes too, and Next.js answers 404 for a request whose path does
 * not start with the `basePath` — the routes would break instead.
 */
describe("base path", () => {
  /** The config reads the environment when it is imported. */
  const loadConfig = async (basePath: string | undefined) => {
    vi.resetModules();
    if (basePath === undefined) {
      delete process.env.BASE_PATH;
    } else {
      process.env.BASE_PATH = basePath;
    }
    const { default: config } = await import("../../next.config");
    return config;
  };

  afterEach(() => {
    delete process.env.BASE_PATH;
    vi.resetModules();
  });

  it("serves at the root when no prefix is configured", async () => {
    const config = await loadConfig(undefined);

    expect(config.assetPrefix).toBeUndefined();
    expect("basePath" in config).toBe(false);
  });

  it("puts the asset URLs under the prefix", async () => {
    const config = await loadConfig("/darthub");

    expect(config.assetPrefix).toBe("/darthub");
  });

  it("tells the app to build its own links with the prefix", async () => {
    const config = await loadConfig("/darthub");

    // The links are built by the app itself: `next/link` derives its prefix
    // from `basePath`, which cannot be set here, so the prefix is handed to
    // the app through the environment instead.
    expect(config.env).toEqual({ NEXT_PUBLIC_BASE_PATH: "/darthub" });
  });

  it("leaves the link prefix unset when the app is served from the root", async () => {
    const config = await loadConfig(undefined);

    expect(config.env).toBeUndefined();
  });

  it("leaves the routes at the root, so a stripped prefix still resolves", async () => {
    const config = await loadConfig("/darthub");

    // Next.js answers 404 for a path that does not start with the basePath,
    // so the routes must not move into the prefix.
    expect("basePath" in config).toBe(false);
  });

  it("accepts a prefix with a trailing slash", async () => {
    const config = await loadConfig("/darthub/");

    expect(config.assetPrefix).toBe("/darthub");
  });

  it("rejects a prefix that does not start with a slash", async () => {
    await expect(loadConfig("darthub")).rejects.toThrow(/must start with a slash/);
  });
});

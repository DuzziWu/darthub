import { networkInterfaces } from "node:os";
import { describe, it, expect, afterEach, vi } from "vitest";
import { blockCrossSiteDEV } from "next/dist/server/lib/router-utils/block-cross-site-dev";

/**
 * The dev server refuses cross-origin requests to its own resources unless
 * the origin is allowlisted, and it answers a refused request with 403.
 *
 * The refused request is what breaks the game: the page still renders from
 * the server's HTML, but the client bundle never hydrates, so React attaches
 * no handlers. "Start match" looks like a live button and does nothing when
 * clicked, and no dart can be thrown.
 *
 * The guard and the origin matcher imported here are the ones the dev server
 * itself uses, so these tests check the real rule rather than a restatement
 * of it.
 */
describe("dev server origins", () => {
  /** The config is read at import time, so it is re-imported per case. */
  const loadConfig = async () => {
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    return config;
  };

  /** A request for a dev-only resource, sent from the given origin. */
  const devResourceRequest = (origin: string) => ({
    url: "/_next/hmr",
    headers: { origin },
  });

  /**
   * Runs the dev server's own guard and reports whether it refused the
   * request.
   */
  const isRefused = (origin: string, allowedOrigins: string[], hostname = "localhost"): boolean => {
    const response = {
      statusCode: 200,
      end: () => undefined,
    };
    return blockCrossSiteDEV(
      devResourceRequest(origin) as never,
      response as never,
      allowedOrigins,
      hostname,
    );
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allowlists the loopback addresses a developer opens the dev server on", async () => {
    const config = await loadConfig();
    const allowed = config.allowedDevOrigins ?? [];

    // `localhost` is allowed by Next.js itself; these are not.
    for (const origin of ["127.0.0.1", "[::1]", "0.0.0.0"]) {
      expect(allowed, `dev origins must include ${origin}`).toContain(origin);
    }
  });

  it("does not refuse a dev request from any loopback address", async () => {
    const config = await loadConfig();
    const allowed = config.allowedDevOrigins ?? [];

    for (const origin of ["127.0.0.1", "[::1]", "0.0.0.0"]) {
      expect(
        isRefused(`http://${origin}:3000`, allowed),
        `the dev server must accept requests from ${origin}`,
      ).toBe(false);
    }
  });

  it("allowlists the machine's own network addresses", async () => {
    const config = await loadConfig();
    const allowed = config.allowedDevOrigins ?? [];

    // The dev server prints a "Network:" URL built from one of these, so the
    // address it advertises has to be allowed or that URL is a dead page.
    const addresses = Object.values(networkInterfaces())
      .flatMap((entries) => entries ?? [])
      .filter((entry) => !entry.internal)
      .map((entry) => (entry.family === "IPv6" ? `[${entry.address}]` : entry.address));

    for (const address of addresses) {
      expect(allowed, `dev origins must include ${address}`).toContain(address);
      expect(
        isRefused(`http://${address}:3000`, allowed),
        `the dev server must accept requests from ${address}`,
      ).toBe(false);
    }
  });

  it("lists every allowed origin once", async () => {
    const config = await loadConfig();
    const allowed = config.allowedDevOrigins ?? [];

    expect(new Set(allowed).size).toBe(allowed.length);
  });

  it("adds the origins named in ALLOWED_DEV_ORIGINS", async () => {
    vi.stubEnv("ALLOWED_DEV_ORIGINS", "dev-host.lan, tunnel.example.com");

    const config = await loadConfig();
    const allowed = config.allowedDevOrigins ?? [];

    expect(allowed).toContain("dev-host.lan");
    expect(allowed).toContain("tunnel.example.com");
    expect(isRefused("http://dev-host.lan:3000", allowed)).toBe(false);
    expect(isRefused("http://tunnel.example.com:3000", allowed)).toBe(false);
  });

  it("ignores blank entries in ALLOWED_DEV_ORIGINS", async () => {
    vi.stubEnv("ALLOWED_DEV_ORIGINS", " , dev-host.lan , ");

    const config = await loadConfig();
    const allowed = config.allowedDevOrigins ?? [];

    expect(allowed).toContain("dev-host.lan");
    expect(allowed.every((origin) => origin.trim() === origin)).toBe(true);
  });

  it("still refuses an origin that is not allowlisted", async () => {
    const config = await loadConfig();
    const allowed = config.allowedDevOrigins ?? [];

    expect(isRefused("http://not-allowed.example.com:3000", allowed)).toBe(true);
  });

  it("keeps the standalone output the production image depends on", async () => {
    const config = await loadConfig();
    expect(config.output).toBe("standalone");
  });
});

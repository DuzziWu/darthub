import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * The prefix helper builds the app's own links.
 *
 * The app is published under a path prefix behind a proxy that mounts it
 * there — as Tailscale Serve does with `tailscale serve --set-path=/darthub`.
 * The proxy strips the prefix before the request reaches Next.js, so the
 * routes stay at the root while the assets and the links carry the prefix.
 *
 * The helper reads the prefix from the environment when it is imported, so
 * every case loads the module afresh.
 */
describe("base path helper", () => {
  const loadHelper = async (prefix: string | undefined) => {
    vi.resetModules();
    if (prefix === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = prefix;
    }
    return import("../../src/lib/basePath");
  };

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.resetModules();
  });

  describe("without a prefix", () => {
    it("leaves the paths alone", async () => {
      const { withBasePath, withoutBasePath, BASE_PATH_PREFIX } = await loadHelper(undefined);

      expect(BASE_PATH_PREFIX).toBe("");
      expect(withBasePath("/game")).toBe("/game");
      expect(withBasePath("/")).toBe("/");
      expect(withoutBasePath("/game")).toBe("/game");
    });
  });

  describe("with the prefix /darthub", () => {
    it("puts the prefix in front of a route", async () => {
      const { withBasePath } = await loadHelper("/darthub");

      expect(withBasePath("/game")).toBe("/darthub/game");
      expect(withBasePath("/game/cricket")).toBe("/darthub/game/cricket");
    });

    it("maps the root route to the prefix itself", async () => {
      const { withBasePath } = await loadHelper("/darthub");

      expect(withBasePath("/")).toBe("/darthub");
    });

    it("removes the prefix again", async () => {
      const { withoutBasePath } = await loadHelper("/darthub");

      expect(withoutBasePath("/darthub")).toBe("/");
      expect(withoutBasePath("/darthub/game")).toBe("/game");
    });

    it("normalizes a prefix with a trailing slash", async () => {
      const { BASE_PATH_PREFIX, withBasePath } = await loadHelper("/darthub/");

      expect(BASE_PATH_PREFIX).toBe("/darthub");
      expect(withBasePath("/game")).toBe("/darthub/game");
    });

    it("adds the missing leading slash", async () => {
      const { BASE_PATH_PREFIX, withBasePath } = await loadHelper("darthub");

      expect(BASE_PATH_PREFIX).toBe("/darthub");
      expect(withBasePath("/game")).toBe("/darthub/game");
    });

    it("leaves a path that is not a route alone", async () => {
      const { withBasePath } = await loadHelper("/darthub");

      expect(withBasePath("#section")).toBe("#section");
      expect(withBasePath("mailto:someone@example.com")).toBe("mailto:someone@example.com");
    });
  });
});

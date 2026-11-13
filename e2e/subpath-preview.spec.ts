import { createServer, request as httpRequest, type Server } from "node:http";
import { test, expect } from "@playwright/test";

/**
 * The app is published under a path prefix behind Tailscale Serve.
 *
 * Tailscale Serve strips the mount prefix before it forwards a request
 * (`http.StripPrefix` in `ipn/ipnlocal/serve.go`), so the backend receives
 * `/game` for a browser that asked for `/darthub/game`. The browser, in
 * turn, resolves the stylesheet and the client bundle against the URL it was
 * given and asks for `/darthub/_next/...`.
 *
 * When the asset URLs carry no prefix, those requests find no mount and
 * answer 404: the HTML arrives, but the page is unstyled, the client bundle
 * never hydrates, and the two navigation bars — the desktop header nav and
 * the mobile tab bar — are both visible at once because the CSS that hides
 * one of them never loaded.
 *
 * These tests build the app with the prefix, reproduce that proxy in front
 * of it and assert that the whole page works through it.
 */

/** The prefix the app is published under. */
const PREFIX = "/darthub";

/** The port the app itself is served on behind the proxy. */
const BACKEND_PORT = 3111;

/** The port the proxy is served on. */
const PROXY_PORT = 3112;

/** The routes the preview must serve. */
const ROUTES = ["/", "/game", "/game/301", "/game/cricket", "/lobby", "/game-center"] as const;

/**
 * A reverse proxy that behaves like Tailscale Serve: requests outside the
 * mount point are refused, and the mount prefix is stripped from the path
 * before the request is forwarded.
 *
 * Only the path is stripped. The query string belongs to the request and is
 * forwarded as it is, which is what Tailscale does — the client router
 * asks for `?_rsc=…` and a proxy that swallowed it would break every
 * client-side navigation.
 */
const startProxy = async (): Promise<Server> => {
  const proxy = createServer((incoming, response) => {
    const url = incoming.url ?? "/";
    const separator = url.indexOf("?");
    let path = separator === -1 ? url : url.slice(0, separator);
    const query = separator === -1 ? "" : url.slice(separator);

    if (path === PREFIX) {
      path = "/";
    } else if (path.startsWith(`${PREFIX}/`)) {
      path = path.slice(PREFIX.length);
    } else {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("no mount point");
      return;
    }

    const upstream = httpRequest(
      {
        host: "127.0.0.1",
        port: BACKEND_PORT,
        path: path + query,
        method: incoming.method,
        headers: { ...incoming.headers, host: `127.0.0.1:${BACKEND_PORT}` },
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      },
    );
    upstream.on("error", () => {
      response.writeHead(502, { "content-type": "text/plain" });
      response.end("bad gateway");
    });
    incoming.pipe(upstream);
  });

  await new Promise<void>((resolve) => proxy.listen(PROXY_PORT, "127.0.0.1", resolve));
  return proxy;
};

/**
 * Waits for the prefixed build to answer.
 *
 * The server itself is started by Playwright (see `playwright.config.ts`),
 * which builds the app with the prefix and serves it on `BACKEND_PORT`.
 */
const waitForApp = async (): Promise<void> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const reachable = await fetch(`http://127.0.0.1:${BACKEND_PORT}/game`).then(
      (response) => response.ok,
      () => false,
    );
    if (reachable) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("the prefixed build did not start in time");
};

test.describe("sub-path preview", () => {
  let proxy: Server;
  let baseURL: string;

  test.beforeAll(async () => {
    baseURL = `http://127.0.0.1:${PROXY_PORT}`;
    await waitForApp();
    proxy = await startProxy();
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
  });

  test("it serves the page through the prefix", async ({ request }) => {
    for (const route of ROUTES) {
      const response = await request.get(`${baseURL}${PREFIX}${route}`);
      expect(response.status(), `route ${route}`).toBe(200);
    }
  });

  test("it loads the stylesheet and the client bundle", async ({ page }) => {
    const failed: string[] = [];
    page.on("requestfailed", (request) => failed.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${baseURL}${PREFIX}/game`);

    // The stylesheet is what hides the mobile tab bar on a wide viewport, so
    // a page that loaded it shows exactly one navigation.
    await expect(page.locator("nav[aria-label='Primary']").first()).toBeVisible();
    await expect(page.locator("nav[aria-label='Primary']").last()).toBeHidden();

    const stylesheets = await page.evaluate(() =>
      Array.from(document.styleSheets).map((sheet) => sheet.href),
    );
    expect(stylesheets.length).toBeGreaterThan(0);
    for (const href of stylesheets) {
      expect(href, "a stylesheet must be requested under the prefix").toContain(PREFIX);
    }

    expect(failed, `failed requests: ${failed.join(", ")}`).toEqual([]);
  });

  test("it hydrates the page, so the controls respond", async ({ page }) => {
    await page.goto(`${baseURL}${PREFIX}/game`);

    const button = page.getByRole("button", { name: /start match/i });
    await expect(button).toBeVisible();

    // A hydrated React element carries a fiber key on its DOM node; an
    // unhydrated one does not.
    const hydrated = await button.evaluate((element) =>
      Object.keys(element).some((key) => key.startsWith("__react")),
    );
    expect(hydrated, "the client bundle must hydrate the page").toBe(true);
  });

  test("it builds its navigation links with the prefix", async ({ page }) => {
    await page.goto(`${baseURL}${PREFIX}/game-center`);

    const links = await page
      .locator("nav[aria-label='Primary'] a")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      expect(href, "a navigation link must carry the prefix").toContain(PREFIX);
    }
  });

  test("it navigates through the prefix", async ({ page }) => {
    await page.goto(`${baseURL}${PREFIX}/game`);

    const link = page.getByRole("link", { name: /game center/i }).first();
    await link.click();

    // The navigation must stay inside the mount point: a link that escapes
    // it would leave the app and land on a path the proxy does not serve.
    await expect(page).toHaveURL(`${baseURL}${PREFIX}/game-center`);
    await expect(page.locator("main#main h1")).toBeVisible();
  });

  test("it marks the current route in the navigation", async ({ page }) => {
    // The navigation compares `usePathname()` with the route it links to.
    // The path the hook reports carries no prefix, so the comparison must
    // stay unprefixed — otherwise no entry is ever marked as the current
    // one and the location marker is lost.
    for (const route of ["/lobby", "/career", "/dashboard"]) {
      await page.goto(`${baseURL}${PREFIX}${route}`);

      const current = await page
        .locator("nav[aria-label='Primary'] a[aria-current='page']")
        .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));

      expect(current.length, `route ${route} must be marked as current`).toBeGreaterThan(0);
      for (const href of current) {
        expect(href).toBe(`${PREFIX}${route}`);
      }
    }
  });

  test("it keeps the client-side navigation inside the mount point", async ({ page }) => {
    const failed: string[] = [];
    page.on("requestfailed", (request) => failed.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${baseURL}${PREFIX}/game`);

    // A client-side navigation fetches the route it moves to. Without the
    // prefix on those requests the router would ask for a path outside the
    // mount point and the navigation would fail.
    await page.getByRole("link", { name: /lobby/i }).first().click();
    await expect(page).toHaveURL(`${baseURL}${PREFIX}/lobby`);

    expect(failed, `failed requests: ${failed.join(", ")}`).toEqual([]);
  });
});

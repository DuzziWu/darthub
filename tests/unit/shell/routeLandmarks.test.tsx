// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/**
 * Every route renders inside the shell's single `<main id="main">` landmark.
 *
 * The pages are the ones the shell owns the landmark for: each of them used
 * to render its own `<main>`, which would have nested two main landmarks.
 */

vi.mock("next/font/google", () => ({
  Barlow_Condensed: () => ({ variable: "--font-barlow-condensed", className: "font-display" }),
  Barlow: () => ({ variable: "--font-barlow", className: "font-body" }),
  JetBrains_Mono: () => ({ variable: "--font-jetbrains-mono", className: "font-mono" }),
}));

const currentPath = { value: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath.value,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const ROUTES = [
  { path: "/", page: () => import("../../../app/page") },
  { path: "/game", page: () => import("../../../app/game/page") },
  { path: "/game/301", page: () => import("../../../app/game/301/page") },
  { path: "/game/cricket", page: () => import("../../../app/game/cricket/page") },
  {
    path: "/game/around-the-clock",
    page: () => import("../../../app/game/around-the-clock/page"),
  },
  { path: "/game/shanghai", page: () => import("../../../app/game/shanghai/page") },
  { path: "/game-center", page: () => import("../../../app/game-center/page") },
  { path: "/dashboard", page: () => import("../../../app/dashboard/page") },
  { path: "/lobby", page: () => import("../../../app/lobby/page") },
  { path: "/career", page: () => import("../../../app/career/page") },
];

// The layout renders <html> and <body>, so each route must unmount before
// the next one mounts a document.
afterEach(() => {
  cleanup();
});

describe("route landmarks", () => {
  it("renders the primary navigation on every page", async () => {
    const { default: RootLayout } = await import("../../../app/layout");
    const { NAV_DESTINATIONS } = await import("../../../src/components/shell/navDestinations");

    const destinations = NAV_DESTINATIONS.map((destination) => destination.href).sort();
    const navigationOn: string[][] = [];

    for (const route of ROUTES) {
      currentPath.value = route.path;
      const { default: Page } = await route.page();

      const { container, unmount } = render(
        <RootLayout>
          <Page />
        </RootLayout>,
      );

      const navs = container.querySelectorAll('nav[aria-label="Primary"]');
      expect(navs.length, `${route.path} must render the primary navigation`).toBeGreaterThan(0);

      // The navigation is identical on every page: the same destinations, in
      // the same order, whichever of the two navs is looked at. The desktop
      // row reaches home through the wordmark, the tab bar through its own
      // Home tab, so the destinations are checked across the navs together.
      const links = [...container.querySelectorAll('nav[aria-label="Primary"] a[href]')].map(
        (link) => link.getAttribute("href") ?? "",
      );
      for (const href of destinations) {
        expect(links, `${route.path} must link to ${href}`).toContain(href);
      }

      navigationOn.push([...links].sort());

      unmount();
    }

    // Every page offers the same navigation.
    for (const links of navigationOn) {
      expect(links).toEqual(navigationOn[0]);
    }
  });

  it("renders exactly one main landmark on every route", async () => {
    const { default: RootLayout } = await import("../../../app/layout");

    for (const route of ROUTES) {
      currentPath.value = route.path;
      const { default: Page } = await route.page();

      const { container, unmount } = render(
        <RootLayout>
          <Page />
        </RootLayout>,
      );

      const mains = container.querySelectorAll("main");
      expect(mains.length, `${route.path} must render exactly one main landmark`).toBe(1);
      expect(mains[0]?.id, `${route.path} main landmark must be the skip link target`).toBe("main");

      // The shell owns the footer landmark, so every route has exactly one.
      const footers = container.querySelectorAll("footer");
      expect(footers.length, `${route.path} must render exactly one footer landmark`).toBe(1);

      unmount();
    }
  });
});

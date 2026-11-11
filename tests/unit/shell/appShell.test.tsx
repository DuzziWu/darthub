// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

/**
 * The shell's own behaviour: the navigation, the skip link, the space the
 * header and the mobile tab bar reserve, and the motion contract.
 *
 * `next/font/google` is a build-time transform, so it has no runtime
 * implementation outside the Next compiler; the shell's markup does not depend
 * on it, so a stub is enough here.
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

const ROOT = resolve(import.meta.dirname, "../../..");

const loadShell = async () => {
  const layout = await import("../../../app/layout");
  const destinations = await import("../../../src/components/shell/navDestinations");
  return { RootLayout: layout.default, NAV_DESTINATIONS: destinations.NAV_DESTINATIONS };
};

const classListOf = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

// The layout renders <html> and <body>, so each case must unmount before the
// next one mounts a document.
afterEach(() => {
  cleanup();
});

describe("app shell", () => {
  it("marks the current navigation item as current", async () => {
    const { RootLayout } = await loadShell();
    currentPath.value = "/lobby";

    const { container, unmount } = render(<RootLayout>content</RootLayout>);

    const marked = [...container.querySelectorAll('[aria-current="page"]')];
    expect(marked.length).toBeGreaterThan(0);
    for (const element of marked) {
      expect(element.getAttribute("href")).toBe("/lobby");
    }

    // The brass underline is a second, non-colour signal of the current item.
    const lobby = container.querySelector('a[href="/lobby"]');
    expect(lobby?.getAttribute("aria-current")).toBe("page");
    expect(classListOf(lobby!)).toContain("border-brass");

    unmount();
  });

  it("provides a working skip link as the first focusable element", async () => {
    const { RootLayout } = await loadShell();

    const { container } = render(<RootLayout>content</RootLayout>);

    const focusable = container.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0] as HTMLAnchorElement;

    expect(first.tagName).toBe("A");
    expect(first.getAttribute("href")).toBe("#main");
    expect(first.textContent).toBe("Skip to main content");

    // The target of the skip link is the shell's main landmark, and it is
    // focusable so that the focus really can move to it.
    const main = container.querySelector("#main");
    expect(main).not.toBeNull();
    expect(main?.getAttribute("tabindex")).toBe("-1");
  });

  it("moves focus to the main landmark when the skip link is activated", async () => {
    const { RootLayout } = await loadShell();

    const { container } = render(<RootLayout>content</RootLayout>);

    const skipLink = container.querySelector('a[href="#main"]') as HTMLAnchorElement;
    const main = container.querySelector("#main") as HTMLElement;

    fireEvent.click(skipLink);

    expect(document.activeElement).toBe(main);
  });

  it("reserves space so content is never hidden behind the header", async () => {
    const { RootLayout } = await loadShell();

    const { container } = render(<RootLayout>content</RootLayout>);

    const header = container.querySelector("header") as HTMLElement;
    const main = container.querySelector("main") as HTMLElement;

    // Sticky, not fixed: a sticky header keeps its place in the flow, so it
    // reserves its own space instead of overlapping the content.
    const headerClasses = classListOf(header);
    expect(headerClasses).toContain("sticky");
    expect(headerClasses).not.toContain("fixed");

    // The header is 56px tall (h-14 = 3.5rem), and the main landmark takes
    // the same scroll margin so a focused element clears it.
    expect(headerClasses).toContain("h-14");
    expect(classListOf(main)).toContain("scroll-mt-14");
  });

  it("reserves space for the mobile tab bar below 768 pixels", async () => {
    const { RootLayout } = await loadShell();

    const { container } = render(<RootLayout>content</RootLayout>);

    const mainClasses = classListOf(container.querySelector("main") as HTMLElement);

    // 64px of tab bar plus the safe-area inset, below 768px only.
    expect(mainClasses).toContain("pb-[calc(4rem+env(safe-area-inset-bottom))]");
    expect(mainClasses).toContain("md:pb-0");

    // The tab bar is the primary nav that also carries the home destination:
    // on the desktop header the wordmark is the home link instead.
    const tabBar = container.querySelector('nav[aria-label="Primary"]:has(a[href="/"])');
    expect(tabBar).not.toBeNull();
    const tabBarClasses = classListOf(tabBar as HTMLElement);
    expect(tabBarClasses).toContain("fixed");
    expect(tabBarClasses).toContain("bottom-0");
    expect(tabBarClasses).toContain("md:hidden");
    expect(tabBarClasses).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  it("renders a visible focus ring on every interactive element", async () => {
    const { RootLayout } = await loadShell();

    const { container } = render(<RootLayout>content</RootLayout>);

    const interactive = [...container.querySelectorAll("a[href], button")];
    expect(interactive.length).toBeGreaterThan(0);

    for (const element of interactive) {
      const classes = classListOf(element);
      expect(classes, element.outerHTML).toContain("focus-visible:outline-2");
      expect(classes, element.outerHTML).toContain("focus-visible:outline-offset-2");
      // Cream, never brass: brass on brass measures 1.0:1 and is invisible.
      expect(classes, element.outerHTML).toContain("focus-visible:outline-ink");
      expect(classes, element.outerHTML).not.toContain("outline-none");
    }
  });

  it("collapses motion under prefers-reduced-motion", async () => {
    const { RootLayout } = await loadShell();

    const { container } = render(<RootLayout>content</RootLayout>);

    // Every transition the shell declares is explicitly switched off when the
    // user asks for reduced motion.
    const transitioning = [...container.querySelectorAll("*")].filter((element) =>
      classListOf(element).some((name) => name.startsWith("transition-")),
    );
    expect(transitioning.length).toBeGreaterThan(0);
    for (const element of transitioning) {
      expect(classListOf(element), element.outerHTML).toContain("motion-reduce:transition-none");
    }

    // ...and the token layer collapses durations for everything else.
    const globals = await import("node:fs").then((fs) =>
      fs.readFileSync(resolve(ROOT, "app/globals.css"), "utf8"),
    );
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(globals).toMatch(/transition-duration: 0\.01ms !important/);
  });

  it("links only to routes that exist", async () => {
    const { RootLayout, NAV_DESTINATIONS } = await loadShell();

    const { container } = render(<RootLayout>content</RootLayout>);

    const hrefs = [...container.querySelectorAll("a[href]")].map((element) =>
      element.getAttribute("href"),
    );
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      if (href === "#main") continue;

      const routeFile = href === "/" ? "app/page.tsx" : `app${href}/page.tsx`;
      expect(existsSync(resolve(ROOT, routeFile)), `${href} has no route`).toBe(true);
    }

    // Every destination of the navigation is a real route.
    for (const destination of NAV_DESTINATIONS) {
      const routeFile =
        destination.href === "/" ? "app/page.tsx" : `app${destination.href}/page.tsx`;
      expect(existsSync(resolve(ROOT, routeFile)), `${destination.href} has no route`).toBe(true);
    }
  });
});

// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createQuestLoaderService } from "@/career/questLoader";

/**
 * The four hub pages the design system brought into the token layer: the
 * home route, the dashboard, the lobby and the career page.
 *
 * These tests assert the *contract* of the new design — the shell, the token
 * layer, the honest empty state, one primary action and the narrow-screen
 * layout — rather than a recorded snapshot of the markup.
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
  { path: "/dashboard", page: () => import("../../../app/dashboard/page") },
  { path: "/lobby", page: () => import("../../../app/lobby/page") },
  { path: "/career", page: () => import("../../../app/career/page") },
];

const PAGE_FILES = [
  join("app", "page.tsx"),
  join("app", "dashboard", "page.tsx"),
  join("app", "lobby", "page.tsx"),
  join("app", "career", "page.tsx"),
];

const sourceOf = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

/** The class list of an element, split into its individual utilities. */
const classListOf = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

/** Renders one route inside the app shell. */
async function renderInShell(path: string) {
  const { default: RootLayout } = await import("../../../app/layout");
  const route = ROUTES.find((candidate) => candidate.path === path);
  if (route === undefined) {
    throw new Error(`Unknown route ${path}`);
  }
  currentPath.value = path;
  const { default: Page } = await route.page();
  return render(
    <RootLayout>
      <Page />
    </RootLayout>,
  );
}

afterEach(() => {
  cleanup();
});

describe("the hub pages", () => {
  it("renders every route inside the app shell", async () => {
    const { default: RootLayout } = await import("../../../app/layout");
    expect(RootLayout).toBeDefined();

    for (const route of ROUTES) {
      const { container, unmount } = await renderInShell(route.path);
      const { default: Page } = await route.page();
      // The shell owns the landmarks: exactly one <main id="main">, one
      // footer and one primary navigation, whatever the page renders.
      const mains = container.querySelectorAll("main");
      expect(mains.length, `${route.path} must render exactly one main landmark`).toBe(1);
      expect(mains[0]?.id, `${route.path} main landmark must be the skip link target`).toBe("main");
      expect(container.querySelectorAll("footer").length).toBe(1);
      // The shell's own navigation: the desktop row and the mobile tab bar.
      expect(
        container.querySelectorAll('nav[aria-label="Primary"]').length,
        `${route.path} must render the shell's navigation`,
      ).toBeGreaterThan(0);

      // The page's own content sits inside the shell's main, and the page
      // adds no landmark of its own.
      const main = container.querySelector("main#main") as HTMLElement;
      const heading = main.querySelector("h1");
      expect(
        heading,
        `${route.path} must render its heading inside the shell's main`,
      ).not.toBeNull();
      expect(heading?.textContent?.trim().length).toBeGreaterThan(0);

      // The shell's banner header is the document's header, and the page's
      // own section headers are not.
      const banner = container.querySelector("header.sticky");
      expect(banner, `${route.path} must render the shell's header`).not.toBeNull();
      expect(main.contains(banner as Node)).toBe(false);

      // The page on its own renders no landmark: the shell owns them all.
      const bare = render(<Page />);
      expect(bare.container.querySelectorAll("main, footer, nav").length).toBe(0);
      bare.unmount();

      unmount();
    }
  });

  it("uses only semantic tokens and no palette utilities", () => {
    // A raw palette utility — bg-slate-800, text-blue-600 — is a banned
    // shortcut: the token layer is the contract.
    const palette =
      /(?:^|[\s:])(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|decoration|divide|accent|caret|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-|\/|$)/;

    for (const file of PAGE_FILES) {
      const source = sourceOf(file);

      for (const match of source.matchAll(/"([^"]*)"/g)) {
        const className = match[1] ?? "";
        expect(
          palette.test(className),
          `${file} must not use the palette utility "${className}"`,
        ).toBe(false);
      }

      // No inline colour: every colour comes from a token.
      expect(source, `${file} must not style colour inline`).not.toMatch(/style=\{\{/);
      expect(source, `${file} must not hard-code a hex colour`).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it("shows an empty state instead of invented data when there is no data", async () => {
    // The dashboard has no player behind it, so it shows the honest empty
    // state — never a placeholder number.
    const { default: DashboardPage } = await import("../../../app/dashboard/page");
    const dashboard = render(<DashboardPage />);
    expect(dashboard.container.textContent).toContain("No completed matches yet");
    expect(dashboard.container.textContent).toContain(
      "Finish a leg to see your rating, average and checkout rate here",
    );
    expect(dashboard.container.textContent).not.toContain("--");
    expect(dashboard.container.textContent).not.toMatch(/\b0\b/);
    dashboard.unmount();

    // The lobby has no rooms, so it shows the empty state rather than fake
    // rooms or a player count.
    const { default: LobbyPage } = await import("../../../app/lobby/page");
    const lobby = render(<LobbyPage />);
    expect(lobby.container.textContent).toContain("No public rooms right now");
    expect(lobby.container.textContent).not.toMatch(/\d+\/\d/);
    lobby.unmount();

    // The career page has no progress behind it, so the progress section is
    // an empty state — never a bar filled to zero per cent.
    const { default: CareerPage } = await import("../../../app/career/page");
    const career = render(<CareerPage />);
    expect(career.container.textContent).toContain("No active quest");
    expect(career.container.textContent).toContain("No progress yet");
    expect(career.container.textContent).not.toContain("0%");
    career.unmount();
  });

  it("offers one primary action per screen", async () => {
    for (const route of ROUTES) {
      const { default: Page } = await route.page();
      const { container, unmount } = render(<Page />);

      // The primary treatment is the brass fill: exactly one per screen —
      // except on the home route, whose rule sheet's rows are the actions,
      // so a primary button would compete with them (home.md §3).
      const primary = [...container.querySelectorAll("a, button")].filter((element) =>
        classListOf(element).includes("bg-brass"),
      );
      expect(primary.length, `${route.path} must offer exactly one primary action`).toBe(
        route.path === "/" ? 0 : 1,
      );

      // Every other action is subordinate: the raised, edge-bordered
      // secondary treatment, never a second brass button. The home route's
      // actions are the rule sheet's mode links, which are links and not
      // buttons — they carry the link treatment, not the button treatment.
      for (const action of container.querySelectorAll("a, button")) {
        const classes = classListOf(action);
        if (classes.includes("bg-brass")) {
          continue;
        }
        if (route.path === "/") {
          expect(classes, `${route.path} action must be a mode link`).toContain("font-display");
          continue;
        }
        expect(classes, `${route.path} secondary action must be a secondary`).toContain(
          "bg-raised",
        );
      }

      unmount();
    }
  });

  it("renders without a horizontal scrollbar at 390 pixels", async () => {
    for (const route of ROUTES) {
      const { default: Page } = await route.page();
      const { container, unmount } = render(<Page />);

      for (const element of container.querySelectorAll("*")) {
        const className = element.getAttribute("class") ?? "";
        expect(className, `${route.path} must not scroll sideways`).not.toMatch(
          /overflow-x-(auto|scroll)/,
        );
        expect(className, `${route.path} must not force a line break-free row`).not.toContain(
          "whitespace-nowrap",
        );
        for (const match of className.matchAll(/(?<![\w-])(?:min-)?w-\[(\d+)px\]/g)) {
          expect(Number(match[1]), `"${className}" must fit a 390px screen`).toBeLessThanOrEqual(
            390,
          );
        }
      }

      unmount();
    }
  });

  it("shows the career quests the loader returns, not names typed into the page", async () => {
    const loader = createQuestLoaderService();
    await loader.load();
    const quests = loader.getQuests();
    expect(quests.length).toBeGreaterThan(0);

    const { default: CareerPage } = await import("../../../app/career/page");
    const { container, unmount } = render(<CareerPage />);

    for (const quest of quests) {
      expect(container.textContent, `the page must show the quest "${quest.name}"`).toContain(
        quest.name,
      );
    }

    // The catalogue is read from the loader, so the page file names none of
    // the quests itself.
    const source = sourceOf(join("app", "career", "page.tsx"));
    for (const quest of quests) {
      expect(source, `the page must not hard-code the quest "${quest.name}"`).not.toContain(
        quest.name,
      );
    }

    unmount();
  });
});

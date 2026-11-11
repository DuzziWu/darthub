import type { Page } from "@playwright/test";

/**
 * The measurement helpers of the visual QC suite.
 *
 * Everything here measures the *rendered* page — computed styles, bounding
 * boxes and the document's own scroll metrics — because the criteria are
 * about pixels, not about the stylesheet.
 */

/** The three reference viewports of the design. */
export const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 800 },
  { width: 390, height: 844 },
] as const;

/** A surface: a route, and the steps that reach the state to be judged. */
export interface Surface {
  /** A stable name for the screenshot file and the report. */
  readonly name: string;
  /** The route to load. */
  readonly path: string;
  /** The steps that reach the state under judgement. */
  readonly enter?: (page: Page) => Promise<void>;
}

/** Fills the setup form and starts the match. */
export async function startMatch(page: Page, name = "Alice"): Promise<void> {
  await page.getByLabel("Player 1").fill(name);
  await page.getByRole("button", { name: "Start match" }).click();
  await page.getByRole("region", { name: "Dart pad" }).waitFor();
}

/** Throws one dart from the pad, so the sheet carries a visit. */
export async function throwFromPad(page: Page, sector = 20): Promise<void> {
  const pad = page.getByRole("region", { name: "Dart pad" });
  await pad
    .getByRole("button", { name: new RegExp(`\\b${sector},`) })
    .first()
    .click();
}

/**
 * The surfaces of the product.
 *
 * The hub pages, the match setup of every mode (a distinct surface from the
 * match itself) and the match in play.
 */
export const SURFACES: readonly Surface[] = [
  { name: "home", path: "/" },
  { name: "game-center", path: "/game-center" },
  { name: "lobby", path: "/lobby" },
  { name: "career", path: "/career" },
  { name: "dashboard", path: "/dashboard" },
  { name: "setup-501", path: "/game" },
  { name: "setup-301", path: "/game/301" },
  { name: "setup-cricket", path: "/game/cricket" },
  { name: "setup-atc", path: "/game/around-the-clock" },
  { name: "setup-shanghai", path: "/game/shanghai" },
  {
    name: "match-501",
    path: "/game",
    enter: async (page) => {
      await startMatch(page);
      await throwFromPad(page);
    },
  },
  {
    name: "match-301",
    path: "/game/301",
    enter: async (page) => {
      await startMatch(page);
      await throwFromPad(page);
    },
  },
  {
    name: "match-cricket",
    path: "/game/cricket",
    enter: async (page) => {
      await startMatch(page);
      await throwFromPad(page);
    },
  },
  {
    name: "match-atc",
    path: "/game/around-the-clock",
    enter: async (page) => {
      await startMatch(page);
      await throwFromPad(page);
    },
  },
  {
    name: "match-shanghai",
    path: "/game/shanghai",
    enter: async (page) => {
      await startMatch(page);
      await throwFromPad(page);
    },
  },
];

/** A measured target that fell under the house floor. */
export interface UndersizedTarget {
  /** A description of the element. */
  readonly what: string;
  /** The measured width and height, in CSS pixels. */
  readonly width: number;
  readonly height: number;
}

/**
 * Every interactive element of the page, with its measured box.
 *
 * The board's painted beds are not elements — they are SVG paths — and the
 * board's keyboard grid is visually hidden, so neither is a pointer target
 * here. The board's *own* deviation is asserted separately, in the board's
 * keyboard-route test.
 */
export async function measureTargets(page: Page): Promise<UndersizedTarget[]> {
  return page.evaluate(() => {
    const SELECTOR = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      "[role='button']",
      "[role='radio']",
      "[role='link']",
      "[role='checkbox']",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const offenders: { what: string; width: number; height: number }[] = [];

    for (const element of Array.from(document.querySelectorAll(SELECTOR))) {
      const html = element as HTMLElement;

      // A visually hidden element is not a pointer target: it is the
      // keyboard route, and its size is deliberately not its own.
      if (html.closest(".sr-only")) continue;

      const style = getComputedStyle(html);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (style.pointerEvents === "none") continue;
      if (html.getAttribute("aria-hidden") === "true") continue;

      const rect = html.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      if (rect.width < 44 || rect.height < 44) {
        const label =
          html.getAttribute("aria-label") ??
          html.textContent?.trim().slice(0, 40) ??
          html.tagName.toLowerCase();
        offenders.push({
          what: `${html.tagName.toLowerCase()}${html.className ? `.${String(html.className).split(/\s+/).slice(0, 2).join(".")}` : ""} "${label}"`,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        });
      }
    }

    return offenders;
  });
}

/** A text element whose measured contrast fell below the floor. */
export interface LowContrast {
  /** A description of the element. */
  readonly what: string;
  /** The measured ratio, rounded to two decimals. */
  readonly ratio: number;
  /** The resolved foreground and background. */
  readonly foreground: string;
  readonly background: string;
  /** The computed font size, in CSS pixels. */
  readonly fontSize: number;
  /** True when the text is large enough for the 3:1 threshold. */
  readonly large: boolean;
}

/**
 * The measured contrast of every piece of visible text.
 *
 * The colours are the *computed* ones, with any alpha composited over the
 * parent's background, so the pair is the one the user actually sees.
 */
export async function measureContrast(page: Page): Promise<LowContrast[]> {
  return page.evaluate(() => {
    const parse = (value: string): { r: number; g: number; b: number; a: number } => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return { r: 0, g: 0, b: 0, a: 0 };
      const parts = match[1]!
        .split(/[,/\s]+/)
        .filter(Boolean)
        .map(Number);
      return {
        r: parts[0] ?? 0,
        g: parts[1] ?? 0,
        b: parts[2] ?? 0,
        a: parts.length > 3 ? (parts[3] ?? 1) : 1,
      };
    };

    const over = (
      top: { r: number; g: number; b: number; a: number },
      bottom: { r: number; g: number; b: number; a: number },
    ): { r: number; g: number; b: number; a: number } => {
      const a = top.a + bottom.a * (1 - top.a);
      if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
        g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
        b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
        a,
      };
    };

    const luminance = (colour: { r: number; g: number; b: number }): number => {
      const channel = (value: number) => {
        const srgb = value / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
    };

    /** The background the element's own text sits on, resolved up the tree. */
    const backgroundOf = (element: Element): { r: number; g: number; b: number; a: number } => {
      let node: Element | null = element;
      const stack: { r: number; g: number; b: number; a: number }[] = [];
      while (node) {
        const colour = parse(getComputedStyle(node).backgroundColor);
        if (colour.a > 0) {
          stack.push(colour);
          if (colour.a === 1) break;
        }
        node = node.parentElement;
      }
      let result = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of stack.reverse()) result = over(layer, result);
      return result;
    };

    const ratio = (
      a: { r: number; g: number; b: number },
      b: { r: number; g: number; b: number },
    ) => {
      const first = luminance(a);
      const second = luminance(b);
      const light = Math.max(first, second);
      const dark = Math.min(first, second);
      return (light + 0.05) / (dark + 0.05);
    };

    const offenders: {
      what: string;
      ratio: number;
      foreground: string;
      background: string;
      fontSize: number;
      large: boolean;
    }[] = [];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? "";
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      // The board paints its own numerals; they are not UI text.
      if (parent.closest("svg")) continue;
      if (parent.closest(".sr-only")) continue;
      if (seen.has(parent)) continue;
      seen.add(parent);

      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (Number(style.opacity) === 0) continue;

      const background = backgroundOf(parent);
      if (background.a === 0) continue;
      const foreground = over(parse(style.color), background);
      const measured = ratio(foreground, background);

      const fontSize = Number.parseFloat(style.fontSize);
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
      const floor = large ? 3 : 4.5;

      if (measured < floor) {
        offenders.push({
          what: `${parent.tagName.toLowerCase()}.${String(parent.className).split(/\s+/).slice(0, 3).join(".")} "${text.slice(0, 40)}"`,
          ratio: Math.round(measured * 100) / 100,
          foreground: `rgb(${Math.round(foreground.r)}, ${Math.round(foreground.g)}, ${Math.round(foreground.b)})`,
          background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
          fontSize: Math.round(fontSize * 10) / 10,
          large,
        });
      }
    }

    return offenders;
  });
}

/** The document's own horizontal overflow, if any. */
export async function measureOverflow(page: Page): Promise<{
  scrollWidth: number;
  clientWidth: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
}> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
}

/** The elements that overflow the viewport horizontally. */
export async function findOverflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const element of Array.from(document.querySelectorAll("body *"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.right > limit + 1) {
        const style = getComputedStyle(element);
        if (style.position === "fixed") continue;
        offenders.push(
          `${element.tagName.toLowerCase()}.${String(element.className).split(/\s+/).slice(0, 3).join(".")} right=${Math.round(rect.right)}`,
        );
      }
    }
    return offenders.slice(0, 10);
  });
}

/** An element whose transition or animation did not collapse. */
export interface UncollapsedMotion {
  /** A description of the element. */
  readonly what: string;
  /** The duration that was measured. */
  readonly duration: string;
}

/**
 * The motion that survives `prefers-reduced-motion: reduce`.
 *
 * The threshold is the design system's own: `DESIGN.md` §6 collapses every
 * duration to 0.01 ms and every loop to one.
 */
export async function measureMotion(page: Page): Promise<UncollapsedMotion[]> {
  return page.evaluate(() => {
    const THRESHOLD_SECONDS = 0.00001; // 0.01 ms
    const offenders: { what: string; duration: string }[] = [];

    for (const element of Array.from(document.querySelectorAll("body *"))) {
      if (element.closest(".sr-only")) continue;
      const style = getComputedStyle(element);

      const transition = style.transitionDuration.split(",").map((value) => parseFloat(value) || 0);
      const animation = style.animationDuration.split(",").map((value) => parseFloat(value) || 0);
      const iterations = style.animationIterationCount
        .split(",")
        .map((value) => (value.trim() === "infinite" ? Infinity : parseFloat(value) || 0));

      const longestTransition = Math.max(0, ...transition);
      const longestAnimation = Math.max(0, ...animation);
      const loops = iterations.some((value) => value > 1);

      if (longestTransition > THRESHOLD_SECONDS || longestAnimation > THRESHOLD_SECONDS || loops) {
        offenders.push({
          what: `${element.tagName.toLowerCase()}.${String(element.className).split(/\s+/).slice(0, 3).join(".")}`,
          duration: `transition ${style.transitionDuration} / animation ${style.animationDuration}`,
        });
      }
    }

    return offenders;
  });
}

/** An interactive element that showed no focus ring when focused. */
export interface UnringedFocus {
  /** A description of the element. */
  readonly what: string;
  /** The outline it did show. */
  readonly outline: string;
}

/**
 * The focus ring of every interactive element, measured by keyboard.
 *
 * `:focus-visible` only matches a *keyboard* focus, so a scripted
 * `element.focus()` would report no ring on a control that has a perfectly
 * good one. The page is therefore walked with Tab, and the ring is read at
 * each stop — the same path a keyboard user takes.
 */
export async function measureFocusRings(page: Page): Promise<UnringedFocus[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });

  const unringed: UnringedFocus[] = [];
  const seen = new Set<string>();

  for (let step = 0; step < 120; step += 1) {
    await page.keyboard.press("Tab");

    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      // The board's keyboard grid is a roving-tabindex grid inside a
      // visually-hidden container: the focus indicator is painted on the
      // board itself, not as an outline on the button.
      if (element.closest(".sr-only")) return null;
      // The development overlay is the framework's, not the product's.
      if (element.closest("nextjs-portal")) return null;

      const style = getComputedStyle(element);
      return {
        key: `${element.tagName}:${element.getAttribute("aria-label") ?? element.textContent ?? ""}`,
        what: `${element.tagName.toLowerCase()}.${String(element.className).split(/\s+/).slice(0, 4).join(".")} "${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 30)}"`,
        outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
        width: parseFloat(style.outlineWidth) || 0,
        style: style.outlineStyle,
        matchesFocusVisible: element.matches(":focus-visible"),
      };
    });

    if (!stop) continue;
    if (seen.has(stop.key)) continue;
    seen.add(stop.key);

    const hasRing = stop.style !== "none" && stop.style !== "auto" && stop.width >= 2;
    if (!hasRing) {
      unringed.push({ what: stop.what, outline: stop.outline });
    }
  }

  return unringed;
}

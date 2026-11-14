#!/usr/bin/env node
/**
 * Checks that a build serves its assets under the path prefix it is published
 * under.
 *
 * The app is published behind a proxy that mounts it at a prefix, as Tailscale
 * Serve does with `tailscale serve --set-path=/darthub`. The proxy strips the
 * prefix from the path before it forwards the request, but the browser
 * resolves the stylesheet and the client bundle against the URL it was given
 * and therefore asks for `/darthub/_next/...`.
 *
 * A build without `BASE_PATH` hands out asset URLs without the prefix. Those
 * requests find no mount and answer 404: the HTML arrives, the page is
 * unstyled, the client bundle never hydrates, and both navigation bars are
 * visible at once because the CSS that hides one of them never loaded.
 *
 * Nothing in the build fails on that — the build succeeds and the server
 * starts happily. This script is the gate that fails instead: it reads the
 * built HTML and checks that the asset URLs carry the prefix the app is
 * published under.
 *
 * The prefix comes from `BASE_PATH` — the same variable the build reads — so
 * the check and the build cannot disagree about it.
 */

import { readFile, access } from "node:fs/promises";
import { join } from "node:path";

/** The prefix the app is published under. Empty means "served at the root". */
const basePath = (process.env.BASE_PATH ?? "").trim();

/** Where the build wrote its output. */
const distDir = (process.env.NEXT_DIST_DIR ?? "").trim() || ".next";

/** The route whose HTML carries the asset URLs. */
const PROBE_ROUTE = "/game";

/**
 * The paths Next.js renders for a route: the HTML file and its RSC payload.
 * The first one that exists is the one to read.
 */
const candidatePaths = (route) => [
  join(distDir, "server", `${route}.html`),
  join(distDir, "server", `${route}.rsc`),
  join(distDir, "server", "app", `${route}.html`),
];

/**
 * The asset URLs a rendered page references.
 *
 * Only `/_next/` paths are of interest: they are the ones the proxy has to
 * serve under the prefix. A page that references none of them references no
 * stylesheet and no client bundle, which is itself a broken build.
 */
const assetUrls = (html) => html.match(/(?:href|src)="(\/[^"]*_next\/[^"]*)"/g) ?? [];

/** The first candidate path that exists, or null. */
const firstExisting = async (paths) => {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Not this one — try the next.
    }
  }
  return null;
};

/**
 * Reports the outcome and sets the exit code.
 *
 * A build without the prefix is only a defect when the app is published under
 * a prefix, so the root build passes: the check tells you the two facts, and
 * it fails only when they contradict each other.
 */
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};

const pass = (message) => {
  console.log(`✓ ${message}`);
};

const route = PROBE_ROUTE.replace(/^\//, "").replace(/\/$/, "");
const probePath = await firstExisting(candidatePaths(route));

if (!probePath) {
  fail(
    `No rendered page for ${PROBE_ROUTE} under ${distDir}. ` +
      `Build the app first (npm run build), or set NEXT_DIST_DIR to the build directory.`,
  );
} else {
  const html = await readFile(probePath, "utf8");
  const urls = assetUrls(html);

  if (urls.length === 0) {
    fail(
      `${probePath} references no /_next/ asset. ` +
        `A page without a stylesheet and a client bundle is unstyled and inert.`,
    );
  } else {
    const expectedPrefix = basePath ? `${basePath}/_next/` : "/_next/";
    const unprefixed = urls.filter((url) => !url.includes(expectedPrefix));

    if (basePath && unprefixed.length > 0) {
      fail(
        `The build is published under the prefix "${basePath}", but ${unprefixed.length} of ` +
          `${urls.length} asset URLs carry no prefix:\n` +
          unprefixed
            .slice(0, 5)
            .map((url) => `    ${url}`)
            .join("\n") +
          `\n  The proxy strips the prefix from the path, so those requests find no mount ` +
          `and answer 404: the page arrives unstyled and unhydrated.\n` +
          `  Build with BASE_PATH=${basePath} (npm run build:prefixed).`,
      );
    } else if (!basePath && urls.some((url) => url.includes("/darthub/_next/"))) {
      fail(
        `The build carries a "/darthub" asset prefix, but BASE_PATH is not set. ` +
          `The prefix in the build and the prefix in the proxy's mount point must be the same.`,
      );
    } else {
      pass(
        `${urls.length} asset URLs carry the expected prefix "${expectedPrefix}" ` +
          `(checked ${probePath}).`,
      );
    }
  }
}

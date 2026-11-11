"use client";

/**
 * The skip link — the first focusable element in the document.
 *
 * Visually hidden until it takes focus, then a brass bar at the top-left. It
 * targets the shell's `<main id="main">`, which carries `tabIndex={-1}` so
 * that focusing it is possible.
 *
 * The fragment navigation scrolls the page on its own; focus has to be moved
 * by hand, and that is what this handler does. Without it the next Tab press
 * would continue from the header instead of from the content.
 */
export function SkipLink({
  targetId = "main",
  label = "Skip to main content",
}: {
  targetId?: string;
  label?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      onClick={() => {
        document.getElementById(targetId)?.focus();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-0 focus:top-0 focus:z-60 focus:flex focus:min-h-11 focus:items-center focus:bg-brass focus:px-md focus:font-label focus:text-board focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {label}
    </a>
  );
}

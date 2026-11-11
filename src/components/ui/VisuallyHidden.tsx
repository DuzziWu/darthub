import type { ReactNode } from "react";

/**
 * Text that is available to assistive technology but not shown on screen.
 *
 * Used where a control needs a richer accessible name than its visible label
 * carries — the wordmark, for instance, which reads "DartHub" but goes home.
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

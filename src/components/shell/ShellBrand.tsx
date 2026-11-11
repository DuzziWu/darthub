"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";

/**
 * The wordmark — the home link.
 *
 * The home route is reached through the wordmark rather than through a nav
 * item, so the wordmark carries the current-location marker itself.
 */
export function ShellBrand() {
  const pathname = usePathname();
  const isCurrent = pathname === "/";

  return (
    <Link
      href="/"
      aria-current={isCurrent ? "page" : undefined}
      className="flex min-h-11 items-center font-display text-title font-bold uppercase tracking-[0.08em] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="text-brass">D</span>ARTHUB
      <VisuallyHidden> home</VisuallyHidden>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_DESTINATIONS } from "./navDestinations";

/**
 * The house focus ring: 2px of cream, 2px clear of the element.
 *
 * Cream, never brass — brass on brass measures 1.0:1 and is invisible.
 */
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * The primary navigation of the header.
 *
 * Four destinations: the home route is reached through the wordmark, which
 * carries its own current-location marker.
 *
 * The current location is marked with `aria-current="page"`, a brass underline
 * and a heavier weight — never colour alone.
 */
export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-stretch gap-lg font-label">
        {NAV_DESTINATIONS.filter((destination) => destination.href !== "/").map((destination) => {
          const isCurrent = pathname === destination.href;
          const Icon = destination.icon;

          return (
            <li key={destination.href}>
              <Link
                href={destination.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex min-h-11 items-center gap-md border-b-2 px-md text-label transition-colors duration-fast ease-out motion-reduce:transition-none ${
                  isCurrent
                    ? "border-brass font-semibold text-ink"
                    : "border-transparent font-medium text-ink-muted hover:text-ink"
                } ${FOCUS_RING}`}
              >
                <Icon
                  aria-hidden="true"
                  className={`size-5 shrink-0 ${isCurrent ? "text-brass" : "text-ink-muted"}`}
                />
                {destination.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The bottom tab bar — the primary navigation below 768 px.
 *
 * Five destinations, each an icon over a label that is always visible, so no
 * tab needs an accessible name of its own. The active tab's icon is brass.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-board pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex h-16 items-stretch font-label">
        {NAV_DESTINATIONS.map((destination) => {
          const isCurrent = pathname === destination.href;
          const Icon = destination.icon;

          return (
            <li key={destination.href} className="flex-1">
              <Link
                href={destination.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex h-full w-full flex-col items-center justify-center gap-xs px-xs py-xs transition-colors duration-fast ease-out motion-reduce:transition-none ${
                  isCurrent ? "font-semibold text-ink" : "font-medium text-ink-muted"
                } ${FOCUS_RING}`}
              >
                <Icon
                  aria-hidden="true"
                  className={`size-5 shrink-0 ${isCurrent ? "text-brass" : "text-ink-muted"}`}
                />
                <span className="text-caption">{destination.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

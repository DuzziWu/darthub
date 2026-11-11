import { House, LayoutDashboard, Map as MapIcon, Target, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavDestination {
  /** The route this destination leads to. Every one of them must exist. */
  readonly href: string;
  /** The visible label. Always present — no icon-only destination. */
  readonly label: string;
  /** The Lucide icon beside the label. Decorative: the label carries the name. */
  readonly icon: LucideIcon;
}

/**
 * The five destinations of the primary navigation.
 *
 * On the desktop header the wordmark is the home link, so the header's own
 * row carries the other four; the mobile tab bar carries all five.
 */
export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/game-center", label: "Game Center", icon: Target },
  { href: "/lobby", label: "Lobby", icon: Users },
  { href: "/career", label: "Career", icon: MapIcon },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

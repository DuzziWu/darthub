import { ShellBrand } from "./ShellBrand";
import { MobileTabBar, PrimaryNav } from "./ShellNav";

/**
 * The site header.
 *
 * Sticky rather than fixed: a sticky header keeps its place in the flow, so
 * it reserves its own space and no content can end up behind it. The wordmark
 * sits left, the navigation right.
 */
export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-50 h-14 border-b border-rule bg-board">
        <div className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between gap-md px-4 md:px-8">
          <ShellBrand />
          <PrimaryNav />
        </div>
      </header>
      <MobileTabBar />
    </>
  );
}

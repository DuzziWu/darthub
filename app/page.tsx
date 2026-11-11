import { RuleSheet } from "@/components/game/RuleSheet";

/**
 * The home route: the session surface.
 *
 * With nothing in progress there is no match to resume, so the page is a
 * compact entry point: the same rule sheet the Game Center shows, at a
 * narrower measure. It is the shared component, not a second copy of the
 * rules — so the two pages can never disagree.
 */
export default function Home() {
  return (
    <div className="w-full max-w-[720px] space-y-2xl py-2xl">
      <div className="space-y-xs">
        <h1 className="font-display text-display font-bold text-ink">DartHub</h1>
        <p className="font-body text-body text-ink-muted">
          Server-authoritative multiplayer darts.
        </p>
      </div>

      <RuleSheet />
    </div>
  );
}

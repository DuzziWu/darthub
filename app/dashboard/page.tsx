import Link from "next/link";
import { withBasePath } from "@/lib/basePath";

/**
 * The dashboard: the player's own record.
 *
 * There is no signed-in player behind this page yet, so there is no rating,
 * level, XP or friend count to show. The page says so honestly — one empty
 * state with the action that would fill it — rather than four `--` tiles
 * standing in for numbers that do not exist.
 */

/** The primary action: the brass fill, 44px tall, cream label. */
const PRIMARY_ACTION =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sm bg-brass px-xl font-label text-board transition-colors duration-fast ease-out hover:bg-brass-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none";

export default function DashboardPage() {
  return (
    <div className="w-full max-w-[720px] space-y-2xl py-2xl">
      <div className="space-y-xs">
        <h1 className="font-display text-display font-bold text-ink">Dashboard</h1>
      </div>

      <section className="space-y-xl">
        <h2 className="font-display text-title font-semibold text-ink">
          No completed matches yet.
        </h2>
        <p className="font-body text-body text-ink-muted">
          Finish a leg to see your rating, average and checkout rate here.
        </p>
        <Link href={withBasePath("/game-center")} className={PRIMARY_ACTION}>
          Play a match
        </Link>
      </section>
    </div>
  );
}

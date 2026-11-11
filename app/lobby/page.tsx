/**
 * The lobby: the multiplayer entry point.
 *
 * The room list is real server state, and there is no room to show — the
 * multiplayer backend is not part of this plan. The page says so with the
 * empty state the design specifies, rather than inventing rooms, hosts or
 * player counts.
 */

/** The primary action: the brass fill, 44px tall, cream label. */
const PRIMARY_ACTION =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sm bg-brass px-xl font-label text-board transition-colors duration-fast ease-out hover:bg-brass-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none";

/** The secondary action: raised, edge-bordered, subordinate to the primary. */
const SECONDARY_ACTION =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sm border border-edge bg-raised px-xl font-label text-ink transition-colors duration-fast ease-out hover:border-brass-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none";

/** A section label: the caption face, uppercase, in the faint ink. */
const SECTION_LABEL = "font-caption text-caption uppercase tracking-[0.04em] text-ink-faint";

export default function LobbyPage() {
  return (
    <div className="w-full max-w-[900px] space-y-3xl py-2xl">
      <div className="flex flex-wrap items-center justify-between gap-xl">
        <h1 className="font-display text-display font-bold text-ink">Lobby</h1>

        <div className="flex items-center gap-lg">
          <span className={SECTION_LABEL}>Matchmaking</span>
          <button type="button" className={PRIMARY_ACTION}>
            Find Match
          </button>
        </div>
      </div>

      <section className="space-y-xl">
        <h2 className={SECTION_LABEL}>Public Rooms</h2>
        <div className="space-y-md border-t border-rule pt-2xl">
          <p className="font-display text-title font-semibold text-ink">
            No public rooms right now.
          </p>
          <p className="font-body text-body text-ink-muted">
            Start a private room and invite someone, or find a match.
          </p>
        </div>
      </section>

      <section className="space-y-xl">
        {/* The private room is a row: its label on the left, its action beside it. */}
        <div className="flex items-center justify-between gap-lg border-t border-rule pt-2xl">
          <h2 className={SECTION_LABEL}>Private Room</h2>
          <button type="button" className={SECONDARY_ACTION}>
            Create Room
          </button>
        </div>
      </section>
    </div>
  );
}

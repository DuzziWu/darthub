import Link from "next/link";
import { withBasePath } from "@/lib/basePath";
import { createQuestLoaderService } from "@/career/questLoader";

/**
 * The career page: the quest surface.
 *
 * The quest catalogue is real content — six definitions under
 * `src/career/quests` — so it is read through the loader that validates
 * them, never reconstructed from the file names. The player's progress is a
 * separate matter: there is no signed-in player behind this page yet, so the
 * quest and progress sections show their empty states rather than an
 * invented percentage or an unlocked quest nobody has earned.
 */

/** The primary action: the brass fill, 44px tall, cream label. */
const PRIMARY_ACTION =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sm bg-brass px-xl font-label text-board transition-colors duration-fast ease-out hover:bg-brass-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none";

/** A section label: the caption face, uppercase, in the faint ink. */
const SECTION_LABEL = "font-caption text-caption uppercase tracking-[0.04em] text-ink-faint";

/**
 * The quest catalogue, loaded and validated once for the module.
 *
 * The loader reads the definitions from disk and validates every one of them
 * against the quest schema, so a malformed quest file fails the page rather
 * than rendering as a broken list.
 */
const questLoader = createQuestLoaderService();
await questLoader.load();
const quests = questLoader.getQuests();

export default function CareerPage() {
  return (
    <div className="w-full max-w-[720px] space-y-3xl py-2xl">
      <div className="space-y-xs">
        <h1 className="font-display text-display font-bold text-ink">Career Mode</h1>
      </div>

      <section className="space-y-xl">
        <h2 className={SECTION_LABEL}>Current Quest</h2>
        <div className="space-y-md border-t border-rule pt-2xl">
          <p className="font-display text-title font-semibold text-ink">No active quest.</p>
          <p className="max-w-[70ch] font-body text-body text-ink-muted">
            Finish a match to unlock your first training quest.
          </p>
          <Link href={withBasePath("/game-center")} className={PRIMARY_ACTION}>
            Play a match
          </Link>
        </div>
      </section>

      <section className="space-y-xl">
        <h2 className={SECTION_LABEL}>Progress</h2>
        <div className="space-y-md border-t border-rule pt-2xl">
          <p className="font-display text-title font-semibold text-ink">No progress yet.</p>
          <p className="max-w-[70ch] font-body text-body text-ink-muted">
            Complete a training lesson to see your progress here.
          </p>
        </div>
      </section>

      <section className="space-y-xl">
        <h2 className={SECTION_LABEL}>Training</h2>
        <ul className="border-t border-rule">
          {quests.map((quest) => (
            <li key={quest.id} className="space-y-xs border-b border-rule py-lg">
              <p className="font-display text-heading font-semibold text-ink">{quest.name}</p>
              <p className="max-w-[70ch] font-body text-body text-ink-muted">{quest.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

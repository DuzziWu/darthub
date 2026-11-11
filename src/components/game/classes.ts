/**
 * The shared control classes of the play surface.
 *
 * Every control in the shared game components carries the same focus ring
 * and the same disabled treatment, so the states cannot drift apart between
 * components.
 */

/**
 * The focus ring: 2px cream, 2px offset.
 *
 * Cream, never brass — brass on brass is 1.0:1 and invisible. The ring is
 * never removed.
 */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The 44px house floor for every target. */
export const TARGET_SIZE = "h-11 min-w-11";

/** Disabled controls look disabled and cannot be clicked. */
export const DISABLED = "disabled:opacity-45 disabled:cursor-not-allowed";

/**
 * The secondary button: the strip's own actions, in every mode.
 *
 * One class for all five modes, so the strip cannot drift apart between
 * them.
 */
export const SECONDARY_BUTTON = `${TARGET_SIZE} rounded-sm border border-edge bg-raised px-md font-label text-label text-ink transition-colors duration-fast hover:border-brass-deep hover:bg-board ${FOCUS_RING}`;

/**
 * The match strip: the band across the top of a match.
 *
 * The five modes share one strip, so its type and its chrome are declared
 * once here rather than in each match view. From the md breakpoint up it is
 * sticky directly below the app header, so the mode and the visit stay on
 * screen while the sheet is read; on a phone it is compact and scrolls away.
 */
export const MATCH_STRIP =
  "flex min-h-14 flex-wrap items-center gap-md border-b border-rule bg-surface px-md py-sm md:sticky md:top-14 md:z-30";

/** The mode's name in the strip. */
export const MATCH_TITLE = "font-display text-heading text-ink";

/** The mode's live state in the strip, e.g. "0 / 7 closed". */
export const MATCH_BADGE =
  "rounded-xs border border-edge px-xs font-caption text-caption uppercase tracking-[0.04em] text-brass";

/** The board the darts come from, e.g. "Virtual Board". */
export const MATCH_SOURCE = "font-caption text-caption uppercase tracking-[0.04em] text-ink-faint";

/**
 * A radio whose *hit area* is 44 px while its *mark* stays 16 px.
 *
 * A native radio paints at the size of its own box, so a 44 px radio would
 * be a 44 px circle. The input is therefore stretched over a 44 px cell and
 * made transparent, and a sibling draws the mark: hollow when unselected,
 * filled when selected — a shape difference, never colour alone.
 *
 * The input is transparent rather than `opacity-0`, so its own focus ring
 * stays visible: the ring is on the control the user is actually operating.
 */
export const RADIO_CELL = "relative grid h-11 w-11 shrink-0 place-items-center";

/** The transparent, full-cell radio input. */
export const RADIO_INPUT =
  "peer absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The visible mark of a radio. */
export const RADIO_MARK =
  "pointer-events-none h-4 w-4 rounded-full border border-edge bg-transparent peer-checked:border-brass peer-checked:bg-brass";

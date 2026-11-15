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
 * once here rather than in each match view. It is sticky directly below the
 * app header at every width, so the mode and the input mode stay on screen
 * while the score sheet is read.
 */
export const MATCH_STRIP =
  "sticky top-14 z-30 flex min-h-14 items-center gap-md border-b border-rule bg-surface px-md py-sm";

/**
 * The player overview: the ruled rows above the input.
 *
 * A raised surface like the pad beside it, so the overview and the input
 * read as one family. It carries no card per player — a row is a row.
 */
export const SCOREBOARD_SURFACE = "rounded-md border border-rule bg-surface";

/**
 * The active player's row: a 2 px brass rail on the left.
 *
 * The rail is one of two markers, never the only one: the row also names
 * the player as the one on turn, so the state survives without colour.
 */
export const SCOREBOARD_ACTIVE_RAIL = "border-l-2 border-l-brass";

/**
 * The header row of the overview: the mode's own facts and the caption.
 *
 * The caption sits over the score column, so its right edge is the score's
 * right edge. It is the one place a mode may differ in wording.
 */
export const SCOREBOARD_HEADER =
  "flex items-center gap-md border-b border-rule px-md py-xs font-caption text-caption uppercase tracking-[0.04em] text-ink-faint";

/**
 * The throw tracker: the slots of the turn in progress, beside the undo.
 *
 * It sits in the input area rather than in the strip: the mistake happens
 * at the pad or at the board, and the undo has to be within reach of it.
 */
export const VISIT_TRACKER =
  "flex flex-wrap items-center gap-md rounded-md border border-rule bg-surface px-md py-sm";

/**
 * The slot of a dart that has not been thrown yet.
 *
 * An outlined placeholder, never a disabled button: there is nothing to
 * press, and a dead control on a phone is a dead target.
 */
export const VISIT_SLOT_EMPTY =
  "flex h-11 min-w-11 items-center justify-center rounded-sm border border-dashed border-edge px-sm font-mono text-caption text-ink-faint";

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

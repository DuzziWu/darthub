import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { BoardSourceId } from "@/board";
import type { ArmedSegment } from "@/components/board";
import type { InputMode } from "@/components/game/InputModeSwitch";
import type { OutRuleId, ThrowSegment } from "@/game-engine/types";

/**
 * The band the numeral route scores. Shared with the board, owned by the
 * match view: the pad and the board are two views of one piece of state.
 */
export type { ArmedSegment };

export interface ThrowInputPadProps {
  /** Darts already thrown in the current visit. */
  throwsInCurrentTurn: number;
  /** The armed band. Owned by the match view and shared with the board. */
  armedSegment: ArmedSegment;
  /** Fired when the player arms another band. */
  onArmedSegmentChange: (segment: ArmedSegment) => void;
  /**
   * Fired with the resolved throw.
   *
   * A miss sends `{ points: 0 }` with the segment omitted: the engine
   * rejects a segment on a zero-scoring throw.
   */
  onThrow: (throwInput: { points: number; segment?: ThrowSegment }) => void;
  disabled?: boolean;
  /**
   * Whether the pad carries the band switch itself.
   *
   * The switch is rendered **once** in the whole screen: in the board mode
   * it stands above the board, because a treble band on a phone board is
   * about eleven pixels tall and the band has to be chosen before the board
   * is tapped. Two switches with the same radio name would break the
   * end-to-end suite's strict role queries, so the view moves the switch
   * instead of duplicating it.
   */
  showSegmentControl?: boolean;
}

/**
 * What the big number of the player overview means.
 *
 * The engine owns the rules; the view reads them. Each mode therefore has
 * its own variant of the overview data, and the shared component switches
 * on `kind`. A new mode without a variant breaks the typecheck — which is
 * the point: the union cannot be quietly flattened into one generic field
 * that every mode then has to interpret on its own.
 */
export type ScoreboardKind = "x01" | "cricket" | "aroundTheClock" | "shanghai";

/** One player in the overview. */
export interface ScoreboardPlayer {
  readonly id: string;
  readonly name: string;
  /**
   * The number of the row — its meaning depends on the mode: points left
   * in x01, targets hit in around the clock, marks in shanghai.
   */
  readonly value: number;
  /** True for the player whose turn it is. */
  readonly isCurrent: boolean;
}

/** The x01 variant: the points left and the checkout rule in force. */
export interface X01ScoreboardData {
  readonly kind: "x01";
  readonly checkoutLabel: string;
  readonly leg?: { readonly current: number; readonly total: number };
  readonly set?: { readonly current: number; readonly total: number };
}

/** The cricket variant: the marks of every player on every target. */
export interface CricketScoreboardData {
  readonly kind: "cricket";
  readonly marks: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly targets: readonly number[];
  readonly marksToClose: number;
}

/** The around the clock variant: the target in play and the progress. */
export interface AroundTheClockScoreboardData {
  readonly kind: "aroundTheClock";
  readonly currentTarget: number;
  readonly targetIndex: number;
  readonly targetCount: number;
  readonly playerProgress: Readonly<Record<string, number>>;
}

/** The shanghai variant: the round in play and the segments it has seen. */
export interface ShanghaiScoreboardData {
  readonly kind: "shanghai";
  readonly currentRound: number;
  readonly totalRounds: number;
  readonly target: number;
  readonly roundRecords: Readonly<
    Record<string, { marks: number; hitSingle: boolean; hitDouble: boolean; hitTriple: boolean }>
  >;
}

/** The mode data of the overview — one shape per mode, never a merged one. */
export type ScoreboardData =
  X01ScoreboardData | CricketScoreboardData | AroundTheClockScoreboardData | ShanghaiScoreboardData;

export interface PlayerScoreboardProps {
  /** The players, in their stable seating order. */
  readonly players: readonly ScoreboardPlayer[];
  /** The mode's own data. The switch on `kind` is exhaustive. */
  readonly data: ScoreboardData;
}

/** One dart of a visit. */
export interface VisitEntry {
  playerId: string;
  points: number;
  /** The score the player had left after the dart. */
  remaining?: number;
  /** The band the dart hit. Omitted for a miss. */
  segment?: ThrowSegment;
  /**
   * True when the dart busted. A bust is rejected by the engine and never
   * reaches the sheet as state, so the UI records it locally.
   */
  bust?: boolean;
}

export interface ScoreDisplayProps {
  players: ReadonlyArray<{ id: string; totalPoints: number }>;
  currentPlayerId: string | null;
  playerNames: Record<string, string>;
  /** The darts of the match, oldest first. */
  throwHistory?: VisitEntry[];
  /** The leg in play, e.g. `{ current: 2, total: 5 }`. */
  leg?: { current: number; total: number };
  /** The set in play, e.g. `{ current: 1, total: 3 }`. */
  set?: { current: number; total: number };
  /**
   * What the score column means in this mode — `REMAINING`, `HIT`, `MARKS`.
   * The number treatment is identical; the label is not.
   */
  caption?: string;
}

export interface GameResultBannerProps {
  winnerId: string | null;
  players: ReadonlyArray<{ id: string; totalPoints: number }>;
  playerNames: Record<string, string>;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  /**
   * Removes the last entered dart — including the match-winning one — and
   * returns the match to play. Omit to hide the offer.
   */
  onUndo?: () => void;
  /** The leg the winner took, e.g. `{ current: 2, total: 5 }`. */
  leg?: { current: number; total: number };
  /** The set the winner took, e.g. `{ current: 1, total: 3 }`. */
  set?: { current: number; total: number };
}

/** The choices a player makes before the first dart. */
export interface PlayerSetupOptions {
  /** The checkout rule the match is played under. */
  outRule: OutRuleId;
  /** Where the darts come from. */
  boardSource: BoardSourceId;
}

export interface PlayerSetupProps {
  modeName: string;
  modeDescription: string;
  /** A Lucide icon in brass. Never an emoji. */
  modeIcon?: LucideIcon;
  minPlayers?: number;
  maxPlayers?: number;
  /** The checkout rule. Defaults to double out. */
  outRule?: OutRuleId;
  onOutRuleChange?: (rule: OutRuleId) => void;
  /**
   * Whether the setup offers a checkout rule. The x01 modes need one; the
   * modes without a checkout (cricket, around the clock, shanghai) must not
   * be offered a rule they cannot use. Defaults to true.
   */
  showCheckoutRule?: boolean;
  /** The board source. Defaults to the virtual board. */
  boardSource?: BoardSourceId;
  onBoardSourceChange?: (id: BoardSourceId) => void;
  onStart: (playerNames: string[], options: PlayerSetupOptions) => void;
}

/** A resolved dart on the board, as the board reports it. */
export interface BoardThrow {
  /** The points the dart is worth. 0 for a miss. */
  points: number;
  /** The band the dart hit. Null for a miss. */
  segment: ThrowSegment | null;
  /** The human-readable mark, e.g. "T20". */
  label: string;
}

export interface MatchLayoutProps {
  /** The mode's name, e.g. "Cricket". */
  modeName: string;
  /**
   * The way the player enters darts: the board or the pad.
   *
   * The switch is a view concern: it changes which surface takes the tap,
   * never the match state.
   */
  inputMode?: InputMode;
  /** Fired when the player switches the input mode. */
  onInputModeChange?: (mode: InputMode) => void;
  /** The mode's live state, e.g. "Round 3 / 7". */
  badge?: string;
  /** The board the darts come from, e.g. "Virtual Board". */
  sourceLabel?: string;
  /**
   * The player overview: who is on throw and what is left.
   *
   * It stands between the strip and the input, because that is where the
   * player looks first: the remaining score is the number that decides
   * whether the next dart is safe.
   */
  scoreboard?: ReactNode;
  /** The visit in progress: the chips naming each dart of the current turn. */
  visit?: ReactNode;
  /** The strip's own actions, beside the one that returns to the Game Center. */
  actions?: ReactNode;
  /** Back to the game centre. */
  onBackToHub: () => void;
  /** The armed band. Owned by the match view and shared with the board. */
  armedSegment: ArmedSegment;
  /**
   * Fired when the player arms another band.
   *
   * The board mode shows the segment control above the board: a treble band
   * on a phone board is about eleven pixels tall, so the band is chosen first
   * and the wide single band is the tap target.
   */
  onArmedSegmentChange?: (segment: ArmedSegment) => void;
  /** Fired with a resolved dart from the board. */
  onBoardThrow: (hit: BoardThrow) => void;
  /**
   * The dart pad: the input of the manual mode.
   *
   * It is a prop of its own rather than part of `children`, because where it
   * belongs depends on the input mode: on a phone the pad is the input and
   * stands above the score sheet, while the board is the input and stands
   * above everything.
   */
  input?: ReactNode;
  /** The mode's score surface, in the right-hand column. */
  children: ReactNode;
}

/**
 * The cricket score surface.
 *
 * Cricket has no remaining score: the targets are the score. The sheet shows
 * the marks on every target and which targets are closed.
 */
export interface CricketScoreSheetProps {
  /** The targets in play, e.g. 20 to 15 and the bull (25). */
  targets: readonly number[];
  /** The marks that close a target. */
  marksToClose: number;
  /**
   * Every seated player and the marks they hold, in seating order.
   *
   * The sheet is a sheet **per player**: a cricket match has no shared
   * score, so a component that could show one player's marks could never
   * show a match. `marks` and `playerName` are therefore gone, not kept
   * as aliases — this is the convention the other mode sheets follow.
   */
  players: ReadonlyArray<{
    id: string;
    name: string;
    /** The marks on every target, keyed by the target value as a string. */
    marks: Record<string, number>;
  }>;
  /** The player whose turn it is. */
  currentPlayerId?: string | null;
}

export interface AroundTheClockScoreSheetProps {
  /** The targets in order: 1 to 20 and the bull (25). */
  targets: readonly number[];
  /** The index of the target in play. The length of the list when it is over. */
  currentIndex: number;
}

export interface ShanghaiScoreSheetProps {
  /** The round in play, 1-based. */
  currentRound: number;
  /** The number of rounds in the match. */
  totalRounds: number;
  /** The target of every round, the first round first. */
  targets: readonly number[];
  /** The marks scored in every round, keyed by the round number as a string. */
  marksByRound: Record<string, number>;
  /** The segments hit in the round in play. */
  hit: { single: boolean; double: boolean; triple: boolean };
}

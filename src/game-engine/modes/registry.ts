/**
 * The mode registry — the one place the Game Center reads its rules from.
 *
 * Every value below is derived from a mode's own exported constants, or
 * from the mode instance itself, so the rule sheet can never describe a
 * rule the engine does not implement.
 */
import { DARTS_PER_TURN } from "@/game-engine";
import { AROUND_THE_CLOCK_TARGETS } from "@/game-engine/modes/AroundTheClockMode";
import { CRICKET_TARGETS, MARKS_TO_CLOSE } from "@/game-engine/modes/CricketMode";
import { SHANGHAI_ROUNDS, roundTarget } from "@/game-engine/modes/ShanghaiMode";
import {
  Standard501Mode,
  Standard301Mode,
  type StandardMode,
} from "@/game-engine/modes/StandardMode";
import { OUT_RULES, isValidSegmentScore, type OutRule } from "@/game-engine/rules";
import type { OutRuleId } from "@/game-engine/types";

/** One game mode, as the rule sheet shows it. */
export interface ModeRuleEntry {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  /** The score every player starts from, or null when the mode has none. */
  readonly start: string | null;
  readonly winCondition: string;
  /** The checkout rule the mode defaults to, or null when it has none. */
  readonly checkout: string | null;
  /** The target set, or null when the mode has none. */
  readonly targets: string | null;
}

/** How each checkout rule is named on screen. */
const OUT_RULE_LABELS: Readonly<Record<OutRuleId, string>> = {
  double: "Double out",
  master: "Master out",
  straight: "Straight out",
};

/** A checkout rule the match setup can offer, named and explained. */
export interface OutRuleChoice {
  readonly id: OutRuleId;
  readonly label: string;
  /** What the rule accepts, read from the rule itself. */
  readonly description: string;
}

/**
 * The checkout rules the engine offers, in the order they are offered.
 *
 * The explanation is read from the rule — from what it accepts — so it
 * cannot describe a finish the rule does not allow.
 */
export const OUT_RULE_CHOICES: readonly OutRuleChoice[] = (
  Object.keys(OUT_RULES) as OutRuleId[]
).map((id) => ({
  id,
  label: OUT_RULE_LABELS[id],
  description: describeCheckout(OUT_RULES[id]),
}));

/** Explains a checkout rule by the finishes it accepts. */
function describeCheckout(rule: OutRule): string {
  if (rule.isCheckout("single", 20)) {
    return "any finish counts";
  }
  const accepted: string[] = [];
  if (rule.isCheckout("double", 40)) {
    accepted.push("a double");
  }
  if (rule.isCheckout("bull", 50)) {
    accepted.push("the inner bull (50)");
  }
  if (rule.isCheckout("bull", 25)) {
    accepted.push("the outer bull (25)");
  }
  return accepted.length > 0 ? `finish on ${accepted.join(" or ")}` : "no dart may finish the leg";
}

/**
 * The facts an x01 mode encodes in its id: the score it starts from and the
 * checkout rule it defaults to (`StandardMode` builds the id from both).
 */
function readX01Facts(mode: StandardMode): { start: string; outRuleId: OutRuleId } {
  const match = /^x01-(\d+)(?:-(double|master)-out)?/.exec(mode.id);
  if (!match) {
    throw new Error(`Cannot read the rules of the x01 mode "${mode.id}"`);
  }
  return { start: match[1]!, outRuleId: (match[2] as OutRuleId | undefined) ?? "straight" };
}

/** The bull among a target list — the only target the board takes as a bull. */
function bullTarget(targets: readonly number[]): number | null {
  return targets.find((target) => isValidSegmentScore("bull", target)) ?? null;
}

/** Renders a run of consecutive targets as "1-20" (or "20-15" when it descends). */
function formatRange(values: readonly number[]): string {
  if (values.length === 0) {
    return "";
  }
  const sorted = [...values].sort((a, b) => a - b);
  const consecutive = sorted.every(
    (value, index) => index === 0 || value === sorted[index - 1]! + 1,
  );
  if (!consecutive) {
    return sorted.join(", ");
  }
  const ascending = values[0]! < values[values.length - 1]!;
  return ascending
    ? `${sorted[0]}-${sorted[sorted.length - 1]}`
    : `${sorted[sorted.length - 1]}-${sorted[0]}`;
}

/** The segments a Shanghai round must cover to win outright. */
const SHANGHAI_SEGMENTS = 3;

const fiveOhOne = new Standard501Mode();
const threeOhOne = new Standard301Mode();
const fiveOhOneFacts = readX01Facts(fiveOhOne);
const threeOhOneFacts = readX01Facts(threeOhOne);

const cricketBull = bullTarget(CRICKET_TARGETS);
const aroundTheClockBull = bullTarget(AROUND_THE_CLOCK_TARGETS);
const cricketNumbers = CRICKET_TARGETS.filter((target) => target !== cricketBull);
const aroundTheClockNumbers = AROUND_THE_CLOCK_TARGETS.filter(
  (target) => target !== aroundTheClockBull,
);
const shanghaiNumbers = Array.from({ length: SHANGHAI_ROUNDS }, (_round, index) =>
  roundTarget(index + 1),
);

/** One entry per game mode, in the order the sheet lists them. */
export const MODE_RULES: readonly ModeRuleEntry[] = [
  {
    id: "501",
    name: "501",
    href: "/game",
    start: fiveOhOneFacts.start,
    winCondition: "Reach exactly 0",
    checkout: OUT_RULE_LABELS[fiveOhOneFacts.outRuleId],
    targets: null,
  },
  {
    id: "301",
    name: "301",
    href: "/game/301",
    start: threeOhOneFacts.start,
    winCondition: "Reach exactly 0",
    checkout: OUT_RULE_LABELS[threeOhOneFacts.outRuleId],
    targets: null,
  },
  {
    id: "cricket",
    name: "Cricket",
    href: "/game/cricket",
    start: null,
    winCondition: `Close ${MARKS_TO_CLOSE} marks to score`,
    checkout: null,
    targets: `${formatRange(cricketNumbers)} + Bull`,
  },
  {
    id: "around-the-clock",
    name: "Around The Clock",
    href: "/game/around-the-clock",
    start: null,
    winCondition: "Hit every target in order",
    checkout: null,
    targets: `${formatRange(aroundTheClockNumbers)}, then Bull`,
  },
  {
    id: "shanghai",
    name: "Shanghai",
    href: "/game/shanghai",
    start: null,
    winCondition: `Hit all ${SHANGHAI_SEGMENTS} segments in one round`,
    checkout: null,
    targets: formatRange(shanghaiNumbers),
  },
];

/**
 * The one generated line under the sheet: the darts per turn (a constant)
 * and the checkout rule the match setup offers and the x01 modes start on.
 */
export function sheetFootnote(): string {
  const labels = OUT_RULE_CHOICES.map((choice) => choice.label);
  const choices =
    labels.length > 1
      ? `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
      : labels.join("");

  const starters = new Map<string, string[]>();
  for (const entry of MODE_RULES) {
    if (entry.checkout === null) {
      continue;
    }
    starters.set(entry.checkout, [...(starters.get(entry.checkout) ?? []), entry.name]);
  }
  const defaults = [...starters.entries()].map(
    ([checkout, names]) =>
      `${names.join(" and ")} ${names.length === 1 ? "starts" : "start"} on ${checkout}`,
  );

  return `${DARTS_PER_TURN} darts per turn · Checkout rule is chosen when the match starts: ${choices}. ${defaults.join("; ")}.`;
}

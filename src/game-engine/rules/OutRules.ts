import { GameEngineValidationError, type OutRuleId, type ThrowSegment } from "@/game-engine/types";

/**
 * Checkout/finishing rule of an x01 match (task 038).
 *
 * A rule answers two questions:
 * - which board segments may deliver the final dart that lands on
 *   exactly zero ({@link OutRule.isCheckout}), and
 * - which resulting scores are themselves a bust because no legal
 *   checkout sequence exists from them anymore
 *   ({@link OutRule.isStrandedBust}).
 *
 * The remaining arithmetic (subtracting points, rejecting overshoots
 * below zero) is handled by the x01 mode itself.
 */
export interface OutRule {
  /** Stable rule identifier, also used as the configuration value. */
  readonly id: OutRuleId;
  /**
   * True when a dart hitting `segment` and scoring `points` may legally
   * take the remaining score to exactly zero. A missing segment marks a
   * throw whose board location is unknown; only "straight" accepts it.
   */
  isCheckout(segment: ThrowSegment | undefined, points: number): boolean;
  /** True when landing on `remaining` is a bust under this rule. */
  isStrandedBust(remaining: number): boolean;
}

/** True when `points` can come from a board double (double 1 .. double 20). */
export function isDoubleScore(points: number): boolean {
  return Number.isInteger(points) && points >= 2 && points <= 40 && points % 2 === 0;
}

/**
 * True when the segment/points pair is physically possible on a dart
 * board: "single" 1..20, "double" 2..40 (even), "triple" 3..60
 * (multiple of 3) and "bull" 25 (outer bull) or 50 (inner bull).
 */
export function isValidSegmentScore(segment: ThrowSegment, points: number): boolean {
  if (!Number.isInteger(points) || points <= 0) {
    return false;
  }
  switch (segment) {
    case "single":
      return points >= 1 && points <= 20;
    case "double":
      return isDoubleScore(points);
    case "triple":
      return points >= 3 && points <= 60 && points % 3 === 0;
    case "bull":
      return points === 25 || points === 50;
    default:
      return false;
  }
}

/** Double Out: only a board double (2 .. double 20) may finish the leg. */
class DoubleOutRule implements OutRule {
  readonly id: OutRuleId = "double";

  isCheckout(segment: ThrowSegment | undefined, points: number): boolean {
    return segment === "double" && isDoubleScore(points);
  }

  isStrandedBust(remaining: number): boolean {
    return remaining === 1;
  }
}

/** Master Out: a board double or the inner bull (50) may finish the leg. */
class MasterOutRule implements OutRule {
  readonly id: OutRuleId = "master";

  isCheckout(segment: ThrowSegment | undefined, points: number): boolean {
    if (segment === "bull") {
      return points === 50;
    }
    return segment === "double" && isDoubleScore(points);
  }

  isStrandedBust(remaining: number): boolean {
    return remaining === 1;
  }
}

/** Straight Out: any score may finish the leg, no segment knowledge needed. */
class StraightOutRule implements OutRule {
  readonly id: OutRuleId = "straight";

  isCheckout(_segment: ThrowSegment | undefined, _points: number): boolean {
    return true;
  }

  isStrandedBust(_remaining: number): boolean {
    return false;
  }
}

/** All selectable strategies, keyed by their {@link OutRuleId}. */
export const OUT_RULES: Readonly<Record<OutRuleId, OutRule>> = {
  double: new DoubleOutRule(),
  master: new MasterOutRule(),
  straight: new StraightOutRule(),
};

/** Resolves an out-rule id (defaulting to "straight") to its strategy. */
export function getOutRule(id: OutRuleId = "straight"): OutRule {
  const rule = OUT_RULES[id];
  if (!rule) {
    throw new GameEngineValidationError(`Unknown out rule: ${String(id)}`);
  }
  return rule;
}

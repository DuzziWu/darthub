/**
 * Finishing-rule and match-format building blocks of the engine
 * (task 038). Lives in its own barrel so concurrent feature work on
 * `src/game-engine` does not collide on the root barrel.
 */
export {
  OUT_RULES,
  getOutRule,
  isDoubleScore,
  isValidSegmentScore,
} from "@/game-engine/rules/OutRules";
export type { OutRule } from "@/game-engine/rules/OutRules";
export { LegSetManager, LEG_SET_MODE_DATA_KEY } from "@/game-engine/rules/LegSetManager";
export type {
  LegSetConfig,
  LegSetOutcome,
  LegSetProgress,
} from "@/game-engine/rules/LegSetManager";

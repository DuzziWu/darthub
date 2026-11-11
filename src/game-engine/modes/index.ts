/**
 * Game mode implementations of the {@link DartGameMode} seam.
 *
 * Lives in its own barrel so concurrent feature work on `src/game-engine`
 * does not collide on the root `src/game-engine/index.ts` barrel.
 */
export { StandardMode, Standard501Mode, Standard301Mode } from "@/game-engine/modes/StandardMode";
export type { StandardModeConfig } from "@/game-engine/modes/StandardMode";
export {
  CricketMode,
  CRICKET_TARGETS,
  getCricketWinnerId,
  MARKS_TO_CLOSE,
} from "@/game-engine/modes/CricketMode";
export type { CricketModeData } from "@/game-engine/modes/CricketMode";
export {
  AroundTheClockMode,
  AROUND_THE_CLOCK_TARGETS,
} from "@/game-engine/modes/AroundTheClockMode";
export type { AroundTheClockModeData } from "@/game-engine/modes/AroundTheClockMode";
export { ShanghaiMode, SHANGHAI_ROUNDS, roundTarget } from "@/game-engine/modes/ShanghaiMode";
export type { ShanghaiModeData } from "@/game-engine/modes/ShanghaiMode";

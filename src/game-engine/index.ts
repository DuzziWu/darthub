/**
 * Public entry point of the core dart game engine.
 *
 * Pure TypeScript, importable from Node servers and browsers alike.
 */
export { GameEngine, DARTS_PER_TURN } from "@/game-engine/GameEngine";
export { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
export { OUT_RULES, getOutRule, LegSetManager } from "@/game-engine/rules";
export type { OutRule, LegSetConfig, LegSetOutcome, LegSetProgress } from "@/game-engine/rules";
export { GameEngineStateError, GameEngineValidationError } from "@/game-engine/types";
export type {
  OutRuleId,
  ThrowSegment,
  DartGameMode,
  MatchConfig,
  MatchState,
  MutableMatchState,
  MutablePlayerState,
  PlayerState,
  ThrowInput,
  ThrowRecord,
  MatchStatus,
} from "@/game-engine/types";

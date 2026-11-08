/**
 * Career-mode quest domain types and runtime validation.
 *
 * Quests are JSON-driven: each quest declares ordered stages, stage
 * objectives, rewards for completion, and (optionally) adaptive
 * difficulty parameters. The runtime validator in this module is the
 * authority for whether a parsed quest JSON file is well-formed.
 */

export type QuestObjectiveType =
  | "matchWins"
  | "legsWon"
  | "checkout"
  | "turnScore"
  | "singleDartScore"
  | "averagePerTurn"
  | "bullseyesHit";

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  /** Numeric goal the player must reach for this objective. */
  target: number;
  description?: string;
}

export interface QuestStage {
  id: string;
  name: string;
  objectives: QuestObjective[];
}

export interface QuestAdaptiveDifficultyParameters {
  /** Target player win rate (0..1) the difficulty loop aims for. */
  winRateTarget: number;
  /** Consecutive losses before difficulty is relaxed. */
  lossStreakThreshold: number;
  /** Consecutive wins before difficulty is tightened. */
  winStreakThreshold: number;
  /** How much objective targets change per adjustment (fraction, 0..1). */
  targetAdjustmentStep: number;
}

/** Boolean switches consumed by the adaptive difficulty engine (task 022). */
export interface QuestAdaptiveDifficultyFlags {
  /** Loosen objective targets after a loss streak. */
  relaxTargetsOnLoss: boolean;
  /** Tighten objective targets after a win streak. */
  tightenTargetsOnWin: boolean;
  /** Enable assist mechanics during a losing streak. */
  assistOnStreak: boolean;
}

export interface QuestAdaptiveDifficulty {
  enabled: boolean;
  parameters: QuestAdaptiveDifficultyParameters;
  flags: QuestAdaptiveDifficultyFlags;
}

export interface QuestRewards {
  xp: number;
  coins: number;
  unlockedItems?: string[];
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  /** Minimum player level required before the quest is offered. */
  minLevel: number;
  /** Ordering used when picking the next quest for a player. */
  order: number;
  stages: QuestStage[];
  rewards: QuestRewards;
  adaptiveDifficulty?: QuestAdaptiveDifficulty;
}

export type QuestValidationResult =
  { valid: true; quest: Quest } | { valid: false; errors: string[] };

const OBJECTIVE_TYPES: readonly QuestObjectiveType[] = [
  "matchWins",
  "legsWon",
  "checkout",
  "turnScore",
  "singleDartScore",
  "averagePerTurn",
  "bullseyesHit",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(source: Record<string, unknown>, field: string, errors: string[]): string {
  const value = source[field];
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`"${field}" must be a non-empty string`);
    return "";
  }
  return value;
}

function requireNumber(source: Record<string, unknown>, field: string, errors: string[]): number {
  const value = source[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`"${field}" must be a finite number`);
    return 0;
  }
  return value;
}

function validateObjective(input: unknown, index: number, errors: string[]): QuestObjective | null {
  if (!isObject(input)) {
    errors.push(`objectives[${index}] must be an object`);
    return null;
  }

  const id = requireString(input, "id", errors);
  const target = requireNumber(input, "target", errors);

  const type = input["type"];
  if (typeof type !== "string" || !OBJECTIVE_TYPES.includes(type as QuestObjectiveType)) {
    errors.push(`objectives[${index}].type must be one of: ${OBJECTIVE_TYPES.join(", ")}`);
    return null;
  }

  const description = input["description"];
  if (description !== undefined && typeof description !== "string") {
    errors.push(`objectives[${index}].description must be a string`);
    return null;
  }

  return {
    id,
    type: type as QuestObjectiveType,
    target,
    ...(description === undefined ? {} : { description }),
  };
}

function validateStage(input: unknown, index: number, errors: string[]): QuestStage | null {
  if (!isObject(input)) {
    errors.push(`stages[${index}] must be an object`);
    return null;
  }

  const id = requireString(input, "id", errors);
  const name = requireString(input, "name", errors);

  const rawObjectives = input["objectives"];
  if (!Array.isArray(rawObjectives) || rawObjectives.length === 0) {
    errors.push(`stages[${index}].objectives must be a non-empty array`);
    return null;
  }

  const objectives: QuestObjective[] = [];
  rawObjectives.forEach((objective, objectiveIndex) => {
    const validated = validateObjective(objective, objectiveIndex, errors);
    if (validated !== null) {
      objectives.push(validated);
    }
  });

  return { id, name, objectives };
}

function validateRewards(input: unknown, errors: string[]): QuestRewards | null {
  if (!isObject(input)) {
    errors.push('"rewards" must be an object');
    return null;
  }

  const xp = requireNumber(input, "xp", errors);
  const coins = requireNumber(input, "coins", errors);

  let unlockedItems: string[] | undefined;
  const rawUnlockedItems = input["unlockedItems"];
  if (rawUnlockedItems !== undefined) {
    if (
      !Array.isArray(rawUnlockedItems) ||
      rawUnlockedItems.some((item) => typeof item !== "string")
    ) {
      errors.push('"rewards.unlockedItems" must be an array of strings');
      return null;
    }
    unlockedItems = rawUnlockedItems as string[];
  }

  return { xp, coins, ...(unlockedItems === undefined ? {} : { unlockedItems }) };
}

function validateAdaptiveDifficulty(
  input: unknown,
  errors: string[],
): QuestAdaptiveDifficulty | null {
  if (!isObject(input)) {
    errors.push('"adaptiveDifficulty" must be an object');
    return null;
  }

  const enabled = input["enabled"];
  if (typeof enabled !== "boolean") {
    errors.push('"adaptiveDifficulty.enabled" must be a boolean');
    return null;
  }

  const rawParameters = input["parameters"];
  if (!isObject(rawParameters)) {
    errors.push('"adaptiveDifficulty.parameters" must be an object');
    return null;
  }

  const rawFlags = input["flags"];
  if (!isObject(rawFlags)) {
    errors.push('"adaptiveDifficulty.flags" must be an object');
    return null;
  }

  const winRateTarget = requireNumber(rawParameters, "winRateTarget", errors);
  if (typeof winRateTarget === "number" && (winRateTarget < 0 || winRateTarget > 1)) {
    errors.push('"adaptiveDifficulty.parameters.winRateTarget" must be within [0, 1]');
  }
  const lossStreakThreshold = requireNumber(rawParameters, "lossStreakThreshold", errors);
  if (typeof lossStreakThreshold === "number" && !Number.isInteger(lossStreakThreshold)) {
    errors.push('"adaptiveDifficulty.parameters.lossStreakThreshold" must be an integer');
  }
  const winStreakThreshold = requireNumber(rawParameters, "winStreakThreshold", errors);
  if (typeof winStreakThreshold === "number" && !Number.isInteger(winStreakThreshold)) {
    errors.push('"adaptiveDifficulty.parameters.winStreakThreshold" must be an integer');
  }
  const targetAdjustmentStep = requireNumber(rawParameters, "targetAdjustmentStep", errors);
  if (
    typeof targetAdjustmentStep === "number" &&
    (targetAdjustmentStep < 0 || targetAdjustmentStep > 1)
  ) {
    errors.push('"adaptiveDifficulty.parameters.targetAdjustmentStep" must be within [0, 1]');
  }

  const flags: Partial<QuestAdaptiveDifficultyFlags> = {};
  for (const flagKey of ["relaxTargetsOnLoss", "tightenTargetsOnWin", "assistOnStreak"] as const) {
    const value = rawFlags[flagKey];
    if (typeof value !== "boolean") {
      errors.push(`"adaptiveDifficulty.flags.${flagKey}" must be a boolean`);
      continue;
    }
    flags[flagKey] = value;
  }

  if (errors.length > 0) {
    return null;
  }

  return {
    enabled,
    parameters: {
      winRateTarget,
      lossStreakThreshold,
      winStreakThreshold,
      targetAdjustmentStep,
    },
    flags: flags as QuestAdaptiveDifficultyFlags,
  };
}

/**
 * Validate an unknown parsed-JSON value as a quest.
 * Returns a discriminated result with the typed quest or error details.
 */
export function validateQuest(input: unknown): QuestValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return {
      valid: false,
      errors: ["quest must be a JSON object"],
    };
  }

  const id = requireString(input, "id", errors);
  const name = requireString(input, "name", errors);
  const description = requireString(input, "description", errors);
  const minLevel = requireNumber(input, "minLevel", errors);
  const order = requireNumber(input, "order", errors);

  const rewards = validateRewards(input["rewards"], errors);

  let adaptiveDifficulty: QuestAdaptiveDifficulty | undefined;
  const rawAdaptiveDifficulty = input["adaptiveDifficulty"];
  if (rawAdaptiveDifficulty !== undefined) {
    adaptiveDifficulty = validateAdaptiveDifficulty(rawAdaptiveDifficulty, errors) ?? undefined;
  }

  const rawStages = input["stages"];
  let stages: QuestStage[] = [];
  if (!Array.isArray(rawStages) || rawStages.length === 0) {
    errors.push('"stages" must be a non-empty array');
  } else {
    stages = rawStages
      .map((stage, index) => validateStage(stage, index, errors))
      .filter((stage): stage is QuestStage => stage !== null);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    quest: {
      id,
      name,
      description,
      minLevel,
      order,
      stages,
      rewards: rewards as QuestRewards,
      ...(adaptiveDifficulty === undefined ? {} : { adaptiveDifficulty }),
    },
  };
}

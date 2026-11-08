import type { DifficultyConfig, DifficultyLevel } from "./types";
import easyConfig from "./config/easy.json";
import mediumConfig from "./config/medium.json";
import hardConfig from "./config/hard.json";
import expertConfig from "./config/expert.json";

/** Static registry of the bundled difficulty tier configurations. */
const DIFFICULTY_CONFIGS: Partial<Record<DifficultyLevel, unknown>> = {
  easy: easyConfig,
  medium: mediumConfig,
  hard: hardConfig,
  expert: expertConfig,
};

const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "expert"] as const;
const ACCURACY_CLASSES = ["single", "double", "triple", "bull"] as const;

/** Raises a validation failure naming both the config and the offending field. */
function invalid(level: string, field: string, reason: string): never {
  throw new Error(`Invalid difficulty config (${level}): field "${field}" ${reason}`);
}

function requireObject(value: unknown, level: string, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(level, field, "must be an object");
  }
  return value as Record<string, unknown>;
}

function requirePositiveNumber(value: unknown, level: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    invalid(level, field, "must be a positive finite number");
  }
  return value;
}

function requireRate(value: unknown, level: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    invalid(level, field, "must be a rate between 0 and 1");
  }
  return value;
}

function requireNonEmptyString(value: unknown, level: string, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    invalid(level, field, "must be a non-empty string");
  }
  return value;
}

/** Canonical aim label ("S20", "T19", "D16", "BULL") used in the scoring tables. */
const AIM_LABEL_PATTERN = /^([SDT](?:[1-9]|1[0-9]|20)|BULL)$/;

/**
 * Hand-rolled runtime validation guard. Verifies every required field of a
 * difficulty configuration and its value domains; throws `Error` naming the
 * config level and offending field on any violation.
 */
export function validateDifficultyConfig(value: unknown): DifficultyConfig {
  const config = requireObject(value, "config", "root");
  const level = requireNonEmptyString(config["difficulty"], "config", "difficulty");

  requireNonEmptyString(config["description"], level, "description");

  const sigma = requireObject(config["sigma"], level, "sigma");
  for (const accuracyClass of ACCURACY_CLASSES) {
    if (!(accuracyClass in sigma)) {
      invalid(level, `sigma.${accuracyClass}`, "is required");
    }
    requirePositiveNumber(sigma[accuracyClass], level, `sigma.${accuracyClass}`);
  }

  const aimWeights = requireObject(config["aimWeights"], level, "aimWeights");
  const scoring = requireObject(aimWeights["scoring"], level, "aimWeights.scoring");
  if (Object.keys(scoring).length === 0) {
    invalid(level, "aimWeights.scoring", "must define at least one aim weight");
  }
  for (const [label, weight] of Object.entries(scoring)) {
    if (!AIM_LABEL_PATTERN.test(label)) {
      invalid(level, `aimWeights.scoring.${label}`, "must be a valid aim label");
    }
    requirePositiveNumber(weight, level, `aimWeights.scoring.${label}`);
  }

  if (!DIFFICULTY_LEVELS.includes(level as DifficultyLevel)) {
    invalid(level, "difficulty", `must be one of ${DIFFICULTY_LEVELS.join(", ")}`);
  }
  requireRate(config["checkoutSuccessRate"], level, "checkoutSuccessRate");

  return config as unknown as DifficultyConfig;
}

/**
 * Loads and validates the bundled configuration for a difficulty level.
 * Throws `Error` for an unknown level or a config violating its type contract.
 */
export function loadDifficultyConfig(level: DifficultyLevel): DifficultyConfig {
  const raw = DIFFICULTY_CONFIGS[level];
  if (raw === undefined) {
    throw new Error(`Unknown AI difficulty: ${level}`);
  }
  const config = validateDifficultyConfig(raw);
  if (config.difficulty !== level) {
    throw new Error(
      `Invalid difficulty config: declared "${config.difficulty}" but loaded as "${level}"`,
    );
  }
  return config;
}

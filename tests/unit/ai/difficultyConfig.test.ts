import { describe, expect, it } from "vitest";
import { loadDifficultyConfig, validateDifficultyConfig } from "@/ai/difficultyConfig";
import type { DifficultyConfig, DifficultyLevel } from "@/ai/types";
import easyJson from "@/ai/config/easy.json";
import mediumJson from "@/ai/config/medium.json";
import hardJson from "@/ai/config/hard.json";
import expertJson from "@/ai/config/expert.json";

const CONFIG_JSON: Record<DifficultyLevel, unknown> = {
  easy: easyJson,
  medium: mediumJson,
  hard: hardJson,
  expert: expertJson,
};

/** Required top-level fields of a difficulty configuration file. */
const REQUIRED_FIELDS = [
  "difficulty",
  "description",
  "sigma",
  "aimWeights",
  "checkoutSuccessRate",
] as const;

/** Required accuracy classes with their Gaussian aim spread (mm). */
const REQUIRED_SIGMA_CLASSES = ["single", "double", "triple", "bull"] as const;

/** Deep-clones the raw JSON so mutations never leak into other tests. */
function cloneConfig(level: DifficultyLevel): Record<string, unknown> {
  return structuredClone(CONFIG_JSON[level]) as Record<string, unknown>;
}

describe("AI difficulty configuration", () => {
  it("validates that all required fields exist in each config file", () => {
    for (const [level, raw] of Object.entries(CONFIG_JSON)) {
      const config = validateDifficultyConfig(raw) as DifficultyConfig;
      // Every required field must be present on the validated object.
      for (const field of REQUIRED_FIELDS) {
        expect(config, `field "${field}" must exist in ${level}.json`).toHaveProperty(field);
      }
      // Every accuracy class must have a spread in the sigma table.
      for (const accuracyClass of REQUIRED_SIGMA_CLASSES) {
        expect(
          config.sigma[accuracyClass],
          `sigma.${accuracyClass} must exist in ${level}.json`,
        ).toBeGreaterThan(0);
      }
      // The scoring aim-weight table must be populated.
      expect(
        Object.keys(config.aimWeights.scoring),
        `aimWeights.scoring must be populated in ${level}.json`,
      ).not.toHaveLength(0);
    }
  });

  it("loads each difficulty tier by name from the registry", () => {
    for (const level of ["easy", "medium", "hard", "expert"] as DifficultyLevel[]) {
      const config = loadDifficultyConfig(level);
      expect(config.difficulty).toBe(level);
      expect(config.description.length).toBeGreaterThan(0);
      expect(Object.keys(config.aimWeights.scoring).length).toBeGreaterThan(0);
    }
  });

  it("rejects an unknown difficulty level", () => {
    expect(() => loadDifficultyConfig("legendary" as DifficultyLevel)).toThrow(
      "Unknown AI difficulty",
    );
  });

  it("rejects a config with a missing field", () => {
    for (const field of REQUIRED_FIELDS) {
      const mutated = cloneConfig("medium");
      delete mutated[field];
      expect(
        () => validateDifficultyConfig(mutated),
        `missing field "${field}" must be rejected`,
      ).toThrow();
    }
  });

  it("rejects a config with mutated field values", () => {
    const cases: Array<(config: Record<string, unknown>) => void> = [
      // Non-positive sigma spread.
      (config) => {
        (config["sigma"] as Record<string, unknown>)["double"] = 0;
      },
      // Checkout rate outside the [0, 1] band.
      (config) => {
        config["checkoutSuccessRate"] = 1.5;
      },
      // Unknown difficulty level label.
      (config) => {
        config["difficulty"] = "nightmare";
      },
      // Empty scoring aim table.
      (config) => {
        (config["aimWeights"] as Record<string, unknown>)["scoring"] = {};
      },
      // Oversized aim spread.
      (config) => {
        (config["sigma"] as Record<string, unknown>)["bull"] = -3;
      },
    ];
    for (const [index, mutate] of cases.entries()) {
      const mutated = cloneConfig("hard");
      mutate(mutated);
      expect(
        () => validateDifficultyConfig(mutated),
        `mutation ${index} must be rejected`,
      ).toThrow();
    }
  });
});

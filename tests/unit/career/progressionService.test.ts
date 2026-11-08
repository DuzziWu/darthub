import { describe, expect, it } from "vitest";
import {
  calculateXpForLevel,
  xpRequiredForNextLevel,
  awardXp,
  getUnlockablesForLevel,
} from "@/career/progressionService";
import { createEmptyProgress } from "@/career/careerProgressRepository";

describe("progressionService", () => {
  describe("calculateXpForLevel", () => {
    it("returns 0 for level 1", () => {
      expect(calculateXpForLevel(1)).toBe(0);
    });

    it("calculates XP required for each level correctly", () => {
      // Level 1→2: 100 * 1 * 1.5 = 150
      expect(calculateXpForLevel(2)).toBe(150);
      // Level 1→3: 150 + 100 * 2 * 1.5 = 150 + 300 = 450
      expect(calculateXpForLevel(3)).toBe(450);
      // Level 1→4: 450 + 100 * 3 * 1.5 = 450 + 450 = 900
      expect(calculateXpForLevel(4)).toBe(900);
    });
  });

  describe("xpRequiredForNextLevel", () => {
    it("returns 150 for level 1", () => {
      expect(xpRequiredForNextLevel(1)).toBe(150);
    });

    it("scales with level", () => {
      expect(xpRequiredForNextLevel(2)).toBe(300);
      expect(xpRequiredForNextLevel(3)).toBe(450);
    });
  });

  describe("awardXp", () => {
    it("awards XP without level-up when below threshold", () => {
      const progress = createEmptyProgress("user-1");
      const result = awardXp(progress, 50);
      expect(result.progress.playerLevel).toBe(1);
      expect(result.leveledUp).toBe(false);
    });

    it("awards XP and triggers level-up at threshold", () => {
      const progress = createEmptyProgress("user-1");
      // Need 150 XP to reach level 2
      const result = awardXp(progress, 150);
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.progress.playerLevel).toBe(2);
    });

    it("does not over-award XP beyond level threshold", () => {
      const progress = createEmptyProgress("user-1");
      // Award 200 XP (150 to level 2, 50 overflow)
      const result = awardXp(progress, 200);
      expect(result.newLevel).toBe(2);
      expect(result.progress.playerLevel).toBe(2);
    });

    it("handles multi-level jumps", () => {
      const progress = createEmptyProgress("user-1");
      // Level 1→2 needs 150, Level 2→3 needs 300, total 450
      const result = awardXp(progress, 500);
      expect(result.newLevel).toBe(3);
      expect(result.progress.playerLevel).toBe(3);
    });
  });

  describe("getUnlockablesForLevel", () => {
    it("returns correct unlockables for a given level", () => {
      const unlockables = getUnlockablesForLevel(2);
      expect(unlockables).toContain("dart-flight-classic");
    });

    it("accumulates unlockables from all lower levels", () => {
      const unlockables = getUnlockablesForLevel(4);
      expect(unlockables).toContain("dart-flight-classic");
      expect(unlockables).toContain("dart-barrel-reinforced");
      expect(unlockables).toContain("dart-flight-aero");
    });

    it("returns empty array for level 1", () => {
      expect(getUnlockablesForLevel(1)).toEqual([]);
    });
  });
});

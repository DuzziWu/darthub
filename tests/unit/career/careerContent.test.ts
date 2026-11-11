import { describe, expect, it } from "vitest";
import { createQuestLoaderService } from "@/career/questLoader";
import { validateQuest } from "@/career/questSchema";

const QUEST_DIR = "src/career/quests";

describe("careerContent", () => {
  describe("intro quest", () => {
    it("loads the intro quest and returns correct dialog data", async () => {
      const loader = createQuestLoaderService(QUEST_DIR);
      await loader.load();

      const intro = loader.getQuestById("quest-intro");
      expect(intro).not.toBeUndefined();
      expect(intro!.name).toBe("First Flight");
      expect(intro!.description).toContain("Coach");
      expect(intro!.stages).toHaveLength(1);
      expect(intro!.stages[0]!.name).toBe("First Flight");
    });
  });

  describe("training lessons", () => {
    it("loads each training lesson and validates against the schema", async () => {
      const loader = createQuestLoaderService(QUEST_DIR);
      await loader.load();

      const lessons = [
        "quest-training-aiming-fundamentals",
        "quest-training-checkout-practice",
        "quest-training-double-out",
      ];

      for (const id of lessons) {
        const quest = loader.getQuestById(id);
        expect(quest, `Quest ${id} should exist`).not.toBeUndefined();
        const result = validateQuest(quest);
        expect(result.valid, `Quest ${id} should be valid`).toBe(true);
      }
    });
  });

  describe("XP rewards", () => {
    it("awards the expected XP based on quest rewards definition", async () => {
      const loader = createQuestLoaderService(QUEST_DIR);
      await loader.load();

      const xpByQuest: Record<string, number> = {
        "quest-intro": 100,
        "quest-training-aiming-fundamentals": 150,
        "quest-training-checkout-practice": 200,
        "quest-training-double-out": 300,
        "quest-rivalry-prodigy": 500,
      };

      for (const [id, expectedXp] of Object.entries(xpByQuest)) {
        const quest = loader.getQuestById(id);
        expect(quest, `Quest ${id} should exist`).not.toBeUndefined();
        expect(quest!.rewards.xp, `Quest ${id} should award ${expectedXp} XP`).toBe(expectedXp);
      }
    });
  });

  describe("quest chain", () => {
    it("references correct next quest chain (intro → training → rivalry)", async () => {
      const loader = createQuestLoaderService(QUEST_DIR);
      await loader.load();

      const chain = [
        "quest-intro",
        "quest-training-aiming-fundamentals",
        "quest-training-checkout-practice",
        "quest-training-double-out",
        "quest-rivalry-prodigy",
      ];

      // Verify each quest exists and has correct order
      for (let i = 0; i < chain.length; i++) {
        const quest = loader.getQuestById(chain[i]!);
        expect(quest, `Quest ${chain[i]} should exist`).not.toBeUndefined();
        expect(quest!.order, `Quest ${chain[i]} should have order ${i + 1}`).toBe(i + 1);
      }

      // Verify unlockedItems create the chain
      const intro = loader.getQuestById("quest-intro");
      expect(intro!.rewards.unlockedItems).toContain("quest-training-aiming-fundamentals");

      const aiming = loader.getQuestById("quest-training-aiming-fundamentals");
      expect(aiming!.rewards.unlockedItems).toContain("quest-training-checkout-practice");

      const checkout = loader.getQuestById("quest-training-checkout-practice");
      expect(checkout!.rewards.unlockedItems).toContain("quest-training-double-out");

      const doubleOut = loader.getQuestById("quest-training-double-out");
      expect(doubleOut!.rewards.unlockedItems).toContain("quest-rivalry-prodigy");

      // rivalry match unlocks a cosmetic reward, not a next quest
      const rivalry = loader.getQuestById("quest-rivalry-prodigy");
      expect(rivalry!.rewards.unlockedItems).toContain("avatar-veterans-cap");
    });
  });
});

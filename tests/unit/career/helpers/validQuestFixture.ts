import type { Quest } from "@/career/questSchema";

/**
 * A quest that satisfies the full schema (minus adaptive difficulty,
 * which specific tests add themselves). Used by quest schema and loader
 * unit tests.
 */
export const validQuestFixture: Quest = {
  id: "quest-first-checkout",
  name: "First Checkout",
  description: "Win your first match by checking out.",
  minLevel: 1,
  order: 1,
  stages: [
    {
      id: "stage-warm-up",
      name: "Warm Up",
      objectives: [
        {
          id: "obj-score-100",
          type: "turnScore",
          target: 100,
          description: "Score 100 or more in a single turn",
        },
        {
          id: "obj-win-1",
          type: "matchWins",
          target: 1,
          description: "Win one match",
        },
      ],
    },
  ],
  rewards: {
    xp: 100,
    coins: 50,
    unlockedItems: ["dart-flight-classic"],
  },
};

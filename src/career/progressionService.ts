/**
 * XP and level progression service for Career Mode.
 *
 * XP formula: level N requires 100 * N * 1.5 XP cumulative.
 * Level 1 = 100, Level 2 = 300 cumulative, Level 3 = 525, etc.
 */

import type { CareerQuestProgressRecord } from "./careerProgressRepository";

/** Cumulative XP required to reach a given level. */
export function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.floor(100 * l * 1.5);
  }
  return total;
}

/** XP needed to go from currentLevel to currentLevel + 1. */
export function xpRequiredForNextLevel(currentLevel: number): number {
  return Math.floor(100 * currentLevel * 1.5);
}

/** Milestone unlockables by level threshold. */
const LEVEL_UNLOCKABLES: Record<number, string[]> = {
  2: ["dart-flight-classic"],
  3: ["dart-barrel-reinforced"],
  4: ["dart-flight-aero"],
  5: ["avatar-frame-bronze"],
  6: ["sponsor-apparel-basic"],
  7: ["arena-flag-local"],
  8: ["dart-barrel-tungsten"],
  9: ["avatar-emote-thumbsup"],
  10: ["tournament-entry-regional"],
};

export function getUnlockablesForLevel(level: number): string[] {
  const unlockables: string[] = [];
  for (const [minLevel, items] of Object.entries(LEVEL_UNLOCKABLES)) {
    if (Number(minLevel) <= level) {
      unlockables.push(...items);
    }
  }
  return unlockables;
}

export interface XpAwardResult {
  progress: CareerQuestProgressRecord;
  leveledUp: boolean;
  newLevel: number;
  xpAwarded: number;
}

/**
 * Adds XP to a progress record, handling level-ups.
 * Returns the updated record plus whether a level boundary was crossed.
 */
export function awardXp(progress: CareerQuestProgressRecord, xpGained: number): XpAwardResult {
  let playerLevel = progress.playerLevel;
  let remainingXp = xpGained;

  while (remainingXp > 0) {
    const needed = xpRequiredForNextLevel(playerLevel);
    if (remainingXp >= needed) {
      remainingXp -= needed;
      playerLevel += 1;
    } else {
      break;
    }
  }

  const leveledUp = playerLevel > progress.playerLevel;
  return {
    progress: { ...progress, playerLevel, updatedAt: new Date() },
    leveledUp,
    newLevel: playerLevel,
    xpAwarded: xpGained,
  };
}

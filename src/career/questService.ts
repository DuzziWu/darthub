/**
 * Career quest service: the domain entry point for reading the current
 * quest state of a player and recording quest completions.
 *
 * Progress is persisted through a `CareerProgressRepository`, quest
 * definitions come from the JSON loader (task 020).
 */

import type { Quest } from "./questSchema";
import { createQuestLoaderService, type QuestLoader } from "./questLoader";
import {
  createEmptyProgress,
  type CareerProgressRepository,
  type CareerQuestProgressRecord,
} from "./careerProgressRepository";
import type { AdaptiveDifficultyEngine } from "./adaptiveEngine";
import type { AdaptiveDifficultyPolicy } from "./adaptiveDifficulty";
import { createDefaultAdaptiveDifficultyPolicy } from "./adaptiveDifficulty";

export interface QuestServiceDependencies {
  /** Defaults to the JSON loader over `src/career/quests`. */
  questLoader?: QuestLoader;
  progressRepository: CareerProgressRepository;
  /**
   * Task 021 seam: per-quest policy, the legacy hook. Defaults to
   * `createDefaultAdaptiveDifficultyPolicy()` when omitted. Ignored
   * when `adaptiveEngine` is present.
   */
  adaptiveDifficultyPolicy?: AdaptiveDifficultyPolicy;
  /**
   * Task 022: adaptive difficulty engine fed by quest completions. When
   * present it supersedes `adaptiveDifficultyPolicy`: it tracks win/loss
   * streaks and produces the persisted per-user difficulty adjustment.
   * Must share the same `progressRepository` so its persisted streaks
   * and adjustments are visible to the service.
   */
  adaptiveEngine?: AdaptiveDifficultyEngine;
}

export interface CurrentQuestResult {
  quest: Quest | null;
  progress: CareerQuestProgressRecord;
}

/** How the player fared while completing the quest. */
export interface QuestOutcome {
  won: boolean;
}

export interface QuestCompletionResult {
  progress: CareerQuestProgressRecord;
  /** The quest unlocked by this completion, or null when none remain. */
  nextQuest: Quest | null;
}

/** Thrown when a completion is reported for an unknown quest ID. */
export class QuestNotFoundError extends Error {
  constructor(questId: string) {
    super(`Unknown quest ID: ${questId}`);
    this.name = "QuestNotFoundError";
  }
}

export interface QuestService {
  getCurrentQuest(userId: string): Promise<CurrentQuestResult>;
  completeQuest(
    userId: string,
    questId: string,
    outcome: QuestOutcome,
  ): Promise<QuestCompletionResult>;
}

export function createQuestService(deps: QuestServiceDependencies): QuestService {
  const questLoader = deps.questLoader ?? createQuestLoaderService();
  const adaptiveDifficultyPolicy =
    deps.adaptiveDifficultyPolicy ?? createDefaultAdaptiveDifficultyPolicy();

  return {
    async getCurrentQuest(userId: string): Promise<CurrentQuestResult> {
      await questLoader.load();
      const progress =
        (await deps.progressRepository.findByUserId(userId)) ?? createEmptyProgress(userId);
      const quest = questLoader.getNextQuest(progress.playerLevel, progress.completedQuestIds);
      return { quest, progress };
    },

    async completeQuest(
      userId: string,
      questId: string,
      outcome: QuestOutcome,
    ): Promise<QuestCompletionResult> {
      await questLoader.load();
      const knownQuest = questLoader.getQuestById(questId);
      if (knownQuest === undefined) {
        throw new QuestNotFoundError(questId);
      }

      const progress =
        (await deps.progressRepository.findByUserId(userId)) ?? createEmptyProgress(userId);
      if (!progress.completedQuestIds.includes(questId)) {
        progress.completedQuestIds.push(questId);
      }

      // Quest selection depends only on level + completed quests, so the
      // upcoming quest is known before streaks are applied; the adaptive
      // engine uses its flags for the adjustment.
      const nextQuest = questLoader.getNextQuest(progress.playerLevel, progress.completedQuestIds);

      if (deps.adaptiveEngine !== undefined) {
        const engineResult = await deps.adaptiveEngine.recordResult({
          userId,
          questId,
          won: outcome.won,
          ...(nextQuest === null ? {} : { quest: nextQuest }),
        });
        progress.winStreak = engineResult.winStreak;
        progress.lossStreak = engineResult.lossStreak;
        progress.difficultyTier = engineResult.tier;
        progress.difficultyAdjustment = engineResult.adjustment;
        progress.effectiveTargetAdjustment = engineResult.adjustment;
      } else {
        if (outcome.won) {
          progress.winStreak += 1;
          progress.lossStreak = 0;
        } else {
          progress.lossStreak += 1;
          progress.winStreak = 0;
        }
        progress.effectiveTargetAdjustment =
          nextQuest === null
            ? 0
            : adaptiveDifficultyPolicy.effectiveAdjustment({
                quest: nextQuest,
                winStreak: progress.winStreak,
                lossStreak: progress.lossStreak,
              });
      }

      progress.currentQuestId = nextQuest === null ? null : nextQuest.id;
      progress.updatedAt = new Date();

      const saved = await deps.progressRepository.save(progress);
      return { progress: saved, nextQuest };
    },
  };
}

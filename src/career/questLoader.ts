/**
 * Quest loader service.
 *
 * Reads JSON quest definitions from a quests directory, validates each
 * file against the quest schema, and caches the in-memory registry.
 * `load()` is idempotent: repeated calls return without re-reading once
 * the cache is populated.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, join, resolve } from "node:path";
import { validateQuest, type Quest } from "./questSchema";

const DEFAULT_QUESTS_DIR = fileURLToPath(new URL("./quests", import.meta.url));
const QUEST_FILE_PATTERN = /\.json$/u;

export interface QuestLoader {
  /** Read and validate all quest JSON files. Idempotent. */
  load(): Promise<void>;
  isLoaded(): boolean;
  getQuests(): Quest[];
  getQuestById(id: string): Quest | undefined;
  /**
   * Next quest to offer a player at the given level: the lowest-`order`
   * quest that is unlocked (`minLevel <= playerLevel`) and not yet
   * completed. Returns null when no such quest exists.
   */
  getNextQuest(playerLevel: number, completedQuestIds?: string[]): Quest | null;
}

function readQuestFile(filePath: string): Quest {
  const fileName = basename(filePath);
  const raw = readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const result = validateQuest(parsed);
  if (!result.valid) {
    throw new Error(`Invalid quest JSON (${fileName}): ${result.errors.join("; ")}`);
  }
  return result.quest;
}

function readQuestsFromDir(questsDir: string): Quest[] {
  const questFiles = readdirSync(questsDir)
    .filter((entry) => QUEST_FILE_PATTERN.test(entry))
    .sort();

  return questFiles.map((entry) => readQuestFile(join(questsDir, entry)));
}

export function createQuestLoaderService(questsDir: string = DEFAULT_QUESTS_DIR): QuestLoader {
  let cache: Quest[] | null = null;

  return {
    async load(): Promise<void> {
      if (cache !== null) {
        return;
      }
      cache = readQuestsFromDir(resolve(questsDir)).sort((a, b) => a.order - b.order);
    },
    isLoaded(): boolean {
      return cache !== null;
    },
    getQuests(): Quest[] {
      if (cache === null) {
        throw new Error("Quests not loaded: call load() first");
      }
      return cache;
    },
    getQuestById(id: string): Quest | undefined {
      if (cache === null) {
        throw new Error("Quests not loaded: call load() first");
      }
      return cache.find((quest) => quest.id === id);
    },
    getNextQuest(playerLevel: number, completedQuestIds: string[] = []): Quest | null {
      const completed = new Set(completedQuestIds);
      return (
        this.getQuests()
          .filter((quest) => quest.minLevel <= playerLevel)
          .find((quest) => !completed.has(quest.id)) ?? null
      );
    },
  };
}

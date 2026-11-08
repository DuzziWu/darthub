import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createQuestLoaderService } from "@/career/questLoader";
import { validQuestFixture } from "./helpers/validQuestFixture";

const tempDirs: string[] = [];

function writeTempQuestDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "darthub-quests-"));
  tempDirs.push(dir);
  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(dir, fileName), JSON.stringify(content));
  }
  return dir;
}

function secondQuest(): Record<string, unknown> {
  return {
    ...validQuestFixture,
    id: "quest-double-in",
    minLevel: 5,
    order: 2,
  };
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("questLoader", () => {
  it("provides a function to fetch next quest based on player level", async () => {
    const questsDir = writeTempQuestDir({
      "a.json": validQuestFixture,
      "b.json": secondQuest(),
      "c.json": {
        ...validQuestFixture,
        id: "quest-treble-top",
        minLevel: 10,
        order: 3,
      },
    });
    const loader = createQuestLoaderService(questsDir);
    await loader.load();

    // Level 1, nothing completed: first quest in order.
    expect(loader.getNextQuest(1, [])?.id).toBe("quest-first-checkout");

    // First quest completed: next eligible quest in order.
    expect(loader.getNextQuest(5, ["quest-first-checkout"])?.id).toBe("quest-double-in");

    // Level too low for remaining quests: nothing is offered.
    expect(loader.getNextQuest(1, ["quest-first-checkout"])).toBeNull();

    // All eligible quests completed: null.
    expect(
      loader.getNextQuest(20, ["quest-first-checkout", "quest-double-in", "quest-treble-top"]),
    ).toBeNull();
  });

  it("loads quests into memory on app start", async () => {
    const questsDir = writeTempQuestDir({
      "sample.json": validQuestFixture,
      "double-in.json": secondQuest(),
    });
    const loader = createQuestLoaderService(questsDir);

    expect(loader.isLoaded()).toBe(false);

    await loader.load();

    expect(loader.isLoaded()).toBe(true);
    expect(loader.getQuests()).toHaveLength(2);
    expect(loader.getQuestById("quest-first-checkout")?.minLevel).toBe(1);
    expect(loader.getQuestById("quest-double-in")?.minLevel).toBe(5);
    expect(loader.getQuestById("unknown")).toBeUndefined();
  });

  it("is idempotent: repeated load() calls keep a single cache", async () => {
    const questsDir = writeTempQuestDir({ "sample.json": validQuestFixture });
    const loader = createQuestLoaderService(questsDir);

    await loader.load();
    await loader.load();
    await loader.load();

    expect(loader.getQuests()).toHaveLength(1);
  });

  it("rejects a quests directory containing invalid quest JSON", async () => {
    const questsDir = writeTempQuestDir({ "bad.json": { id: "nope" } });
    const loader = createQuestLoaderService(questsDir);

    await expect(loader.load()).rejects.toThrow(/bad\.json/);
  });
});

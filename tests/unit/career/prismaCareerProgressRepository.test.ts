import { describe, expect, it } from "vitest";
import {
  createPrismaCareerProgressRepository,
  type PrismaCareerProgressDelegate,
  type CareerQuestProgressRow,
} from "@/career/repositories/prismaCareerProgressRepository";
import { createEmptyProgress } from "@/career/careerProgressRepository";

function fakeDelegate(rows: Map<string, CareerQuestProgressRow>): PrismaCareerProgressDelegate {
  return {
    async findUnique({ where }) {
      const row = rows.get(where.userId);
      return row === undefined ? null : { ...row };
    },
    async upsert({ where, create }) {
      const existing = rows.get(where.userId);
      const next = {
        ...(existing ?? create),
        completedQuestIds: [...create.completedQuestIds],
        updatedAt: new Date(),
      };
      rows.set(where.userId, next);
      return { ...next };
    },
  };
}

describe("prismaCareerProgressRepository", () => {
  it("reads a user's progress from the Prisma delegate", async () => {
    const rows = new Map<string, CareerQuestProgressRow>();
    const repo = createPrismaCareerProgressRepository(fakeDelegate(rows));

    expect(await repo.findByUserId("ghost")).toBeNull();

    const stored = createEmptyProgress("user-1");
    stored.completedQuestIds = ["quest-first-checkout"];
    await repo.save(stored);

    const found = await repo.findByUserId("user-1");
    expect(found?.completedQuestIds).toEqual(["quest-first-checkout"]);
  });

  it("upserts progress so completions survive a restart", async () => {
    const rows = new Map<string, CareerQuestProgressRow>();
    const repo = createPrismaCareerProgressRepository(fakeDelegate(rows));

    const first = await repo.save(createEmptyProgress("user-1"));
    const second = { ...first, completedQuestIds: ["quest-a"] };
    await repo.save(second);

    const persisted = await repo.findByUserId("user-1");
    expect(persisted?.completedQuestIds).toEqual(["quest-a"]);
  });
});

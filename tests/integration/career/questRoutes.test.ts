import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createQuestService } from "@/career/questService";
import { createQuestLoaderService } from "@/career/questLoader";
import { createInMemoryCareerProgressRepository } from "@/career/careerProgressRepository";
import { createBearerTokenAuthGateway } from "@/career/auth/authGateway";
import { createCareerQuestRouteHandlers } from "@/career/questRoutes";
import { validQuestFixture } from "../../unit/career/helpers/validQuestFixture";

const tempDirs: string[] = [];

function writeTempQuestDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "darthub-career-api-"));
  tempDirs.push(dir);
  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(dir, fileName), JSON.stringify(content));
  }
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const secondQuest = {
  ...validQuestFixture,
  id: "quest-double-in",
  minLevel: 1,
  order: 2,
};

function buildDependencies(questFiles?: Record<string, unknown>) {
  const progressRepository = createInMemoryCareerProgressRepository();
  const questService = createQuestService({
    questLoader: createQuestLoaderService(
      writeTempQuestDir(questFiles ?? { "a.json": validQuestFixture }),
    ),
    progressRepository,
  });
  return {
    progressRepository,
    questService,
    authGateway: createBearerTokenAuthGateway(async (token) =>
      token === "known-token" ? "user-1" : null,
    ),
  };
}

function request(method: "GET" | "POST", body?: unknown, token?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token !== undefined) {
    headers.authorization = `Bearer ${token}`;
  }
  return new Request("http://localhost/api/career/quest", {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("career quest API routes", () => {
  it("respects user authentication", async () => {
    const deps = buildDependencies();
    const { GET, POST } = createCareerQuestRouteHandlers(deps);

    const unauthenticatedGet = await GET(request("GET"));
    expect(unauthenticatedGet.status).toBe(401);

    const unauthenticatedPost = await POST(request("POST", { questId: validQuestFixture.id }));
    expect(unauthenticatedPost.status).toBe(401);

    const unauthorizedToken = await GET(request("GET", undefined, "bad-token"));
    expect(unauthorizedToken.status).toBe(401);

    const authenticatedGet = await GET(request("GET", undefined, "known-token"));
    expect(authenticatedGet.status).toBe(200);
    expect(((await authenticatedGet.json()) as { user: string }).user).toBe("user-1");
  });

  it("returns the current quest for an authenticated user", async () => {
    const deps = buildDependencies({
      "a.json": validQuestFixture,
      "b.json": secondQuest,
    });
    const { GET } = createCareerQuestRouteHandlers(deps);

    const response = await GET(request("GET", undefined, "known-token"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      quest: { id: string; name: string } | null;
      progress: { currentQuestId: string | null };
    };
    expect(payload.quest?.id).toBe("quest-first-checkout");
    expect(payload.quest?.name).toBe(validQuestFixture.name);
    expect(payload.progress.currentQuestId).toBeNull();
  });

  it("completes a quest and unlocks the next one (full flow)", async () => {
    const deps = buildDependencies({
      "a.json": validQuestFixture,
      "b.json": secondQuest,
    });
    const { POST } = createCareerQuestRouteHandlers(deps);

    const response = await POST(
      request("POST", { questId: validQuestFixture.id, won: true }, "known-token"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      progress: { completedQuestIds: string[]; currentQuestId: string | null };
      nextQuest: { id: string } | null;
    };
    expect(payload.progress.completedQuestIds).toContain("quest-first-checkout");
    expect(payload.nextQuest?.id).toBe("quest-double-in");
    expect(payload.progress.currentQuestId).toBe("quest-double-in");
  });

  it("returns error status when the quest ID is invalid", async () => {
    const { POST } = createCareerQuestRouteHandlers(buildDependencies());

    const response = await POST(request("POST", { questId: "no-such-quest" }, "known-token"));
    expect(response.status).toBe(404);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("no-such-quest");
  });

  it("persists progression across a service restart", async () => {
    const deps = buildDependencies({
      "a.json": validQuestFixture,
      "b.json": secondQuest,
    });
    const { POST } = createCareerQuestRouteHandlers(deps);

    await POST(request("POST", { questId: validQuestFixture.id, won: true }, "known-token"));

    // Simulate a restart: a fresh set of route handlers built over the
    // same persistent repository must still see the completed state.
    const restarted = createCareerQuestRouteHandlers(deps);
    const response = await restarted.GET(request("GET", undefined, "known-token"));
    const payload = (await response.json()) as {
      progress: {
        completedQuestIds: string[];
        currentQuestId: string | null;
      };
    };
    expect(payload.progress.completedQuestIds).toContain("quest-first-checkout");
    expect(payload.progress.currentQuestId).toBe("quest-double-in");
  });

  it("rejects a malformed POST body", async () => {
    const { POST } = createCareerQuestRouteHandlers(buildDependencies());

    const response = await POST(request("POST", { wrong: "shape" }, "known-token"));
    expect(response.status).toBe(400);
  });
});

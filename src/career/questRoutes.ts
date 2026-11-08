/**
 * App Router route handlers for the career quest API.
 *
 * The exported handlers stay thin: they authenticate via the
 * `AuthGateway` seam, then delegate everything to the quest service.
 * Handler instances are created with `createCareerQuestRouteHandlers`
 * so tests can wire a fake gateway and an in-memory repository.
 */

import { QuestNotFoundError, type QuestService } from "@/career/questService";
import type { AuthGateway } from "@/career/auth/authGateway";

export interface QuestRouteHandlerDependencies {
  questService: QuestService;
  authGateway: AuthGateway;
}

export interface QuestRouteHandlers {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function createCareerQuestRouteHandlers(
  deps: QuestRouteHandlerDependencies,
): QuestRouteHandlers {
  const { questService, authGateway } = deps;

  return {
    async GET(request: Request): Promise<Response> {
      const user = await authGateway.getCurrentUser(request);
      if (user === null) {
        return unauthorized();
      }

      const { quest, progress } = await questService.getCurrentQuest(user);
      return Response.json(
        { user, quest, progress },
        {
          headers: { "cache-control": "no-store" },
        },
      );
    },

    async POST(request: Request): Promise<Response> {
      const user = await authGateway.getCurrentUser(request);
      if (user === null) {
        return unauthorized();
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const questId =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { questId?: unknown }).questId === "string"
          ? (body as { questId: string }).questId
          : null;
      const rawWon =
        typeof body === "object" && body !== null && "won" in body
          ? (body as { won: unknown }).won
          : undefined;
      if (questId === null) {
        return Response.json({ error: '"questId" (string) is required' }, { status: 400 });
      }
      if (rawWon !== undefined && typeof rawWon !== "boolean") {
        return Response.json({ error: '"won" must be a boolean when provided' }, { status: 400 });
      }
      // Completing a quest implies success unless the client says otherwise.
      const won = rawWon === undefined ? true : rawWon;

      try {
        const { progress, nextQuest } = await questService.completeQuest(user, questId, { won });
        return Response.json(
          { user, progress, nextQuest },
          { headers: { "cache-control": "no-store" } },
        );
      } catch (error) {
        if (error instanceof QuestNotFoundError) {
          return Response.json({ error: (error as Error).message }, { status: 404 });
        }
        throw error;
      }
    },
  };
}

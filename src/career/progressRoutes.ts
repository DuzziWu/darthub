/**
 * App Router route handlers for the career progress API.
 */

import type { QuestService } from "@/career/questService";
import type { AuthGateway } from "@/career/auth/authGateway";
import type { CareerProgressRepository } from "@/career/careerProgressRepository";
import {
  calculateXpForLevel,
  xpRequiredForNextLevel,
  getUnlockablesForLevel,
} from "@/career/progressionService";

export interface ProgressRouteHandlerDependencies {
  questService: QuestService;
  authGateway: AuthGateway;
  progressRepository: CareerProgressRepository;
}

export interface ProgressRouteHandlers {
  GET(request: Request): Promise<Response>;
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function createProgressRouteHandlers(
  deps: ProgressRouteHandlerDependencies,
): ProgressRouteHandlers {
  return {
    async GET(request: Request): Promise<Response> {
      const user = await deps.authGateway.getCurrentUser(request);
      if (user === null) {
        return unauthorized();
      }

      const { progress } = await deps.questService.getCurrentQuest(user);
      const cumulativeXp = calculateXpForLevel(progress.playerLevel);
      const nextLevelXp = xpRequiredForNextLevel(progress.playerLevel);
      const unlockables = getUnlockablesForLevel(progress.playerLevel);

      return Response.json(
        {
          user,
          playerLevel: progress.playerLevel,
          cumulativeXp,
          nextLevelXp,
          completedQuestIds: progress.completedQuestIds,
          currentQuestId: progress.currentQuestId,
          unlockables,
        },
        {
          headers: { "cache-control": "no-store" },
        },
      );
    },
  };
}

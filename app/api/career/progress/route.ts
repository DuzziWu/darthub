// GET /api/career/progress — the authenticated player's career progress.

import { defaultCareerQuestRuntime } from "@/career/questRuntime";
import { createProgressRouteHandlers } from "@/career/progressRoutes";

const { GET } = createProgressRouteHandlers({
  questService: defaultCareerQuestRuntime.questService,
  authGateway: defaultCareerQuestRuntime.authGateway,
  progressRepository: defaultCareerQuestRuntime.progressRepository,
});

export { GET };

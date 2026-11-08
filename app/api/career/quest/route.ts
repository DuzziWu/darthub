// GET /api/career/quest — the authenticated player's current quest.
// Thin handler: authentication and business logic live behind
// `AuthGateway` and `QuestService` respectively.

import { defaultCareerQuestRuntime } from "@/career/questRuntime";
import { createCareerQuestRouteHandlers } from "@/career/questRoutes";

const { GET } = createCareerQuestRouteHandlers({
  questService: defaultCareerQuestRuntime.questService,
  authGateway: defaultCareerQuestRuntime.authGateway,
});

export { GET };

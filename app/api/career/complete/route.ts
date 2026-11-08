// POST /api/career/complete — record a quest completion and unlock the
// next quest. Thin handler: authentication and business logic live
// behind `AuthGateway` and `QuestService` respectively.

import { defaultCareerQuestRuntime } from "@/career/questRuntime";
import { createCareerQuestRouteHandlers } from "@/career/questRoutes";

const { POST } = createCareerQuestRouteHandlers({
  questService: defaultCareerQuestRuntime.questService,
  authGateway: defaultCareerQuestRuntime.authGateway,
});

export { POST };

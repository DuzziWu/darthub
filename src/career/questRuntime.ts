/**
 * Default runtime wiring for the career quest API routes.
 *
 * Both `GET /api/career/quest` and `POST /api/career/complete` share a
 * single quest service so progress is consistent between endpoints.
 *
 * NOTE: persistence currently uses the in-memory repository because the
 * Prisma `CareerQuestProgress` model (task 002) is still in flight —
 * progress survives service restarts through the shared repository
 * instance only. See `careerProgressRepository` and task 022/002 for
 * the Prisma swap. Real authentication is wired in task 003; until then
 * the bearer gateway denies anonymous requests.
 */

import { createQuestService, type QuestService } from "@/career/questService";
import {
  createInMemoryCareerProgressRepository,
  type CareerProgressRepository,
} from "@/career/careerProgressRepository";
import { createBearerTokenAuthGateway, type AuthGateway } from "@/career/auth/authGateway";

export interface CareerQuestRuntime {
  questService: QuestService;
  authGateway: AuthGateway;
  progressRepository: CareerProgressRepository;
}

export function createDefaultCareerQuestRuntime(): CareerQuestRuntime {
  const progressRepository = createInMemoryCareerProgressRepository();
  return {
    progressRepository,
    questService: createQuestService({ progressRepository }),
    authGateway: createBearerTokenAuthGateway(),
  };
}

export const defaultCareerQuestRuntime = createDefaultCareerQuestRuntime();

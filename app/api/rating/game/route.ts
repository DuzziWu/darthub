// POST /api/rating/game — record a finished game and apply the Elo +
// performance updates for both participants. Thin handler: authentication
// and business logic live behind the `AuthGateway` seam and
// `RatingService`.

import { defaultRatingRuntime } from "@/rating/ratingRuntime";
import { createRatingRouteHandlers } from "@/rating/ratingRoutes";

const { POST } = createRatingRouteHandlers({
  ratingService: defaultRatingRuntime.ratingService,
  authGateway: defaultRatingRuntime.authGateway,
});

export { POST };

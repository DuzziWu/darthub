// GET /api/rating/:userId — read both ratings for one user (per mode via
// the `mode` query parameter, or the default mode plus per-mode rows).
// Thin handler: authentication and business logic live behind the
// `AuthGateway` seam and `RatingService`.

import { defaultRatingRuntime } from "@/rating/ratingRuntime";
import { createRatingRouteHandlers } from "@/rating/ratingRoutes";

const { GET } = createRatingRouteHandlers({
  ratingService: defaultRatingRuntime.ratingService,
  authGateway: defaultRatingRuntime.authGateway,
});

export { GET };

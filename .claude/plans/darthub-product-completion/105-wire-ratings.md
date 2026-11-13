# Task 105: Wire ratings into the match and the dashboard

**Status**: pending
**Depends on**: 101, 102
**Retry count**: 0

## Description
The rating system is fully implemented and tested — hybrid Elo plus performance, stored per game mode, applied through `POST /api/rating/game` — and no page in the application calls it. The dashboard shows a hard-coded "No completed matches yet." while never asking for anything. This task connects a finished match to the rating service and shows the player their actual rating.

## Context
- Related files: `app/api/rating/game/route.ts`, `app/api/rating/[userId]/route.ts`, `src/rating/ratingRoutes.ts`, `src/rating/ratingRuntime.ts`, `app/dashboard/page.tsx`, `src/components/game/GameResultBanner.tsx`, `src/components/x01/X01MatchView.tsx`, `src/game-engine/GameEngine.ts`
- `app/api/rating/game/route.ts` — `POST`, applies the Elo and performance update for a finished game. **Nothing calls it.**
- `app/api/rating/[userId]/route.ts` — `GET`, reads both ratings for one user, per mode. **Nothing calls it.**
- `src/rating/ratingRoutes.ts` — the handlers, built with injected services like the auth routes, so tests need no database.
- `app/dashboard/page.tsx` — a deliberate empty state: "No completed matches yet." and a link to `/game-center`. It never queries anything. The page's own comment explains the intent, and this task changes the intent, not just the rendering.
- `src/components/game/GameResultBanner.tsx` — renders the finished match. The engine reports completion, so the moment a match ends is known in the view.
- The rating routes are bearer-authenticated (`requireAuth`), so the client must send the session token — which task 102 provides.

## Requirements (Test Descriptions)
- [ ] `it records the result of a finished match against the signed-in player`
- [ ] `it does not record a result when the player is not signed in`
- [ ] `it does not record a result twice for the same match`
- [ ] `it shows the player rating on the dashboard`
- [ ] `it shows the rating for the mode the player played`
- [ ] `it shows an empty state on the dashboard when the player has no ratings`
- [ ] `it keeps the ratings of two modes apart`
- [ ] `it shows the rating change after a match`

## Acceptance Criteria
- Finishing a match as a signed-in player records the result through the real `/api/rating/game` route, and the player's rating changes.
- The dashboard shows the player's real rating, fetched from `/api/rating/[userId]`, with the empty state retained for a player who has none.
- The rating is recorded **once** per match, not on every re-render of the result banner.
- A guest without a registered account does not break the flow — the result is simply not recorded, and the UI does not pretend it was.
- Tests cover the record-and-display path against the injected repository, with no database.

## Implementation Notes

**Post the result exactly once.** The result banner renders when the match ends; a re-render (a state change elsewhere, a React strict-mode double render in development) must not post twice. Post from an effect keyed on the match id and the completion status, and guard with a ref that records which match id has already been reported. The "does not record a result twice" requirement exists precisely because this is easy to get wrong.

**Decide what a match result is, and use the engine's own numbers.** The rating service needs the participants and the winner. The engine's `MatchState` carries the players and the status, and the mode knows the winner. Use the engine's `isMatchComplete` and the winner it reports — never re-derive the winner from the score in the client. A guest's mirror user id is what a guest session carries (`progressUserId` in the claims), so a guest result could be recorded against the mirror user, but that user is anonymous and transient; do not record guest results.

**The dashboard needs the player's id.** The session token carries `sub` (the user id) for a user session, and `identityFromClaims` exposes it as `userId`. The dashboard is a server component, so it needs the session server-side. The auth session is a cookie (Auth.js) while the rating route wants a bearer token — the server-side path must be able to read the session and derive the same identity. Read the cookie session, or accept the bearer token on the dashboard's server fetch. Whichever is chosen, the identity must come from the **verified** token, not from a query parameter.

**Ratings are per mode.** The rating route takes the mode, and the rating rows are keyed by mode. The dashboard must show the ratings for a chosen mode, with a way to switch — the game centre lists five modes and each is rated separately. A single unswitchable number would misrepresent the model.

**Keep the empty state honest.** The current dashboard copy is careful and good: it says there is no completed match rather than showing four `--` tiles. That instinct must survive the change. When the player has no rating, show the empty state — not a zero.

**Do not recompute Elo in the client.** `src/rating/` owns the rating maths. The client sends the result; the server decides the new rating. The same rule as the realtime path in task 106: the client is a thin consumer of server-authoritative results.

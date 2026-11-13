# Task 106: Make the lobby real: matchmaking queue and room join

**Status**: pending
**Depends on**: 104
**Retry count**: 0

## Description
`/lobby` renders "Find Match" and "Create Room" as bare buttons with no handlers, and the matchmaking and room machinery behind them is implemented but unreachable from a browser. `socket.io-client` is a dependency that only the tests import. This task connects the lobby to the real server: queue, pair, join a room, and play a match through the server-authoritative path.

## Context
- Related files: `app/lobby/page.tsx`, `src/realtime/matchmaking.ts`, `src/realtime/socketServer.ts`, `src/realtime/types.ts`, `src/realtime/GameRoom.ts`, `src/realtime/inviteService.ts`, `src/components/game/MatchLayout.tsx`, `src/components/game/ScoreDisplay.tsx`, `src/components/x01/X01MatchView.tsx`
- `app/lobby/page.tsx` — two `<button>` elements, no `onClick`, no handler, no socket. The page's own comment says the room list is "real server state" and that there is "no room to show" because the multiplayer backend is "not part of this plan". That comment becomes false with this task — update it.
- `src/realtime/matchmaking.ts` — the queue. `src/realtime/roomStoreFactory.ts` — the store. `src/realtime/socketServer.ts` — the Socket.IO wiring, which owns seat assignment, turn order and throw validation.
- `src/realtime/types.ts` — `REALTIME_EVENTS`, `Ack`, `ErrorCode`. This is the event contract the client must speak.
- `src/realtime/inviteService.ts` — invite codes for private rooms.
- `src/components/x01/X01MatchView.tsx` — the local match view. It owns a `GameEngine` and renders `MatchState`. This is the structural model for the multiplayer view: the client renders server state rather than recomputing it.
- `src/realtime/antiCheatMiddleware.ts` — validates every throw server-side.

## Requirements (Test Descriptions)
- [ ] `it sends a player to the matchmaking queue when find match is clicked`
- [ ] `it shows the searching state while the player is queued`
- [ ] `it enters the room when the server reports a pairing`
- [ ] `it leaves the queue when the player cancels`
- [ ] `it lists the open public rooms`
- [ ] `it creates a private room and shows its invite code`
- [ ] `it joins a private room with an invite code`
- [ ] `it renders the room the server assigns`
- [ ] `it shows the players seated in the room`
- [ ] `it sends a throw to the server and renders the server state`
- [ ] `it refuses a throw the server rejects`
- [ ] `it re-renders the score from the server state, not from a local calculation`

## Acceptance Criteria
- Clicking "Find Match" queues the player on the real server and the UI reflects the queued state.
- Two queued players are paired into a room and both clients enter it.
- A private room can be created, its code shared, and the other player joined by that code.
- A throw is validated by the server; the client renders the server's resulting state.
- The client never computes the score locally in the multiplayer path.
- The lobby's existing empty state is replaced with real content; no button remains inert.

## Implementation Notes

**This is the largest task in the plan. Hold the scope.** The deliverable is: queue → pair → join → play one match. Anything beyond that — spectator mode, reconnection UX, chat, ranked matchmaking preferences, friend invites from the lobby — is out of scope and belongs in a later plan. The risk in this task is not doing it wrong; it is doing all of it.

**Build the client as a thin consumer of `REALTIME_EVENTS`.** The event names, the ack envelope (`{ ok: true, data }` / `{ ok: false, error }`) and the error codes are already defined in `src/realtime/types.ts`. Read that file first and write the client against it. Do not invent parallel event names.

**Do not port the scoring logic into the client.** The server validates a throw through `antiCheatMiddleware` and owns the authoritative `MatchState`. The client sends the intent ("player X threw 20") and renders what comes back. A client-side engine that computes a different score would defeat the entire server-authoritative design that `src/realtime/` exists to provide.

**Reuse the presentational components rather than building new ones.** `MatchLayout`, `ScoreDisplay`, `ThrowInputPad`, `MatchStatus`, `VisitChips` and `GameResultBanner` already render a match. The multiplayer view needs a component that owns the socket connection and maps the server's `MatchState` into those components — not a second set of match components. `X01MatchView` is the closest existing model, because it also owns a `GameEngine` and renders `MatchState`; the multiplayer version owns a socket instead.

**Extract the socket client into its own module.** A `useRealtimeMatch` hook (or a small client class) that owns the connection, the event subscriptions and the ack handling. The view components then stay presentational, and the socket logic is testable without a browser. `socket.io-client` is already a dependency, so this adds no package weight.

**The lobby needs the session token.** Task 104 authenticates the handshake, so the client must supply the token it got from the login flow (task 102). The lobby is therefore a client component — it opens the socket. This is the first page that must be `"use client"` for a reason other than local state.

**The room list must come from the server.** The page's current comment claims "The room list is real server state" while rendering a hard-coded "No public rooms right now." Either make the comment true — by fetching the real list — or remove the claim. The registry (`src/realtime/RoomRegistry.ts`) and the room store are where the list comes from.

**Handle the failure paths explicitly.** A socket that cannot connect, a queue that times out, a room that is full, a throw the server rejects. Each must produce a visible state, not a silent no-op. The `ErrorCode` values in `src/realtime/types.ts` exist for exactly this.

**The matchmaking flow is worth an integration test at the socket level** — two real `socket.io-client` instances, a real server, a real pairing — following the pattern already established in `tests/integration/realtime/socketServer.test.ts` and its `helpers.ts`. That is far more valuable than a browser test that mocks the socket, and it is where the correctness risk actually lives.

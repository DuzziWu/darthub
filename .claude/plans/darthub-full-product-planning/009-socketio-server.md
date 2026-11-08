# Task 009: Setup Socket.IO server with authoritative game loop

**Status**: completed
**Depends on**: 001, 035
**Retry count**: 0

## Description
Create a dedicated Node.js real‑time server (outside of Next.js API routes) that uses Socket.IO to manage game rooms, enforce server authority over game state, and broadcast updates. The server will be started via a custom entry point (e.g., `src/realtime/server.ts`) and run alongside the Next.js app in Docker.

## Context
- Files: `src/realtime/socketServer.ts`, `src/realtime/gameEngine.ts`.
- Follow the service‑class pattern and inject the AI engine where needed.

## Requirements (Test Descriptions)
- [x] `it establishes a Socket.IO connection and acknowledges client` — verified in `tests/integration/realtime/socketServer.test.ts`; server emits `realtime:welcome` with `socketId` before the handshake completes (listener registered pre-connect to avoid a race).
- [x] `it creates a private room and only allows invited sockets` — verified: `room:create` returns roomCode/inviteCode/playerId/playerToken; join with a wrong invite code is rejected with stable code `invalidInvite` (secrets never leaked in the error text); join with the correct invite code receives a distinct seat.
- [x] `it validates incoming throw data on the server side` — verified: non-numeric/out-of-range/non-integer points, missing roomCode and client-supplied `playerId` are all rejected with `invalidThrow` without any state change (`state:request` shows `throwCount 0`); out-of-turn throws are rejected with `notYourTurn` (turn order enforced via the seat bound server-side, never trusting the client).
- [x] `it updates game state and broadcasts to all participants` — verified: after host throws 3 darts (10/20/30), both host ack state and guest-received `state:update` show `throwCount 3`, host `totalPoints 60`, and `currentPlayerId` = guest.
- [x] `it handles client disconnect and allows reconnection to same room` — verified: after guest disconnect, rejoin with roomCode+inviteCode+playerToken restores the same playerId seat, match state survives (`inProgress`, `throwCount 1`), and the reconnected socket receives subsequent broadcasts. Unknown tokens on a running match are rejected with `matchAlreadyStarted`.

## Acceptance Criteria
- Integration tests with a mock Socket.IO client pass. (7/7 pass, see Implementation Notes.)
- Server logs minimal info and does not expose internal state. (Logs contain only socket ids / room codes; error acks never contain invite codes, tokens, or state dumps.)

## Implementation Notes
- Server code lives in `src/realtime/`: `server.ts` (+ entry point, `createRealtimeServer` factory, `start()` when run directly), `socketServer.ts` (Socket.IO wiring, per-socket authoritative seat bindings), `GameRoom.ts` (private room: roster, invite gate, tokens, room lifecycle), `GameStateMachine.ts` (wraps the real `@/game-engine` `GameEngine` from task 035 — startMatch/recordThrow are delegated, no game rules reimplemented), `RoomRegistry.ts` (in-memory room lookup; swap seam for later persistence tasks 046/047), `ids.ts` (room codes from `node:crypto`), `types.ts` (event names, `Ack<T>` envelopes, error codes, `AIProvider` seam), `index.ts` (barrel).
- Events: `realtime:welcome` (server→client), `room:create`, `room:join`, `match:start`, `throw:record`, `state:request`, `state:update` (server→room broadcast). All client→server events use acknowledgement envelopes (`{ok:true,data}` / `{ok:false,error,code}`) with stable error codes (`invalidThrow`, `notYourTurn`, `invalidInvite`, `roomNotFound`, `matchAlreadyStarted`, `notAuthorized`, `roomFull`, `invalidPayload`).
- Server authority: identity/seat binding is server-side (`Map<Socket, {room, player}>`); clients never send their playerId (payloads containing `playerId` are rejected), and every throw re-validates points (integer 0..60) before hitting the engine, which validates again.
- Reconnection: join accepts an optional `playerToken` (secret per-seat, from crypto.randomBytes); a matching token reclaims the seat even after match start; unknown tokens cannot create new seats once a match started.
- AI seam for task 007: `AIProvider { selectThrowPoints(state) }` injected via `createRealtimeServer({ aiProvider })`; seats flagged `isAI` (host request `room:create {aiOpponent:true}`) get automatic turns executed and validated through the normal path (`aiSeam.test.ts` verifies 3 automatic darts). The `@/ai` module itself is never imported.
- Run standalone: `npm run realtime` (script added: `tsx src/realtime/server.ts`, tsx installed as devDependency; REALTIME_PORT env var overrides default 4000, binds 127.0.0.1, health endpoint `{status:"ok"}`). Dockerfile/docker-compose intentionally untouched (other task).
- Verification evidence (final):
  - `npx vitest run tests/integration/realtime tests/unit/realtime` → 2 files, 7 tests passed.
  - `npx tsc --noEmit` → no errors under `src/realtime`/`tests/integration/realtime` (remaining diffs in `src/ai` belong to the parallel task 007 worker).
  - `npx eslint src/realtime tests/integration/realtime` → clean; `npx prettier --check` → clean.
  - Smoke test: `npx tsx src/realtime/server.ts` + health `GET :4000/` + socket.io-client connect → OK, logs show only connection/room lifecycle lines.
- Logging contract: `logInfo` writes single-line messages to stdout (socket connect/disconnect, room created, request rejected codes) — no state payloads, no tokens/invite codes, no match state dumps.

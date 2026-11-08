/**
 * Entry point of the dedicated DartHub realtime server.
 *
 * Creates an HTTP server (health endpoint) with a Socket.IO server
 * attached, fully independent from the Next.js request pipeline. Run it
 * standalone with:
 *
 *   npx tsx src/realtime/server.ts
 */
import { Server as HttpServer } from "node:http";
import { createSocketIoServer } from "@/realtime/socketServer";
import type { RealtimeServerOptions } from "@/realtime/types";

/** Information about a started realtime server. */
export interface RealtimeServer {
  httpServer: HttpServer;
  /** Stops accepting connections and closes the HTTP server. */
  stop: () => Promise<void>;
}

/** Creates (but does not yet listen on) the realtime server. */
export function createRealtimeServer(options: RealtimeServerOptions = {}): RealtimeServer {
  const httpServer = new HttpServer((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });

  createSocketIoServer(httpServer, options);

  return {
    httpServer,
    stop: () => new ServerStop(httpServer).run(),
  };
}

/** Helper that closes an HTTP server and waits for its shutdown. */
class ServerStop {
  constructor(private readonly httpServer: HttpServer) {}

  run(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

const PORT = Number(process.env.REALTIME_PORT ?? 4000);
const HOST = "127.0.0.1";

/** Starts the server and resolves once it is listening. */
export function start(): Promise<RealtimeServer> {
  const server = createRealtimeServer();
  return new Promise((resolve) => {
    server.httpServer.listen(PORT, HOST, () => {
      process.stdout.write(`[realtime] listening on ${HOST}:${PORT}\n`);
      resolve(server);
    });
  });
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("src/realtime/server.ts");
if (isDirectRun) {
  start().catch((error: unknown) => {
    process.stdout.write(`[realtime] failed to start: ${String(error)}\n`);
    process.exitCode = 1;
  });
}

// `pnpm db:local:bridge`: WebSocket → TCP, so the Neon driver (lib/db.ts) reaches the local cluster.
// Listens on 127.0.0.1:DB_LOCAL_BRIDGE_PORT (default 54321) and pipes each WebSocket to
// 127.0.0.1:<DATABASE_URL's port>. The preload (scripts/db-local-preload.mjs) points the driver here.
import { connect } from "node:net";

import { WebSocketServer } from "ws";

import { localDatabaseUrl } from "./db-local.mjs";

const url = localDatabaseUrl(process.env.DATABASE_URL);
if (!url) {
  console.error("db:local: DATABASE_URL must be set and its host must be localhost or 127.0.0.1");
  process.exit(2);
}
const pgPort = Number(url.port || 5432);
const port = Number(process.env.DB_LOCAL_BRIDGE_PORT || 54321);

const server = new WebSocketServer({ host: "127.0.0.1", port });
server.on("connection", (ws) => {
  const tcp = connect(pgPort, "127.0.0.1");
  ws.on("message", (data) => tcp.write(data));
  tcp.on("data", (data) => ws.send(data));
  ws.on("close", () => tcp.end());
  ws.on("error", () => tcp.destroy());
  tcp.on("close", () => ws.close());
  tcp.on("error", () => ws.terminate());
});
server.on("listening", () =>
  console.log(`db:local: bridge ws://127.0.0.1:${port} → 127.0.0.1:${pgPort}`),
);

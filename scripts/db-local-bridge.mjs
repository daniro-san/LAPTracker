// `pnpm db:local:bridge`: WebSocket → TCP, so the Neon driver (lib/db.ts) reaches the local cluster.
// Listens on 127.0.0.1:DB_LOCAL_BRIDGE_PORT (default 54321) and pipes each WebSocket to
// 127.0.0.1:<DATABASE_URL's port>. The preload (scripts/db-local-preload.mjs) points the driver here.
import { connect } from "node:net";

import { WebSocketServer } from "ws";

import { localDatabaseUrl } from "./db-local.mjs";

const url = localDatabaseUrl(process.env.DATABASE_URL);
if (!url) {
  console.error(
    "db:local: DATABASE_URL must be postgres://user:password@localhost[:port]/database (or 127.0.0.1), with no host, hostaddr or service parameter",
  );
  process.exit(2);
}
const pgPort = Number(url.port || 5432);
const port = Number(process.env.DB_LOCAL_BRIDGE_PORT || 54321);

// Refuse an upgrade that carries an Origin header: every browser sends one, so a web page cannot reach
// the database through the bridge. Node's WebSocket (the driver in tsx and in `next dev`) sends none.
const server = new WebSocketServer({
  host: "127.0.0.1",
  port,
  verifyClient: ({ origin }) => origin === undefined,
});
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

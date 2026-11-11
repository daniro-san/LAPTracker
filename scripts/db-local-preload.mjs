// `node --import ./scripts/db-local-preload.mjs`: send the Neon driver's WebSocket to the local bridge.
// `next dev` bundles its own copy of @neondatabase/serverless, so setting neonConfig here would not reach
// it; the driver opens `new WebSocket("wss://<host>/v2")` through the global, so the global is wrapped
// instead (issue 126, D47). Decided per connection, after Next has loaded .env.local: only when
// DATABASE_URL's host is exactly localhost or 127.0.0.1 and the socket goes to that host. Anything else
// passes through untouched.
import { URL } from "node:url";

import { localDatabaseUrl } from "./db-local.mjs";

const Native = globalThis.WebSocket;

globalThis.WebSocket = class LocalBridgeWebSocket extends Native {
  constructor(target, protocols) {
    const database = localDatabaseUrl(process.env.DATABASE_URL);
    const socket = new URL(target);
    if (database && socket.hostname === database.hostname && socket.pathname === "/v2") {
      target = `ws://127.0.0.1:${process.env.DB_LOCAL_BRIDGE_PORT || 54321}/v2`;
    }
    super(target, protocols);
  }
};

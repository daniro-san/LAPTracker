// Database connection. A Pool (WebSocket) rather than neon-http, because an alliance row and its
// members are written in one transaction. Open per run and close it in `finally` (serverless).
import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { getEnv } from "./env";
import * as schema from "./schema";

export type Db = NeonDatabase<typeof schema>;

/** A Pool's size and how long an idle connection stays open; the driver's defaults (10, 10 s) otherwise. */
export type PoolSize = { max: number; idleTimeoutMillis: number };

export function openDb(
  url: string = getEnv().DATABASE_URL,
  size?: PoolSize,
): {
  db: Db;
  close: () => Promise<void>;
} {
  const pool = new Pool({ connectionString: url, ...size });
  // An idle connection that fails (Neon drops the WebSocket) is emitted on the Pool. Unheard, Node throws
  // it as an uncaught exception and the instance ends every request it serves. A code only, no message.
  pool.on("error", () => console.info(JSON.stringify({ code: "db.pool.idle_error" })));
  return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
}

// Database connection. A Pool (WebSocket) rather than neon-http, because an alliance row and its
// members are written in one transaction. Open per run and close it in `finally` (serverless).
import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { getEnv } from "./env";
import * as schema from "./schema";

export type Db = NeonDatabase<typeof schema>;

export function openDb(url: string = getEnv().DATABASE_URL): {
  db: Db;
  close: () => Promise<void>;
} {
  const pool = new Pool({ connectionString: url });
  return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
}

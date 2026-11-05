// Whole-database facts for the Friday check (plan §3.1, §6.1).
import { sql } from "drizzle-orm";

import type { Db } from "../db";

export async function databaseSizeBytes(db: Db): Promise<number> {
  const result = await db.execute<{ bytes: string }>(
    sql`select pg_database_size(current_database())::text as bytes`,
  );
  return Number(result.rows[0]?.bytes ?? 0);
}

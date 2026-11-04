// auth_attempts table: the PIN/secret rate limiter's state (plan §12.2). Lives in Postgres because
// every serverless instance has its own module scope; nothing here is cached in memory.
import { eq, lt, sql } from "drizzle-orm";

import type { Db } from "../db";
import { authAttempts } from "../schema";

/** Rows older than the longest window (the global hour) carry no information. */
const PRUNE_AFTER_MS = 60 * 60_000;

/**
 * Counts one failure for `key` and returns the count inside the current window. One upsert, so two
 * concurrent failures both count; a window older than `windowMs` restarts at 1.
 */
export async function recordFailure(
  db: Db,
  key: string,
  windowMs: number,
  now: Date,
): Promise<number> {
  const windowStart = new Date(now.getTime() - windowMs);
  await db
    .delete(authAttempts)
    .where(lt(authAttempts.windowStart, new Date(now.getTime() - PRUNE_AFTER_MS)));
  const expired = sql`${authAttempts.windowStart} <= ${windowStart}`;
  const [row] = await db
    .insert(authAttempts)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: authAttempts.key,
      set: {
        count: sql`case when ${expired} then 1 else ${authAttempts.count} + 1 end`,
        windowStart: sql`case when ${expired} then ${now} else ${authAttempts.windowStart} end`,
      },
    })
    .returning({ count: authAttempts.count });
  return row?.count ?? 1;
}

/** Failures for `key` inside the window ending at `now`; 0 when the window has passed. */
export async function currentCount(
  db: Db,
  key: string,
  windowMs: number,
  now: Date,
): Promise<number> {
  const [row] = await db
    .select({ count: authAttempts.count, windowStart: authAttempts.windowStart })
    .from(authAttempts)
    .where(eq(authAttempts.key, key));
  if (!row || row.windowStart.getTime() <= now.getTime() - windowMs) return 0;
  return row.count;
}

export async function resetKey(db: Db, key: string): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.key, key));
}

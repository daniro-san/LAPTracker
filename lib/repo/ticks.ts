// tick_log table (D45): one heartbeat row per authorised tick. The insert keeps MAX_TICK_LOG rows.
import { desc, eq, lt } from "drizzle-orm";

import type { Db } from "../db";
import { tickLog } from "../schema";

/** About 7 days at 96 ticks a day. */
export const MAX_TICK_LOG = 700;

/** Writes the heartbeat before the tick does anything, and returns its id. */
export async function startTick(db: Db, at: Date): Promise<number> {
  const [row] = await db.insert(tickLog).values({ startedAt: at }).returning({ id: tickLog.id });
  if (!row) throw new Error("tick_log insert returned no row");
  // INVARIANT tick-log.capped-700: everything older than the newest 700 rows goes.
  const [oldestKept] = await db
    .select({ id: tickLog.id })
    .from(tickLog)
    .orderBy(desc(tickLog.id))
    .offset(MAX_TICK_LOG - 1)
    .limit(1);
  if (oldestKept) await db.delete(tickLog).where(lt(tickLog.id, oldestKept.id));
  return row.id;
}

export async function finishTick(db: Db, id: number, at: Date, outcome: string): Promise<void> {
  await db.update(tickLog).set({ finishedAt: at, outcome }).where(eq(tickLog.id, id));
}

/** The newest tick's start, or null when no tick has been recorded. */
export async function latestTickAt(db: Db): Promise<Date | null> {
  const [row] = await db
    .select({ at: tickLog.startedAt })
    .from(tickLog)
    .orderBy(desc(tickLog.id))
    .limit(1);
  return row?.at ?? null;
}

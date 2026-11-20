// The squads read's daily queue (D132, issue 472): one row per member of an alliance's quota day. Plain
// reads and writes; the rules are in lib/squads.ts and lib/squads-read.ts. Uids and counts only.
import { and, asc, eq, lte, sql } from "drizzle-orm";

import type { Db } from "../db";
import { squadQueue, squadReads } from "../schema-squads";

/** Adds the members the queue does not have yet, due at `dueAt`; a member already in it keeps its state. */
export async function queueMembers(
  db: Db,
  q: { day: string; unionId: number },
  uids: readonly number[],
  dueAt: Date,
): Promise<number> {
  if (uids.length === 0) return 0;
  const added = await db
    .insert(squadQueue)
    .values(uids.map((uid) => ({ ...q, uid, dueAt })))
    .onConflictDoNothing()
    .returning({ uid: squadQueue.uid });
  return added.length;
}

const waitingOf = (q: { day: string; unionId: number }) =>
  and(
    eq(squadQueue.day, q.day),
    eq(squadQueue.unionId, q.unionId),
    eq(squadQueue.state, "waiting"),
  );

/** The members whose turn has come, the longest waiting first: at most `limit`. */
export async function dueMembers(
  db: Db,
  q: { day: string; unionId: number },
  now: Date,
  limit: number,
): Promise<{ uid: number; attempts: number }[]> {
  return db
    .select({ uid: squadQueue.uid, attempts: squadQueue.attempts })
    .from(squadQueue)
    .where(and(waitingOf(q), lte(squadQueue.dueAt, now)))
    .orderBy(asc(squadQueue.dueAt), asc(squadQueue.uid))
    .limit(limit);
}

export interface MemberAfterCall {
  uid: number;
  state: "waiting" | "done" | "failed";
  attempts: number;
  dueAt: Date;
}

/**
 * One call's outcome, in one transaction: the day's counts (only while the batch still holds the claim,
 * `batch_at` = the time it claimed) and the member's row. False when a later caller took the claim over:
 * then neither is written.
 */
export async function saveCall(
  db: Db,
  q: { day: string; unionId: number; claimedAt: Date },
  counts: Partial<typeof squadReads.$inferInsert>,
  member: MemberAfterCall,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const kept = await tx
      .update(squadReads)
      .set(counts)
      .where(
        and(
          eq(squadReads.day, q.day),
          eq(squadReads.unionId, q.unionId),
          eq(squadReads.batchAt, q.claimedAt),
        ),
      )
      .returning({ day: squadReads.day });
    if (kept.length === 0) return false;
    const { uid, ...rest } = member;
    await tx
      .update(squadQueue)
      .set(rest)
      .where(
        and(eq(squadQueue.day, q.day), eq(squadQueue.unionId, q.unionId), eq(squadQueue.uid, uid)),
      );
    return true;
  });
}

/** One alliance's queue of one day in numbers (D132): for the batch's end, /admin and Settings. */
export interface QueueCounts {
  unionId: number;
  members: number;
  done: number;
  failed: number;
  waiting: number;
  /** Waiting after a failed call. */
  retrying: number;
  /** Waiting members whose turn has come. */
  dueNow: number;
  /** When the next waiting member's turn comes, if it is later than `now`. */
  nextAt: Date | null;
}

/** Every alliance's queue of `day` (or one alliance's), counted at `now`. */
export async function queueCounts(
  db: Db,
  day: string,
  now: Date,
  unionId?: number,
): Promise<QueueCounts[]> {
  const q = squadQueue;
  const waiting = sql`${q.state} = 'waiting'`;
  const rows = await db
    .select({
      unionId: q.unionId,
      members: sql<number>`count(*)`.mapWith(Number),
      done: sql<number>`count(*) filter (where ${q.state} = 'done')`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${q.state} = 'failed')`.mapWith(Number),
      waiting: sql<number>`count(*) filter (where ${waiting})`.mapWith(Number),
      retrying: sql<number>`count(*) filter (where ${waiting} and ${q.attempts} > 0)`.mapWith(
        Number,
      ),
      dueNow: sql<number>`count(*) filter (where ${waiting} and ${q.dueAt} <= ${now})`.mapWith(
        Number,
      ),
      nextAt: sql<Date | null>`min(${q.dueAt}) filter (where ${waiting} and ${q.dueAt} > ${now})`,
    })
    .from(q)
    .where(and(eq(q.day, day), unionId === undefined ? undefined : eq(q.unionId, unionId)))
    .groupBy(q.unionId);
  return rows.map((r) => ({ ...r, nextAt: r.nextAt === null ? null : new Date(r.nextAt) }));
}

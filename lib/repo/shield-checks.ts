// The Raid Shield check's rows (issue 474, D137): the check of a quota day, the morning read's queue (as
// D132's squad queue), the alliance's settings, and the tracker readings it shows. Plain reads and writes;
// the rules are in lib/shield-check.ts and lib/shield-read.ts. Uids, counts and shield columns only: the
// readings never select `raw_json` (D71).
import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { shieldChecks, shieldQueue, shieldSettings } from "../schema-shield";
import { playerReads } from "../schema-squads";
import type { MemberAfterCall } from "./squad-queue";

type Day = { day: string; unionId: number };
export type ShieldCheckRow = typeof shieldChecks.$inferSelect;

const one = (q: Day) => and(eq(shieldChecks.day, q.day), eq(shieldChecks.unionId, q.unionId));

export async function getShieldCheck(db: Db, q: Day): Promise<ShieldCheckRow | null> {
  const [row] = await db.select().from(shieldChecks).where(one(q)).limit(1);
  return row ?? null;
}

/** Friday's burst started: the first time is kept. */
export async function noteNight(db: Db, q: Day, now: Date): Promise<void> {
  await db
    .insert(shieldChecks)
    .values({ ...q, nightAt: now })
    .onConflictDoUpdate({
      target: [shieldChecks.day, shieldChecks.unionId],
      set: { nightAt: sql`coalesce(${shieldChecks.nightAt}, ${now})` },
    });
}

/**
 * The morning read's claim: the first caller starts it (`fresh`), a later one takes it when it is free or
 * its holder is older than `stale`. Null while another batch holds it, or once the read is over.
 */
export async function claimMorning(
  db: Db,
  q: Day,
  now: Date,
  stale: Date,
): Promise<{ row: ShieldCheckRow; fresh: boolean } | null> {
  await db.insert(shieldChecks).values(q).onConflictDoNothing();
  const free = or(isNull(shieldChecks.morningBatchAt), lt(shieldChecks.morningBatchAt, stale));
  const started = await db
    .update(shieldChecks)
    .set({ morningStatus: "running", morningStartedAt: now, morningBatchAt: now })
    .where(and(one(q), isNull(shieldChecks.morningStatus)))
    .returning();
  if (started[0]) return { row: started[0], fresh: true };
  const [row] = await db
    .update(shieldChecks)
    .set({ morningBatchAt: now })
    .where(and(one(q), eq(shieldChecks.morningStatus, "running"), free))
    .returning();
  return row ? { row, fresh: false } : null;
}

/** Writes the morning read's state while `claimedAt` still holds the claim; false when it was lost. */
export async function updateMorning(
  db: Pick<Db, "update">,
  q: Day & { claimedAt: Date },
  patch: Partial<typeof shieldChecks.$inferInsert>,
): Promise<boolean> {
  const rows = await db
    .update(shieldChecks)
    .set(patch)
    .where(and(one(q), eq(shieldChecks.morningBatchAt, q.claimedAt)))
    .returning({ day: shieldChecks.day });
  return rows.length > 0;
}

/** The summary message to edit next time, the text's hash (or `gone`), and the webhook's sha256 (D147). */
export async function keepMessage(
  db: Db,
  q: Day,
  message: { id: string; hash: string; hook: string },
  now: Date,
): Promise<void> {
  await db
    .update(shieldChecks)
    .set({
      messageId: message.id,
      messageHash: message.hash,
      messageHook: message.hook,
      postedAt: now,
    })
    .where(one(q));
}

const queued = (q: Day) => and(eq(shieldQueue.day, q.day), eq(shieldQueue.unionId, q.unionId));

export async function queueShield(db: Db, q: Day, uids: readonly number[], dueAt: Date) {
  if (uids.length === 0) return;
  await db
    .insert(shieldQueue)
    .values(uids.map((uid) => ({ ...q, uid, dueAt })))
    .onConflictDoNothing();
}

/** The morning queue's members whose turn has come, oldest first. */
export async function dueShield(db: Db, q: Day, now: Date, limit: number) {
  return db
    .select({ uid: shieldQueue.uid, attempts: shieldQueue.attempts })
    .from(shieldQueue)
    .where(and(queued(q), eq(shieldQueue.state, "waiting"), lte(shieldQueue.dueAt, now)))
    .orderBy(asc(shieldQueue.dueAt), asc(shieldQueue.uid))
    .limit(limit);
}

/** One morning call's outcome in one transaction, under the claim (as D132's `saveCall`). */
export async function saveShieldCall(
  db: Db,
  q: Day & { claimedAt: Date },
  counts: { morningCalls: number; morningQuotaRemaining: number | null },
  member: MemberAfterCall,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await updateMorning(tx, q, counts))) return false;
    const { uid, ...rest } = member;
    await tx
      .update(shieldQueue)
      .set(rest)
      .where(and(queued(q), eq(shieldQueue.uid, uid)));
    return true;
  });
}

/** Members still waiting in the morning queue, and how many of them are due at `now`. */
export async function shieldWaiting(db: Db, q: Day, now: Date) {
  const [row] = await db
    .select({
      waiting: sql<number>`count(*)`.mapWith(Number),
      due: sql<number>`count(*) filter (where ${shieldQueue.dueAt} <= ${now})`.mapWith(Number),
    })
    .from(shieldQueue)
    .where(and(queued(q), eq(shieldQueue.state, "waiting")));
  return row ?? { waiting: 0, due: 0 };
}

export type ShieldSettingsRow = typeof shieldSettings.$inferSelect;

export async function shieldSettingsOf(db: Db, workspaceId: number) {
  const [row] = await db
    .select()
    .from(shieldSettings)
    .where(eq(shieldSettings.workspaceId, workspaceId));
  return row ?? null;
}

export async function saveShieldSettings(db: Db, row: typeof shieldSettings.$inferInsert) {
  await db
    .insert(shieldSettings)
    .values(row)
    .onConflictDoUpdate({
      target: shieldSettings.workspaceId,
      set: {
        morningMinute: row.morningMinute,
        discord: row.discord,
        language: row.language,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt,
      },
    });
}

/** Every workspace's settings, for the tick. */
export async function allShieldSettings(db: Db): Promise<Map<number, ShieldSettingsRow>> {
  const rows = await db.select().from(shieldSettings);
  return new Map(rows.map((r) => [r.workspaceId, r]));
}

export interface StoredReading {
  uid: number;
  shielding: number | null;
  shieldType: number | null;
  mapAt: Date | null;
  readAt: Date;
  /** The game's language the tracker sent ("pt"), for Raid prep's message. */
  language: string | null;
}

/** Each member's newest tracker reading of the alliance read in [from, to): the shield columns only. */
export async function shieldReadings(
  db: Db,
  unionId: number,
  from: Date,
  to: Date,
): Promise<StoredReading[]> {
  const p = playerReads;
  return db
    .selectDistinctOn([p.uid], {
      uid: p.uid,
      shielding: p.shielding,
      shieldType: p.shieldType,
      mapAt: p.mapUpdatedAt,
      readAt: p.readAt,
      language: p.language,
    })
    .from(p)
    .where(and(eq(p.unionId, unionId), gte(p.readAt, from), lt(p.readAt, to)))
    .orderBy(p.uid, desc(p.readAt));
}

// garrison_plans (D121): one Undead Siege (an entry's week) with its own enemy might and its history, its
// garrison plan as officers left it, and the claim of its post to Discord. Plain reads and writes inside
// one workspace; the rules are in lib/private/garrison.ts.
import { and, desc, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { calendarEntries, garrisonPlans, type GarrisonPair } from "../schema";

export type GarrisonRow = typeof garrisonPlans.$inferSelect;
/** One siege: the workspace, the Undead Siege entry and the plan's Monday. */
export interface Siege {
  workspaceId: number;
  entryId: number;
  week: string;
}

const at = (s: Siege) =>
  and(
    eq(garrisonPlans.workspaceId, s.workspaceId),
    eq(garrisonPlans.entryId, s.entryId),
    eq(garrisonPlans.week, s.week),
  );
const target = [garrisonPlans.entryId, garrisonPlans.week];

export async function findPlan(db: Db, s: Siege): Promise<GarrisonRow | null> {
  const [row] = await db.select().from(garrisonPlans).where(at(s));
  return row ?? null;
}

/** The siege's row, made empty first when there is none (the post claims it). */
export async function ensurePlan(db: Db, s: Siege): Promise<GarrisonRow | null> {
  await db.insert(garrisonPlans).values(s).onConflictDoNothing();
  return findPlan(db, s);
}

/**
 * The newest enemy might saved for an earlier siege of the workspace: the next siege starts from it. A
 * deleted Calendar entry's sieges are left out (D123).
 */
export async function lastEnemyMight(
  db: Db,
  s: Siege,
): Promise<{ value: number; week: string } | null> {
  const [row] = await db
    .select({ value: garrisonPlans.enemyMight, week: garrisonPlans.week })
    .from(garrisonPlans)
    .innerJoin(calendarEntries, eq(calendarEntries.id, garrisonPlans.entryId))
    .where(
      and(
        eq(garrisonPlans.workspaceId, s.workspaceId),
        isNull(calendarEntries.deletedAt),
        lt(garrisonPlans.week, s.week),
        isNotNull(garrisonPlans.enemyMight),
      ),
    )
    .orderBy(desc(garrisonPlans.week), desc(garrisonPlans.id))
    .limit(1);
  return row?.value == null ? null : { value: row.value, week: row.week };
}

/**
 * Writes the siege's enemy might when its version is still `version`, and appends it to the history.
 * Null when another save came first.
 */
export async function saveEnemy(
  db: Db,
  s: Siege,
  version: number,
  value: number,
  by: number,
  now: Date,
): Promise<GarrisonRow | null> {
  const save = [{ value, by, at: now.toISOString() }];
  const set = {
    enemyMight: value,
    enemyRev: version + 1,
    enemyHistory: sql`${garrisonPlans.enemyHistory} || ${JSON.stringify(save)}::jsonb`,
  };
  const [row] =
    version === 0
      ? await db
          .insert(garrisonPlans)
          .values({ ...s, enemyMight: value, enemyRev: 1, enemyHistory: save })
          .onConflictDoUpdate({ target, set, setWhere: eq(garrisonPlans.enemyRev, 0) })
          .returning()
      : await db
          .update(garrisonPlans)
          .set(set)
          .where(and(at(s), eq(garrisonPlans.enemyRev, version)))
          .returning();
  return row ?? null;
}

/**
 * Writes the pairs, and the enemy might `t` they were made at, when the stored plan is still at `rev`
 * (0: not saved yet). Null when another save came first: the officer's version is stale.
 */
export async function savePlan(
  db: Db,
  s: Siege,
  rev: number,
  plan: { pairs: GarrisonPair[]; t: number | null },
  by: number,
  now: Date,
): Promise<GarrisonRow | null> {
  const set = {
    pairs: plan.pairs,
    pairsEnemyMight: plan.t,
    rev: rev + 1,
    savedBy: by,
    savedAt: now,
  };
  const [row] =
    rev === 0
      ? await db
          .insert(garrisonPlans)
          .values({ ...s, ...set })
          .onConflictDoUpdate({ target, set, setWhere: eq(garrisonPlans.rev, 0) })
          .returning()
      : await db
          .update(garrisonPlans)
          .set(set)
          .where(and(at(s), eq(garrisonPlans.rev, rev)))
          .returning();
  return row ?? null;
}

/**
 * Claims the plan's post for `requestId` (D100): only when no other request is posting it, or that one
 * started before `stuckBefore`. Null when it is not claimed.
 */
export async function claimPost(
  db: Db,
  id: number,
  post: { requestId: string; channel: "members" | "leaders"; by: number },
  now: Date,
  stuckBefore: Date,
): Promise<GarrisonRow | null> {
  const [row] = await db
    .update(garrisonPlans)
    .set({
      postRequestId: post.requestId,
      postStatus: "posting",
      postChannel: post.channel,
      postedBy: post.by,
      postedAt: now,
    })
    .where(
      and(
        eq(garrisonPlans.id, id),
        or(isNull(garrisonPlans.postRequestId), ne(garrisonPlans.postRequestId, post.requestId)),
        or(
          isNull(garrisonPlans.postStatus),
          ne(garrisonPlans.postStatus, "posting"),
          lt(garrisonPlans.postedAt, stuckBefore),
        ),
      ),
    )
    .returning();
  return row ?? null;
}

/** Ends the post claimed for `requestId`; a later claim by another request is left alone. */
export async function finishPost(
  db: Db,
  id: number,
  requestId: string,
  status: "posted" | "failed",
): Promise<void> {
  await db
    .update(garrisonPlans)
    .set({ postStatus: status })
    .where(
      and(
        eq(garrisonPlans.id, id),
        eq(garrisonPlans.postRequestId, requestId),
        eq(garrisonPlans.postStatus, "posting"),
      ),
    );
}

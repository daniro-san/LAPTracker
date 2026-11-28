// The raid opponent's rows (issue 861, D165): each workspace's opponent of a raid, kept when changed or
// cleared so Undo needs no call, and the raid's Start and End reads of both sides. Plain reads and writes;
// the rules are in lib/raid-opponent.ts. Totals and uid, might and kills arrays only: no member name.
import { and, desc, eq, getTableColumns, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import type { RaidPhase, RaidSideName } from "../raid-opponent";
import { dailyRosters } from "../schema";
import { raidOpponents, raidReads, shieldSettings } from "../schema-shield";

export type RaidOpponentRow = typeof raidOpponents.$inferSelect;
export type RaidReadRow = typeof raidReads.$inferSelect;

const current = (workspaceId: number, saturday: string) =>
  and(
    eq(raidOpponents.workspaceId, workspaceId),
    eq(raidOpponents.saturday, saturday),
    isNull(raidOpponents.clearedAt),
  );

/** The workspace's opponent of the raid of `saturday`, or null. */
export async function currentOpponent(
  db: Db,
  workspaceId: number,
  saturday: string,
): Promise<RaidOpponentRow | null> {
  const [row] = await db.select().from(raidOpponents).where(current(workspaceId, saturday));
  return row ?? null;
}

/** Every workspace's opponent of the raid of `saturday`, by workspace: the tick's targets. */
export async function opponentsOn(db: Db, saturday: string): Promise<Map<number, RaidOpponentRow>> {
  const rows = await db
    .select()
    .from(raidOpponents)
    .where(and(eq(raidOpponents.saturday, saturday), isNull(raidOpponents.clearedAt)));
  return new Map(rows.map((r) => [r.workspaceId, r]));
}

/** Clears the current opponent of the raid; its id (for Undo), or null when there was none. */
export async function clearOpponent(
  db: Db,
  workspaceId: number,
  saturday: string,
  now: Date,
): Promise<number | null> {
  const [row] = await db
    .update(raidOpponents)
    .set({ clearedAt: now })
    .where(current(workspaceId, saturday))
    .returning({ id: raidOpponents.id });
  return row?.id ?? null;
}

/** A new opponent of the raid: the current one is cleared first. Returns the cleared one's id, or null. */
export async function setOpponent(
  db: Db,
  row: Omit<typeof raidOpponents.$inferInsert, "id" | "clearedAt">,
): Promise<number | null> {
  const previous = await clearOpponent(db, row.workspaceId, row.saturday, row.setAt);
  await db.insert(raidOpponents).values(row);
  return previous;
}

/**
 * Undo: the workspace's opponent `id` of the raid of `saturday` is current again, and the one current now is
 * cleared. False when no such row of this workspace and raid exists.
 */
export async function restoreOpponent(
  db: Db,
  q: { workspaceId: number; saturday: string; id: number },
  now: Date,
): Promise<boolean> {
  const [found] = await db
    .select({ id: raidOpponents.id })
    .from(raidOpponents)
    .where(
      and(
        eq(raidOpponents.id, q.id),
        eq(raidOpponents.workspaceId, q.workspaceId),
        eq(raidOpponents.saturday, q.saturday),
      ),
    );
  if (!found) return false;
  await db
    .update(raidOpponents)
    .set({ clearedAt: now })
    .where(and(current(q.workspaceId, q.saturday), ne(raidOpponents.id, q.id)));
  await db.update(raidOpponents).set({ clearedAt: null }).where(eq(raidOpponents.id, q.id));
  return true;
}

/** The workspace's opponents of raids before `saturday`, newest first: the history. */
export async function pastOpponents(
  db: Db,
  workspaceId: number,
  saturday: string,
  limit: number,
): Promise<RaidOpponentRow[]> {
  return db
    .select()
    .from(raidOpponents)
    .where(
      and(
        eq(raidOpponents.workspaceId, workspaceId),
        lt(raidOpponents.saturday, saturday),
        isNull(raidOpponents.clearedAt),
      ),
    )
    .orderBy(desc(raidOpponents.saturday))
    .limit(limit);
}

type ReadKey = { workspaceId: number; saturday: string; phase: RaidPhase; side: RaidSideName };

/** The claim a read's row holds until its answer replaces it: a run that died after the call leaves it. */
export const CLAIMED = "sent: no answer stored";

/**
 * INVARIANT raid.one-call-per-row: a read's row is written before its call; false when the row exists, so
 * that read is never sent twice.
 */
export async function claimRead(
  db: Db,
  key: ReadKey,
  unionId: number,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .insert(raidReads)
    .values({ ...key, unionId, error: CLAIMED, readAt: now })
    .onConflictDoNothing()
    .returning({ phase: raidReads.phase });
  return rows.length > 0;
}

/** A read's answer, or its error code, over its claim. A member's null might or kills stays null (D15). */
export async function saveRead(
  db: Db,
  key: ReadKey,
  patch: Partial<
    Omit<typeof raidReads.$inferInsert, keyof ReadKey | "memberPower" | "memberKills">
  > & {
    memberPower?: (number | null)[];
    memberKills?: (number | null)[];
  },
): Promise<void> {
  await db
    .update(raidReads)
    .set(patch as Partial<typeof raidReads.$inferInsert>)
    .where(
      and(
        eq(raidReads.workspaceId, key.workspaceId),
        eq(raidReads.saturday, key.saturday),
        eq(raidReads.phase, key.phase),
        eq(raidReads.side, key.side),
      ),
    );
}

/** A stored read as the result reads it: might and kills keep a member's null (D15). */
export type StoredRaidRead = Omit<RaidReadRow, "memberPower" | "memberKills"> & {
  memberPower: (number | null)[] | null;
  memberKills: (number | null)[] | null;
};

/** A text array element as a number, a null kept null (D15), as lib/repo/kvk.ts. */
const numbers = (xs: (string | null)[] | null) =>
  xs && xs.map((x) => (x === null ? null : Number(x)));

/** The workspace's raid reads of the raids of `saturdays`. */
export async function readsOf(
  db: Db,
  workspaceId: number,
  saturdays: readonly string[],
): Promise<StoredRaidRead[]> {
  if (saturdays.length === 0) return [];
  const rows = await db
    .select({
      ...getTableColumns(raidReads),
      // As text: Drizzle reads a null bigint element as 0, and a null stays null (D15).
      memberPower: sql<(string | null)[] | null>`${raidReads.memberPower}::text[]`,
      memberKills: sql<(string | null)[] | null>`${raidReads.memberKills}::text[]`,
    })
    .from(raidReads)
    .where(
      and(eq(raidReads.workspaceId, workspaceId), inArray(raidReads.saturday, [...saturdays])),
    );
  return rows.map((r) => ({
    ...r,
    memberPower: numbers(r.memberPower),
    memberKills: numbers(r.memberKills),
  }));
}

/**
 * The alliance's daily roster of `day` when the daily read stored it in [from, to) and it is fresh with no
 * error: our side's raid read when the daily read fell in the same tick. Counts and arrays only, no names.
 */
export async function rosterStoredIn(
  db: Db,
  q: { day: string; unionId: number; from: Date; to: Date },
) {
  const r = dailyRosters;
  const [row] = await db
    .select({
      memberCount: r.memberCount,
      totalPower: r.totalPower,
      totalKills: r.totalKills,
      memberUids: r.memberUids,
      memberPower: sql<(string | null)[]>`${r.memberPower}::text[]`,
      memberKills: sql<(string | null)[]>`${r.memberKills}::text[]`,
      sourceUpdatedAt: r.sourceUpdatedAt,
      storedAt: r.storedAt,
    })
    .from(r)
    .where(
      and(
        eq(r.readDay, q.day),
        eq(r.unionId, q.unionId),
        isNull(r.error),
        eq(r.isFresh, true),
        gte(r.storedAt, q.from),
        lt(r.storedAt, q.to),
      ),
    );
  return row
    ? {
        ...row,
        memberPower: numbers(row.memberPower) ?? [],
        memberKills: numbers(row.memberKills) ?? [],
      }
    : null;
}

/** The raid reads' times; the Raid Shield settings' other columns keep their values, or their defaults. */
export async function saveRaidTimes(
  db: Db,
  row: {
    workspaceId: number;
    raidStartMinute: number;
    raidEndMinute: number;
    updatedBy: number;
    updatedAt: Date;
  },
): Promise<void> {
  await db
    .insert(shieldSettings)
    .values(row)
    .onConflictDoUpdate({
      target: shieldSettings.workspaceId,
      set: {
        raidStartMinute: row.raidStartMinute,
        raidEndMinute: row.raidEndMinute,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt,
      },
    });
}

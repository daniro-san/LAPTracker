// member_squads and squad_reads (D117): the squads the tracker saw, stored append-only, and the nightly
// read's own record. Plain reads and writes; the rules are in lib/squads-read.ts and lib/squads.ts.
import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";

import type { Db } from "../db";
import { dailyRosters, workspaces } from "../schema";
import { memberSquads, squadReads, type StoredHero } from "../schema-squads";
import type { SquadInput } from "../sources/types";

export type SquadRead = typeof squadReads.$inferSelect;
export type StoredSquad = Omit<typeof memberSquads.$inferSelect, "id" | "unionId">;

/** The uids of the alliance's roster in the day's read, or null when the read kept none for it. */
export async function dayRosterUids(
  db: Db,
  day: string,
  unionId: number,
): Promise<number[] | null> {
  const [row] = await db
    .select({ uids: dailyRosters.memberUids })
    .from(dailyRosters)
    .where(
      and(
        eq(dailyRosters.readDay, day),
        eq(dailyRosters.unionId, unionId),
        isNull(dailyRosters.error),
      ),
    );
  return row?.uids ?? null;
}

/** The workspace of an alliance (D71), or null when it has none. */
export async function workspaceIdOf(db: Db, unionId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.unionId, unionId));
  return row?.id ?? null;
}

export async function getSquadRead(db: Db, day: string): Promise<SquadRead | null> {
  const [row] = await db.select().from(squadReads).where(eq(squadReads.day, day));
  return row ?? null;
}

/** The day's first batch: true for exactly one caller. */
export async function startSquadRead(
  db: Db,
  row: typeof squadReads.$inferInsert,
): Promise<boolean> {
  const added = await db
    .insert(squadReads)
    .values(row)
    .onConflictDoNothing()
    .returning({ day: squadReads.day });
  return added.length > 0;
}

/** A later batch of a running read: one caller, and only when no batch started after `staleBefore`. */
export async function claimSquadBatch(
  db: Db,
  day: string,
  now: Date,
  staleBefore: Date,
): Promise<SquadRead | null> {
  const [row] = await db
    .update(squadReads)
    .set({ batchAt: now })
    .where(
      and(
        eq(squadReads.day, day),
        eq(squadReads.status, "running"),
        or(isNull(squadReads.batchAt), lt(squadReads.batchAt, staleBefore)),
      ),
    )
    .returning();
  return row ?? null;
}

export async function updateSquadRead(
  db: Db,
  day: string,
  patch: Partial<typeof squadReads.$inferInsert>,
): Promise<void> {
  await db.update(squadReads).set(patch).where(eq(squadReads.day, day));
}

/** The newest stored row of each squad number of one member, squad 1 first. */
export async function latestSquads(db: Db, unionId: number, uid: number): Promise<StoredSquad[]> {
  const s = memberSquads;
  return db
    .selectDistinctOn([s.squad], {
      uid: s.uid,
      squad: s.squad,
      power: s.power,
      soldiers: s.soldiers,
      soldierLoad: s.soldierLoad,
      heroes: s.heroes,
      seenAt: s.seenAt,
      readAt: s.readAt,
    })
    .from(s)
    .where(and(eq(s.unionId, unionId), eq(s.uid, uid)))
    .orderBy(asc(s.squad), desc(s.readAt), desc(s.id));
}

const heroesOf = (squad: SquadInput): StoredHero[] =>
  squad.heroes.map((h) => ({ id: h.id, lv: h.lv, star: h.star, q: h.q, awaken: h.awaken }));

/** The heroes as one string in a fixed field order: jsonb gives the keys back in its own order. */
const heroesKey = (heroes: readonly StoredHero[]) =>
  heroes.map((h) => [h.id, h.lv, h.star, h.q, h.awaken].join(",")).join(";");

const sameAs = (stored: StoredSquad | undefined, squad: SquadInput) =>
  !!stored &&
  stored.power === Math.round(squad.power) &&
  (stored.seenAt?.getTime() ?? null) === (squad.seenAt?.getTime() ?? null) &&
  heroesKey(stored.heroes) === heroesKey(heroesOf(squad));

/**
 * Appends each squad that differs from the newest stored row of its number. Squads the response does not
 * list stay as they are (INVARIANT squads.append-only). Returns how many rows were added.
 */
export async function storeSquads(
  db: Db,
  unionId: number,
  uid: number,
  squads: readonly SquadInput[],
  readAt: Date,
): Promise<number> {
  const newest = new Map((await latestSquads(db, unionId, uid)).map((s) => [s.squad, s]));
  const rows = squads
    .filter((s) => !sameAs(newest.get(s.squad), s))
    .map((s) => ({
      unionId,
      uid,
      squad: s.squad,
      power: Math.round(s.power),
      soldiers: s.soldiers === null ? null : Math.round(s.soldiers),
      soldierLoad: s.soldierLoad === null ? null : Math.round(s.soldierLoad),
      heroes: heroesOf(s),
      seenAt: s.seenAt,
      readAt,
    }));
  if (rows.length > 0) await db.insert(memberSquads).values(rows);
  return rows.length;
}

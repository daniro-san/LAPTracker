// member_squads and squad_reads (D117): the squads the tracker saw, stored append-only, and the nightly
// read's own record. Plain reads and writes; the rules are in lib/squads-read.ts and lib/squads.ts.
import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";

import type { Db } from "../db";
import { dailyRosters } from "../schema";
import { memberSquads, squadReads, type StoredHero } from "../schema-squads";
import type { SquadInput } from "../sources/types";

export type SquadRead = typeof squadReads.$inferSelect;
/** A stored squad as the card and the main squad read it: troops are stored, never read back (D132). */
export type StoredSquad = Omit<typeof memberSquads.$inferSelect, "id" | "unionId" | "troops">;

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

/** One day's read of one alliance. */
const of = (day: string, unionId: number) =>
  and(eq(squadReads.day, day), eq(squadReads.unionId, unionId));

/** The day's read of one alliance (D124: each workspace with a key has its own). */
export async function getSquadRead(
  db: Db,
  day: string,
  unionId: number,
): Promise<SquadRead | null> {
  const [row] = await db.select().from(squadReads).where(of(day, unionId));
  return row ?? null;
}

/** The day's first batch of an alliance: true for exactly one caller. */
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
  unionId: number,
  now: Date,
  staleBefore: Date,
): Promise<SquadRead | null> {
  const [row] = await db
    .update(squadReads)
    .set({ batchAt: now })
    .where(
      and(
        of(day, unionId),
        eq(squadReads.status, "running"),
        or(isNull(squadReads.batchAt), lt(squadReads.batchAt, staleBefore)),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Writes a batch's progress (after each call) or its end, only while the batch still holds the day's
 * claim (`batch_at` = the time it claimed). False when a later caller took the claim over as stale.
 */
export async function updateClaimedSquadRead(
  db: Db,
  day: string,
  unionId: number,
  claimedAt: Date,
  patch: Partial<typeof squadReads.$inferInsert>,
): Promise<boolean> {
  const rows = await db
    .update(squadReads)
    .set(patch)
    .where(and(of(day, unionId), eq(squadReads.batchAt, claimedAt)))
    .returning({ day: squadReads.day });
  return rows.length > 0;
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

/**
 * Each squad number's newest row and the row before it (null when there is none), squad 1 first: the
 * card's "what changed and when". A row is stored only when the squad changed, so a member has few.
 */
export async function squadPairs(
  db: Db,
  unionId: number,
  uid: number,
): Promise<{ latest: StoredSquad; previous: StoredSquad | null }[]> {
  const s = memberSquads;
  const rows = await db
    .select({
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
  const pairs = new Map<number, { latest: StoredSquad; previous: StoredSquad | null }>();
  for (const row of rows) {
    const pair = pairs.get(row.squad);
    if (!pair) pairs.set(row.squad, { latest: row, previous: null });
    else pair.previous ??= row;
  }
  return [...pairs.values()];
}

/** Every member's newest stored row of each squad number, power only: the garrison plan's read (D121). */
export async function allLatestSquads(
  db: Db,
  unionId: number,
): Promise<{ uid: number; squad: number; power: number }[]> {
  const s = memberSquads;
  return db
    .selectDistinctOn([s.uid, s.squad], { uid: s.uid, squad: s.squad, power: s.power })
    .from(s)
    .where(eq(s.unionId, unionId))
    .orderBy(asc(s.uid), asc(s.squad), desc(s.readAt), desc(s.id));
}

const heroesOf = (squad: SquadInput): StoredHero[] =>
  squad.heroes.map((h) => ({
    id: h.id,
    lv: h.lv,
    star: h.star,
    q: h.q,
    awaken: h.awaken,
    honor: h.honor,
  }));

/**
 * The heroes as one string in a fixed field order: jsonb gives the keys back in its own order. `honor`
 * is left out, so rows stored before D132 (without it) still match an unchanged squad.
 */
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
  // A sighting is never later than our read (a clock ahead upstream would make it so).
  const clamped = squads.map((s) => (s.seenAt && s.seenAt > readAt ? { ...s, seenAt: readAt } : s));
  const rows = clamped
    .filter((s) => !sameAs(newest.get(s.squad), s))
    .map((s) => ({
      unionId,
      uid,
      squad: s.squad,
      power: Math.round(s.power),
      soldiers: s.soldiers === null ? null : Math.round(s.soldiers),
      soldierLoad: s.soldierLoad === null ? null : Math.round(s.soldierLoad),
      heroes: heroesOf(s),
      troops: s.troops,
      seenAt: s.seenAt,
      readAt,
    }));
  if (rows.length > 0) await db.insert(memberSquads).values(rows);
  return rows.length;
}

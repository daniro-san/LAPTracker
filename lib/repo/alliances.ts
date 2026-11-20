// alliances, alliance_board and tracked_sets (D133): every alliance the ranks board lists, its numbers each
// server day, and the day's tracked set. Labels fall back to the newest daily roster for an alliance the
// board never listed (a workspace's alliance read before the first board, or one the board dropped).
import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { dailyRosters, events, workspaces } from "../schema";
import { allianceBoard, alliances, trackedSets } from "../schema-alliances";
import type { RanksBoard } from "../sources/types";

/** A database or a transaction: the label reads run in either. */
type Reader = Pick<Db, "select" | "selectDistinctOn">;

export interface AllianceLabel {
  tag: string | null;
  name: string | null;
  badgeId: number | null;
}

/** Places on one board: 1 for the highest score; ties keep the board's order. */
const places = (scores: Map<number, number>) =>
  new Map([...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id], i) => [id, i + 1]));

/** One server day's board: every alliance's row, and its label kept as the newest. A day stored once. */
export async function storeBoard(db: Db, day: string, board: RanksBoard): Promise<void> {
  const powerRank = places(board.power);
  const killsRank = places(board.kills);
  const rows = [...board.labels.entries()].map(([unionId, label]) => ({
    day,
    unionId,
    ...label,
    power: board.power.get(unionId) ?? null,
    powerRank: powerRank.get(unionId) ?? null,
    kills: board.kills.get(unionId) ?? null,
    killsRank: killsRank.get(unionId) ?? null,
    pulledAt: board.pulledAt,
  }));
  if (rows.length === 0) return;
  await db.insert(allianceBoard).values(rows).onConflictDoNothing();
  await db
    .insert(alliances)
    .values(
      rows.map((r) => ({
        unionId: r.unionId,
        tag: r.tag,
        name: r.name,
        badgeId: r.badgeId,
        firstSeenDay: day,
        lastSeenDay: day,
      })),
    )
    .onConflictDoUpdate({
      target: alliances.unionId,
      set: {
        tag: sql`excluded.tag`,
        name: sql`excluded.name`,
        badgeId: sql`excluded.badge_id`,
        lastSeenDay: sql`excluded.last_seen_day`,
      },
      setWhere: sql`${alliances.lastSeenDay} <= excluded.last_seen_day`,
    });
}

/** The day's set, written once: true for the one caller whose insert made it. */
export async function claimTrackedSet(
  db: Db,
  set: { day: string; allianceIds: number[]; source: "board" | "previous" | "event" },
  now: Date,
): Promise<boolean> {
  const rows = await db
    .insert(trackedSets)
    .values({ ...set, createdAt: now })
    .onConflictDoNothing()
    .returning({ day: trackedSets.day });
  return rows.length > 0;
}

export interface TrackedSet {
  day: string;
  allianceIds: number[];
  source: "board" | "previous" | "event";
}

const setColumns = {
  day: trackedSets.day,
  allianceIds: trackedSets.allianceIds,
  source: trackedSets.source,
};

/** The set of `day`, or null when none was written yet. */
export async function trackedSetOf(db: Db, day: string): Promise<TrackedSet | null> {
  const [row] = await db.select(setColumns).from(trackedSets).where(eq(trackedSets.day, day));
  return row ?? null;
}

/** The newest sets, newest first; with `before`, only days before it. */
export function recentTrackedSets(db: Db, n: number, before?: string): Promise<TrackedSet[]> {
  return db
    .select(setColumns)
    .from(trackedSets)
    .where(before ? lt(trackedSets.day, before) : undefined)
    .orderBy(desc(trackedSets.day))
    .limit(n);
}

/** The newest event's alliance list that is not empty: what was tracked before any set existed (D4's list). */
export async function newestEventIds(db: Db): Promise<number[]> {
  const [row] = await db
    .select({ ids: events.allianceIds })
    .from(events)
    .where(ne(sql`cardinality(${events.allianceIds})`, 0))
    .orderBy(desc(events.id))
    .limit(1);
  return row?.ids ?? [];
}

/**
 * The alliances tracked now: the newest set; before the first board read, the newest event's list, else the
 * alliances of the newest daily read.
 */
export async function trackedAllianceIds(db: Db): Promise<number[]> {
  const [newest] = await recentTrackedSets(db, 1);
  if (newest) return newest.allianceIds;
  const eventIds = await newestEventIds(db);
  if (eventIds.length > 0) return eventIds;
  const rows = await db
    .selectDistinct({ unionId: dailyRosters.unionId })
    .from(dailyRosters)
    .where(
      eq(dailyRosters.readDay, sql`(select max(${dailyRosters.readDay}) from ${dailyRosters})`),
    );
  return rows.map((r) => r.unionId);
}

/** Each id's newest label: the board's, else the newest daily roster's; ids with neither are left out. */
export async function allianceLabels(
  db: Reader,
  ids: readonly number[],
): Promise<Map<number, AllianceLabel>> {
  const out = new Map<number, AllianceLabel>();
  if (ids.length === 0) return out;
  const known = await db
    .select({
      unionId: alliances.unionId,
      tag: alliances.tag,
      name: alliances.name,
      badgeId: alliances.badgeId,
    })
    .from(alliances)
    .where(inArray(alliances.unionId, [...ids]));
  for (const { unionId, ...label } of known) out.set(unionId, label);
  const rest = ids.filter((id) => !out.has(id));
  if (rest.length === 0) return out;
  const rostered = await db
    .selectDistinctOn([dailyRosters.unionId], {
      unionId: dailyRosters.unionId,
      tag: dailyRosters.tag,
      name: dailyRosters.name,
      badgeId: dailyRosters.badgeId,
    })
    .from(dailyRosters)
    .where(and(inArray(dailyRosters.unionId, rest), sql`${dailyRosters.tag} is not null`))
    .orderBy(dailyRosters.unionId, desc(dailyRosters.readDay));
  for (const { unionId, ...label } of rostered) out.set(unionId, label);
  return out;
}

/** One alliance's label, or null when nothing names it. */
export async function allianceLabelOf(db: Reader, unionId: number): Promise<AllianceLabel | null> {
  return (await allianceLabels(db, [unionId])).get(unionId) ?? null;
}

/** The label of the alliance of the workspace at `slug`; null when there is no such workspace or no label. */
export async function workspaceAllianceLabel(db: Db, slug: string): Promise<AllianceLabel | null> {
  const [w] = await db
    .select({ unionId: workspaces.unionId })
    .from(workspaces)
    .where(eq(workspaces.slug, slug));
  return w ? allianceLabelOf(db, w.unionId) : null;
}

/** Every alliance a workspace or an invite may be made for: on the board, or with a daily roster. */
export async function knownAlliances(
  db: Db,
  except: readonly number[] = [],
): Promise<({ unionId: number } & AllianceLabel)[]> {
  const [boarded, rostered] = await Promise.all([
    db.select({ unionId: alliances.unionId }).from(alliances),
    db.selectDistinct({ unionId: dailyRosters.unionId }).from(dailyRosters),
  ]);
  const ids = [...new Set([...boarded, ...rostered].map((r) => r.unionId))].filter(
    (id) => !except.includes(id),
  );
  const labels = await allianceLabels(db, ids);
  return [...labels.entries()]
    .map(([unionId, l]) => ({ unionId, ...l }))
    .sort((a, b) => (a.tag ?? "").localeCompare(b.tag ?? "") || a.unionId - b.unionId);
}

/** Whether `unionId` is an alliance we know (the board listed it, or a daily roster has it). */
export async function isKnownAlliance(db: Db, unionId: number): Promise<boolean> {
  return (await allianceLabels(db, [unionId])).size > 0;
}

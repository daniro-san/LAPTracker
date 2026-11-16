// The merge simulator's read (D84, #282): for two tracked alliances, the members and might of their newest
// usable roster each, the stored capacity, and each one's latest KvK turnout; for the others, their might.
// A usable roster is fresh, has no error and is not empty (as member history reads, D60); the newest one
// across the daily reads and the public event snapshots wins, the daily read on a tie. Fields read: an
// alliance's tag, name, badge, capacity and might, and each member's uid and power. No member name, kills
// or blocked roster key is selected, and nothing per member is returned.
import { and, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { ALLIANCES } from "../../config/alliances";
import { sumPower } from "../compute";
import type { Db } from "../db";
import { mergedCapacity, simulateMerge, type MergeResult } from "../merge";
import { allianceSnapshots, dailyRosters, events, memberSnapshots, snapshots } from "../schema";
import { listEvents } from "./events";
import { numbers } from "./history-readings";
import { memberTurnout } from "./turnout";
import { phaseSnapshot, publicEvent } from "./visibility";

export interface MergeAlliance {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** When the roster this figure comes from was read. */
  at: Date;
  /** Might: the roster's total power; null when the row has none. */
  power: number | null;
  members: number;
}

/** The latest event in which the alliance had a Start and an End roster. */
export interface MergeTurnout {
  eventId: number;
  eventAt: Date;
  /** Members in both rosters, and how many of them gained kills. */
  n: number;
  gainers: number;
}

export interface MergeSide extends MergeAlliance {
  /** The most members the alliance holds, as stored (D32); null when no stored row has it. */
  capacity: number | null;
  turnout: MergeTurnout | null;
}

export interface MergePage {
  /** Every tracked alliance with a usable roster, for the two selects, by might. */
  alliances: MergeAlliance[];
  merge: { a: MergeSide; b: MergeSide; result: MergeResult } | null;
}

type Head = MergeAlliance & { source: "daily" | "event"; rowId: number };

/** The head without the row it came from. */
const shown = ({ unionId, tag, name, badgeId, at, power, members }: Head): MergeAlliance => ({
  unionId,
  tag,
  name,
  badgeId,
  at,
  power,
  members,
});

const TRACKED = ALLIANCES.map((a) => a.unionId);

/** How many of the newest events are searched for an alliance's turnout before it shows none. */
const TURNOUT_EVENTS = 3;

/** Each alliance's newest usable roster across both kinds of read, the daily read on a tie. */
async function newestHeads(db: Db, ids: number[]): Promise<Map<number, Head>> {
  const [daily, event] = await Promise.all([
    db
      .selectDistinctOn([dailyRosters.unionId], {
        rowId: dailyRosters.id,
        unionId: dailyRosters.unionId,
        tag: dailyRosters.tag,
        name: dailyRosters.name,
        badgeId: dailyRosters.badgeId,
        at: dailyRosters.sourceUpdatedAt,
        power: dailyRosters.totalPower,
        members: dailyRosters.memberCount,
      })
      .from(dailyRosters)
      .where(
        and(
          inArray(dailyRosters.unionId, ids),
          eq(dailyRosters.isFresh, true),
          isNull(dailyRosters.error),
          gt(dailyRosters.memberCount, 0),
          isNotNull(dailyRosters.sourceUpdatedAt),
        ),
      )
      .orderBy(dailyRosters.unionId, desc(dailyRosters.sourceUpdatedAt)),
    db
      .selectDistinctOn([allianceSnapshots.unionId], {
        rowId: allianceSnapshots.id,
        unionId: allianceSnapshots.unionId,
        tag: allianceSnapshots.tag,
        name: allianceSnapshots.name,
        badgeId: allianceSnapshots.badgeId,
        at: allianceSnapshots.sourceUpdatedAt,
        power: allianceSnapshots.totalPower,
        members: allianceSnapshots.memberCount,
      })
      .from(allianceSnapshots)
      .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
      .innerJoin(events, eq(events.id, snapshots.eventId))
      .where(
        and(
          inArray(allianceSnapshots.unionId, ids),
          publicEvent,
          // A sample (D69) has no member rows.
          phaseSnapshot,
          eq(allianceSnapshots.isFresh, true),
          isNull(allianceSnapshots.error),
          gt(allianceSnapshots.memberCount, 0),
          isNotNull(allianceSnapshots.sourceUpdatedAt),
        ),
      )
      .orderBy(allianceSnapshots.unionId, desc(allianceSnapshots.sourceUpdatedAt)),
  ]);
  const heads = new Map<number, Head>();
  const take = (source: Head["source"]) => (r: (typeof daily)[number]) => {
    const head: Head = {
      ...r,
      at: r.at as Date,
      members: r.members as number,
      power: r.power === null ? null : Number(r.power),
      source,
    };
    const have = heads.get(r.unionId);
    if (!have || head.at.getTime() > have.at.getTime()) heads.set(r.unionId, head);
  };
  daily.forEach(take("daily"));
  event.forEach(take("event"));
  return heads;
}

/** The stored capacity of each alliance: its newest public row that has one (D32). */
async function storedCapacities(db: Db, ids: number[]): Promise<Map<number, number>> {
  const rows = await db
    .selectDistinctOn([allianceSnapshots.unionId], {
      unionId: allianceSnapshots.unionId,
      capacity: allianceSnapshots.capacity,
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        inArray(allianceSnapshots.unionId, ids),
        publicEvent,
        isNotNull(allianceSnapshots.capacity),
        isNull(allianceSnapshots.error),
      ),
    )
    .orderBy(allianceSnapshots.unionId, desc(allianceSnapshots.sourceUpdatedAt));
  return new Map(rows.map((r) => [r.unionId, r.capacity as number]));
}

/** A merge-side roster's uid and power; the names, kills and blocked keys are never read. */
async function rosterOf(db: Db, head: Head) {
  if (head.source === "daily") {
    const [row] = await db
      .select({
        uids: dailyRosters.memberUids,
        // As text: Drizzle reads a null bigint element as 0, and a null stays null (D15).
        power: sql<(string | null)[]>`${dailyRosters.memberPower}::text[]`,
      })
      .from(dailyRosters)
      .where(eq(dailyRosters.id, head.rowId));
    const power = numbers(row?.power ?? null);
    return (row?.uids ?? []).map((uid, i) => ({ uid, power: power[i] ?? null }));
  }
  return db
    .select({ uid: memberSnapshots.uid, power: memberSnapshots.power })
    .from(memberSnapshots)
    .where(eq(memberSnapshots.allianceSnapshotId, head.rowId));
}

/** The latest turnout of each alliance in `ids`, from the newest events that have a Start and an End. */
async function latestTurnouts(db: Db, ids: number[]): Promise<Map<number, MergeTurnout>> {
  const found = new Map<number, MergeTurnout>();
  const withBoth = (await listEvents(db)).filter((e) =>
    (["before", "after"] as const).every((p) => e.snapshots.some((s) => s.phase === p)),
  );
  for (const event of withBoth.slice(0, TURNOUT_EVENTS)) {
    const lists = await memberTurnout(db, event.snapshots);
    for (const t of lists?.withKills ?? []) {
      if (ids.includes(t.unionId) && !found.has(t.unionId)) {
        found.set(t.unionId, {
          eventId: event.id,
          eventAt: event.eventAtUtc,
          n: t.n,
          gainers: t.gainers,
        });
      }
    }
    if (ids.every((id) => found.has(id))) break;
  }
  return found;
}

/**
 * The simulator's page data. `pair` is the two chosen union ids; null gives only the choices. A chosen id
 * with no usable roster among the tracked alliances yields `merge: null` too, and the caller checks the
 * ids against `alliances`. `tracked` defaults to the tracked list; tests pass their own.
 */
export async function mergePage(
  db: Db,
  pair: readonly [number, number] | null,
  tracked: readonly number[] = TRACKED,
): Promise<MergePage> {
  const heads = await newestHeads(db, [...tracked]);
  const alliances = [...heads.values()]
    .map(shown)
    .sort((p, q) => (q.power ?? 0) - (p.power ?? 0) || p.unionId - q.unionId);
  const [idA, idB] = pair ?? [];
  const [headA, headB] = [heads.get(idA ?? 0), heads.get(idB ?? 0)];
  if (!pair || !headA || !headB || idA === idB) return { alliances, merge: null };
  const [rosterA, rosterB, capacities, turnouts] = await Promise.all([
    rosterOf(db, headA),
    rosterOf(db, headB),
    storedCapacities(db, [idA as number, idB as number]),
    latestTurnouts(db, [idA as number, idB as number]),
  ]);
  const side = (head: Head, roster: { power: number | null }[]): MergeSide => {
    return {
      ...shown(head),
      // The roster's own sum: it is what the merge adds up, and it equals the stored total.
      power: sumPower(roster),
      capacity: capacities.get(head.unionId) ?? null,
      turnout: turnouts.get(head.unionId) ?? null,
    };
  };
  const [a, b] = [side(headA, rosterA), side(headB, rosterB)];
  const others = alliances.filter((o) => o.unionId !== idA && o.unionId !== idB);
  const result = simulateMerge(
    { unionId: a.unionId, members: rosterA },
    { unionId: b.unionId, members: rosterB },
    mergedCapacity(a.capacity, b.capacity),
    others,
  );
  return { alliances, merge: { a, b, result } };
}

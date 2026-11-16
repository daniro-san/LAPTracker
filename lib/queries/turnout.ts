// Who gained kills in an event (#271): per alliance, the members in both its Start and End roster, how
// many of them gained kills and how much of the alliance's kills gained the top 5 made. While the event
// runs (#307) the End is the alliance's latest usable sample. Fields read: the alliance's tag, name and
// badge, and each member's uid and kills; nothing per member is returned.
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { killsTurnout, TURNOUT_MIN_GAINERS, type KillsTurnout } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, memberSnapshots, snapshots } from "../schema";
import { numbers } from "./history-readings";

export interface AllianceTurnout extends KillsTurnout {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
}

export interface TurnoutLists {
  /** The figures are as of each alliance's latest sample: the event has no End yet (#307). */
  soFar?: boolean;
  /** Alliances by the share of their members who gained kills. */
  withKills: AllianceTurnout[];
  /**
   * Alliances that gained kills, by the top 5's share of those kills: first those with at least
   * `TURNOUT_MIN_GAINERS` gainers, then the rest, each part in that order.
   */
  topShare: AllianceTurnout[];
}

/** Biggest figure first; the larger alliance, then the lower id, when two are equal. */
const byFigure =
  (figure: (a: AllianceTurnout) => number) => (p: AllianceTurnout, q: AllianceTurnout) =>
    figure(q) - figure(p) || q.n - p.n || p.unionId - q.unionId;

/** The two lists from the alliances' figures; null when none gained kills. */
function turnoutLists(all: AllianceTurnout[], soFar: boolean): TurnoutLists | null {
  if (!all.some((t) => t.gainers > 0)) return null;
  const share = all.filter((t) => t.gained > 0).sort(byFigure((t) => t.top / t.gained));
  const ranked = (t: AllianceTurnout) => t.gainers >= TURNOUT_MIN_GAINERS;
  return {
    soFar,
    withKills: [...all].sort(byFigure((t) => t.gainers / t.n)),
    topShare: [...share.filter(ranked), ...share.filter((t) => !ranked(t))],
  };
}

/**
 * The two lists for an event's Start and End snapshots; null until both have run, and when no alliance
 * gained kills. An alliance whose Start or End row is stale or failed has no figure (INVARIANT
 * freshness.no-stale-delta), nor has one with no member in both rosters.
 */
export async function memberTurnout(
  db: Db,
  snapshots: readonly { id: number; phase: "before" | "after" }[],
): Promise<TurnoutLists | null> {
  const [b, a] = (["before", "after"] as const).map((ph) => snapshots.find((s) => s.phase === ph));
  if (!b || !a) return null;
  const rows = await db
    .select({
      snapshotId: allianceSnapshots.snapshotId,
      unionId: allianceSnapshots.unionId,
      tag: allianceSnapshots.tag,
      name: allianceSnapshots.name,
      badgeId: allianceSnapshots.badgeId,
      isFresh: allianceSnapshots.isFresh,
      error: allianceSnapshots.error,
      uid: memberSnapshots.uid,
      kills: memberSnapshots.kills,
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .where(inArray(allianceSnapshots.snapshotId, [b.id, a.id]));
  const usable = rows.filter((r) => r.isFresh && r.error === null);
  const side = (snapshotId: number, unionId: number) =>
    usable.filter((r) => r.snapshotId === snapshotId && r.unionId === unionId);
  const ends = usable.filter((r) => r.snapshotId === a.id);
  const alliances = [...new Map(ends.map((r) => [r.unionId, r])).values()];
  const all = alliances.flatMap((end) => {
    const figures = killsTurnout(side(b.id, end.unionId), side(a.id, end.unionId));
    const { unionId, tag, name, badgeId } = end;
    return figures.n === 0 ? [] : [{ ...figures, unionId, tag, name, badgeId }];
  });
  return turnoutLists(all, false);
}

/**
 * The same lists while the event has no End (#307): each alliance's Start roster against the member arrays
 * of its newest usable sample (fresh, read). Only that one sample's arrays are read per alliance, never
 * every sample's. Null when no alliance gained kills yet.
 */
export async function memberTurnoutSoFar(
  db: Db,
  eventId: number,
  startId: number,
): Promise<TurnoutLists | null> {
  const candidates = await db
    .select({
      id: allianceSnapshots.id,
      unionId: allianceSnapshots.unionId,
      tag: allianceSnapshots.tag,
      name: allianceSnapshots.name,
      badgeId: allianceSnapshots.badgeId,
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .where(
      and(
        eq(snapshots.eventId, eventId),
        eq(snapshots.phase, "sample"),
        ne(snapshots.status, "running"),
        eq(allianceSnapshots.isFresh, true),
        isNull(allianceSnapshots.error),
      ),
    )
    .orderBy(desc(snapshots.slotAt));
  const newest = new Map<number, (typeof candidates)[number]>();
  for (const c of candidates) if (!newest.has(c.unionId)) newest.set(c.unionId, c);
  if (newest.size === 0) return null;
  const [arrays, startRows] = await Promise.all([
    db
      .select({
        id: allianceSnapshots.id,
        uids: allianceSnapshots.memberUids,
        // As text: Drizzle reads a null bigint element as 0, and a null stays null (D15).
        kills: sql<(string | null)[] | null>`${allianceSnapshots.memberKills}::text[]`,
      })
      .from(allianceSnapshots)
      .where(
        inArray(
          allianceSnapshots.id,
          [...newest.values()].map((c) => c.id),
        ),
      ),
    db
      .select({
        unionId: allianceSnapshots.unionId,
        uid: memberSnapshots.uid,
        kills: memberSnapshots.kills,
      })
      .from(memberSnapshots)
      .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
      .where(
        and(
          eq(allianceSnapshots.snapshotId, startId),
          eq(allianceSnapshots.isFresh, true),
          isNull(allianceSnapshots.error),
        ),
      ),
  ]);
  const all = [...newest.values()].flatMap(({ id, unionId, tag, name, badgeId }) => {
    const row = arrays.find((a) => a.id === id);
    const kills = numbers(row?.kills ?? null);
    const sample = (row?.uids ?? []).map((uid, i) => ({ uid, kills: kills[i] ?? null }));
    const start = startRows.filter((r) => r.unionId === unionId);
    const figures = killsTurnout(start, sample);
    return figures.n === 0 ? [] : [{ ...figures, unionId, tag, name, badgeId }];
  });
  return turnoutLists(all, true);
}

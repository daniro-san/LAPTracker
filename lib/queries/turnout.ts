// Who gained kills in an event (#271): per alliance, the members in both its Start and End roster, how
// many of them gained kills and how much of the alliance's kills gained the top 5 made. While the event
// runs (#307) the End is the alliance's latest usable sample. Fields read: the alliance's tag, name and
// badge, and each member's uid and kills; nothing per member is returned.
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { killsTurnout, TURNOUT_MIN_GAINERS, type KillsTurnout } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, memberSnapshots, snapshots } from "../schema";
import { numbers } from "./history-readings";
import { betweenMembers, type BetweenMembers } from "./windows";

/**
 * A member's Start kills plus what they gained between the event's windows (D160), so End − Start is the sum
 * of the windows' gains; a member not read fresh in every row between windows is left out. A null counts
 * as 0 (D15).
 */
function windowedKills<R extends { uid: number; kills: number | null }>(
  rows: readonly R[],
  between: readonly BetweenMembers[],
): R[] {
  if (between.length === 0) return [...rows];
  return rows.flatMap((r) => {
    const sides = between.map((m) => m.get(r.uid));
    if (sides.some((s) => !s?.isFresh)) return [];
    let kills = r.kills ?? 0;
    for (let i = 0; i + 1 < sides.length; i += 2)
      kills += (sides[i + 1]?.totalKills ?? 0) - (sides[i]?.totalKills ?? 0);
    return [{ ...r, kills }];
  });
}

/** The counts only: the gainers' uids stay here, out of the shared entry and the page (D143). */
export interface AllianceTurnout extends Omit<KillsTurnout, "gainerUids"> {
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

/** The counts only: the uids stay here (`AllianceTurnout`). */
const countsOf = ({ gainerUids: _, ...counts }: KillsTurnout) => counts;

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
 * freshness.no-stale-delta), nor has one with no member in both rosters. `between`: the event detail's rows
 * between windows (D160); the kills gained are then the sum of the windows' gains.
 */
export async function memberTurnout(
  db: Db,
  snapshots: readonly { id: number; phase: "before" | "after" }[],
  between: readonly { id: number | null }[] = [],
): Promise<TurnoutLists | null> {
  const [b, a] = (["before", "after"] as const).map((ph) => snapshots.find((s) => s.phase === ph));
  if (!b || !a) return null;
  const slots = await betweenMembers(
    db,
    between.map((s) => s.id),
  );
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
    const start = windowedKills(side(b.id, end.unionId), slots);
    const figures = countsOf(killsTurnout(start, side(a.id, end.unionId)));
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
  // One row per alliance, in SQL: its newest usable sample.
  const newest = await db
    .selectDistinctOn([allianceSnapshots.unionId], {
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
    .orderBy(allianceSnapshots.unionId, desc(snapshots.slotAt));
  if (newest.length === 0) return null;
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
          newest.map((c) => c.id),
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
  const all = newest.flatMap(({ id, unionId, tag, name, badgeId }) => {
    const row = arrays.find((a) => a.id === id);
    const kills = numbers(row?.kills ?? null);
    const sample = (row?.uids ?? []).map((uid, i) => ({ uid, kills: kills[i] ?? null }));
    const start = startRows.filter((r) => r.unionId === unionId);
    const figures = countsOf(killsTurnout(start, sample));
    return figures.n === 0 ? [] : [{ ...figures, unionId, tag, name, badgeId }];
  });
  return turnoutLists(all, true);
}

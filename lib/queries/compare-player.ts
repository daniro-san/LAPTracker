// Event vs event for one player (issue 199, D57): the player in two public events, each read in the
// alliance that held them then. Member fields served: uid, name, power, kills (§12.1) and whether a
// photo exists (never its URL, D22); raw_json and avatar_url are never selected.
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { delta, type Measured } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { comparePicks, eventOf, sidesOf, usable, type Detail } from "./compare";
import { getEventDetail } from "./events";
import { peerRank } from "./players";
import { chainEvent } from "./visibility";

/** The player in one event. */
export interface PlayerEventFigures {
  /** The alliance that holds the player at the reference (after, else before), as the player page has it. */
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** Rank by might inside that alliance's roster at the reference. */
  rank: number | null;
  /** Might at the reference. */
  power: number | null;
  /** The in-event change (compute.delta); null when a side is missing, stale or failed. */
  change: { power: number; kills: number } | null;
  /** The before values, for the percent; null without a before row. */
  opening: { power: number | null; kills: number | null } | null;
}

interface PlayerRow {
  snapshotId: number;
  unionId: number;
  name: string;
  power: number | null;
  kills: number | null;
  hasAvatar: boolean;
  rank: number | null;
}

async function rowsOf(db: Db, uid: number, snapshotIds: number[]): Promise<PlayerRow[]> {
  if (snapshotIds.length === 0) return [];
  return db
    .select({
      snapshotId: allianceSnapshots.snapshotId,
      unionId: allianceSnapshots.unionId,
      name: memberSnapshots.name,
      power: memberSnapshots.power,
      kills: memberSnapshots.kills,
      hasAvatar: sql<boolean>`${memberSnapshots.avatarUrl} is not null`,
      rank: peerRank(memberSnapshots.power, "power"),
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .where(and(eq(memberSnapshots.uid, uid), inArray(allianceSnapshots.snapshotId, snapshotIds)))
    .orderBy(desc(allianceSnapshots.id));
}

/** Whether /players/[uid] exists: the player is in a chain event's roster (a standalone round has none). */
async function hasPlayerPage(db: Db, uid: number) {
  const [row] = await db
    .select({ uid: memberSnapshots.uid })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(eq(memberSnapshots.uid, uid), chainEvent))
    .limit(1);
  return row !== undefined;
}

/** The player's before and after rows in one event, and the reference (after, else before). A stale
 * alliance read can still list a player who is in another alliance's roster of the same snapshot:
 * the row in a usable alliance row wins, else the newest alliance row (rowsOf's order). */
function phasesOf(detail: Detail, rows: PlayerRow[]) {
  const { before, after, row } = sidesOf(detail);
  const pick = (s: typeof before) => {
    const own = rows.filter((r) => r.snapshotId === s?.id);
    return own.find((r) => usable(row(s, r.unionId))) ?? own[0];
  };
  const [mb, ma] = [pick(before), pick(after)];
  return { before, after, row, mb, ma, ref: ma ?? mb };
}

/** The player in one event; null when no roster of that event holds them. A mid-event switch is read
 * across the two alliances, each side's freshness from its own alliance row. */
function playerSide(detail: Detail, rows: PlayerRow[]): PlayerEventFigures | null {
  const { before, after, row, mb, ma, ref } = phasesOf(detail, rows);
  if (!ref) return null;
  const alliance = row(ref === ma ? after : before, ref.unionId);
  const side = (m: PlayerRow, s: typeof before): Measured => ({
    isFresh: usable(row(s, m.unionId)),
    totalPower: m.power,
    totalKills: m.kills,
  });
  return {
    unionId: ref.unionId,
    tag: alliance?.tag ?? null,
    name: alliance?.name ?? null,
    badgeId: alliance?.badgeId ?? null,
    rank: ref.rank,
    power: ref.power,
    change: mb && ma ? delta(side(mb, before), side(ma, after)) : null,
    opening: mb ? { power: mb.power, kills: mb.kills } : null,
  };
}

/** One player in two public events. Null: an id is not a public event, or the uid is in neither. */
export async function comparePlayer(db: Db, aId: number, bId: number, uid: number) {
  const [a, b] = await Promise.all([getEventDetail(db, aId), getEventDetail(db, bId)]);
  if (!a || !b) return null;
  const ids = [...a.snapshots, ...b.snapshots].map((s) => s.id);
  const [rows, hasPage] = await Promise.all([rowsOf(db, uid, ids), hasPlayerPage(db, uid)]);
  // Name and photo as the second event has them, else the first.
  const named = phasesOf(b, rows).ref ?? phasesOf(a, rows).ref;
  if (!named) return null;
  return {
    a: eventOf(a),
    b: eventOf(b),
    player: {
      uid,
      name: named.name,
      hasAvatar: named.hasAvatar,
      hasPage,
      a: playerSide(a, rows),
      b: playerSide(b, rows),
    },
  };
}

export type PlayerComparison = NonNullable<Awaited<ReturnType<typeof comparePlayer>>>;

/** The compare page's player view (issue 199): the same picks as the alliance view, then the player. */
export async function getComparePlayerPage(
  db: Db,
  ids: { a: number | null; b: number | null; uid: number },
) {
  const base = await comparePicks(db, ids);
  const { a, b } = base;
  if (a === null || b === null || a === b) return { ...base, found: true, comparison: null };
  const comparison = await comparePlayer(db, a, b, ids.uid);
  return { ...base, found: comparison !== null, comparison };
}

// The roster reads behind the workspace's Members tab (D71, D72): an alliance's end-of-day rosters with the
// member fields the workspace shows, the day each member was first seen, and its newest scheduled event's
// kills. Each function takes the alliance; lib/private passes its WorkspaceAccess's own union id, so a
// player who moved is seen by the old alliance only in the rosters from before the move. avatar_url and
// frame_url are never selected. The newest roster of any kind is in workspace-any-roster.ts.
import { and, desc, eq, gte, inArray, isNotNull, isNull, gt, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, dailyRosters, events, memberSnapshots, snapshots } from "../schema";

/** One member of an end-of-day roster, as the upstream sent it; anything not sent is null. */
export interface RosterMember {
  uid: number;
  name: string;
  power: number | null;
  /** Lifetime kills (public, D15: null when not sent). */
  kills: number | null;
  lv: number | null;
  rankCode: number | null;
  rankLabel: string | null;
  dailyTech: number | null;
  dailyHonor: number | null;
  active: number | null;
  joinedAt: Date | null;
  lastOnlineAt: Date | null;
  x: number | null;
  y: number | null;
}

/** One alliance's end-of-day roster (D72): its server day, when the upstream read it, its members. */
export interface RosterRead {
  day: string;
  at: Date;
  members: RosterMember[];
}

/** The upstream keys read from raw_json, and nothing else. */
const KEYS = [
  "uid",
  "nick_name",
  "power",
  "kills",
  "lv",
  "rank_code",
  "rank_label",
  "daily_tech",
  "daily_honor",
  "active",
  "joined_at",
  "last_online_at",
  "x",
  "y",
] as const;
type RawMember = Partial<Record<(typeof KEYS)[number], unknown>>;

const members = sql<RawMember[]>`coalesce((select jsonb_agg(jsonb_build_object(${sql.raw(
  KEYS.map((k) => `'${k}', m->'${k}'`).join(", "),
)})) from jsonb_array_elements(${dailyRosters.rawJson}->'members') m), '[]'::jsonb)`;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A time the upstream sent as epoch seconds, epoch milliseconds or an ISO string; null otherwise. */
function time(v: unknown): Date | null {
  const at =
    typeof v === "number"
      ? new Date(v < 1e12 ? v * 1000 : v)
      : typeof v === "string"
        ? new Date(v)
        : null;
  return at && Number.isFinite(at.getTime()) && (v as number | string) !== "" ? at : null;
}

/** A roster member, or null when the upstream sent no usable uid (it would read as a member 0). */
function member(m: RawMember): RosterMember | null {
  const uid = num(m.uid);
  if (uid === null || !Number.isSafeInteger(uid)) return null;
  return {
    uid,
    name: typeof m.nick_name === "string" ? m.nick_name : "",
    power: num(m.power),
    kills: num(m.kills),
    lv: num(m.lv),
    rankCode: num(m.rank_code),
    rankLabel: typeof m.rank_label === "string" && m.rank_label !== "" ? m.rank_label : null,
    dailyTech: num(m.daily_tech),
    dailyHonor: num(m.daily_honor),
    active: num(m.active),
    joinedAt: time(m.joined_at),
    lastOnlineAt: time(m.last_online_at),
    x: num(m.x),
    y: num(m.y),
  };
}

/** A usable roster of the alliance (D60): fresh, no error, not empty. */
export const usable = (unionId: number) =>
  and(
    eq(dailyRosters.unionId, unionId),
    eq(dailyRosters.isFresh, true),
    isNull(dailyRosters.error),
    gt(dailyRosters.memberCount, 0),
  );

/** The alliance's newest `n` usable end-of-day rosters that kept every field (D72), oldest first. */
export async function endOfDayReads(db: Db, unionId: number, n: number): Promise<RosterRead[]> {
  const rows = await db
    .select({ day: dailyRosters.readDay, at: dailyRosters.sourceUpdatedAt, members })
    .from(dailyRosters)
    .where(and(usable(unionId), isNotNull(dailyRosters.rawJson)))
    .orderBy(desc(dailyRosters.readDay))
    .limit(n);
  return rows.reverse().map((r) => ({
    day: r.day,
    at: r.at as Date,
    members: r.members.map(member).filter((m) => m !== null),
  }));
}

/**
 * Per uid, the server day of the alliance's oldest usable daily roster that lists it. It reads every
 * roster the alliance has, which grows by one per day (about 100 uids each): bound it or keep the result
 * if it shows up in timings.
 */
export async function firstSeenDays(db: Db, unionId: number): Promise<Map<number, string>> {
  const result = await db.execute<{ uid: string; first: string }>(sql`
    select u.uid::text as uid, min(r.read_day)::text as first
    from daily_rosters r cross join lateral unnest(r.member_uids) as u(uid)
    where r.union_id = ${unionId} and r.is_fresh and r.error is null and r.member_count > 0
    group by u.uid`);
  return new Map(result.rows.map((r) => [Number(r.uid), r.first]));
}

/** A scheduled event's Start and End kills of one alliance's members; null kills stay null (D15). */
export interface EventKills {
  at: Date;
  before: Map<number, number | null>;
  after: Map<number, number | null>;
}

/**
 * The alliance's newest public scheduled event since `since` whose Start and End rows are both fresh and
 * not failed, with each member's kills on both sides; null when there is none.
 */
export async function scheduledEventKills(
  db: Db,
  unionId: number,
  since: Date,
): Promise<EventKills | null> {
  const rows = await db
    .select({
      eventId: events.id,
      at: events.eventAtUtc,
      phase: snapshots.phase,
      id: allianceSnapshots.id,
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        eq(allianceSnapshots.unionId, unionId),
        eq(allianceSnapshots.isFresh, true),
        isNull(allianceSnapshots.error),
        eq(events.manual, false),
        eq(events.isTest, false),
        ne(events.visibility, "admin"),
        gte(events.eventAtUtc, since),
        inArray(snapshots.phase, ["before", "after"]),
      ),
    )
    .orderBy(desc(events.eventAtUtc));
  const side = (eventId: number, phase: string) =>
    rows.find((r) => r.eventId === eventId && r.phase === phase);
  const event = rows.find((r) => side(r.eventId, "before") && side(r.eventId, "after"));
  const [before, after] = event
    ? [side(event.eventId, "before"), side(event.eventId, "after")]
    : [];
  if (!event || !before || !after) return null;
  const kills = await db
    .select({
      id: memberSnapshots.allianceSnapshotId,
      uid: memberSnapshots.uid,
      kills: memberSnapshots.kills,
    })
    .from(memberSnapshots)
    .where(inArray(memberSnapshots.allianceSnapshotId, [before.id, after.id]));
  const byUid = (id: number) =>
    new Map(kills.filter((k) => k.id === id).map((k) => [k.uid, k.kills]));
  return { at: event.at, before: byUid(before.id), after: byUid(after.id) };
}

/** A member of the newest roster as "This is me" shows it: who, and enough to tell look-alike names apart. */
export interface RosterEntry {
  uid: number;
  name: string;
  might: number | null;
  rankCode: number | null;
  rankLabel: string | null;
}

/** Only uid, rank_code and rank_label are read from raw_json; the row has none before D72. */
const ranks = sql<
  { uid: unknown; rank_code: unknown; rank_label: unknown }[]
>`coalesce((select jsonb_agg(jsonb_build_object('uid', m->'uid', 'rank_code', m->'rank_code', 'rank_label', m->'rank_label')) from jsonb_array_elements(${dailyRosters.rawJson}->'members') m), '[]'::jsonb)`;

/** Each member of the alliance's newest usable daily roster (D60), with might and rank; empty before one. */
export async function latestRoster(db: Db, unionId: number): Promise<RosterEntry[]> {
  const [row] = await db
    .select({
      uids: dailyRosters.memberUids,
      names: dailyRosters.memberNames,
      power: dailyRosters.memberPower,
      ranks,
    })
    .from(dailyRosters)
    .where(usable(unionId))
    .orderBy(desc(dailyRosters.readDay))
    .limit(1);
  if (!row) return [];
  const rankOf = new Map(row.ranks.map((r) => [num(r.uid), r]));
  return row.uids.map((uid, i) => {
    const rank = rankOf.get(uid);
    return {
      uid,
      name: row.names[i] ?? "",
      might: row.power[i] ?? null,
      rankCode: num(rank?.rank_code),
      rankLabel:
        typeof rank?.rank_label === "string" && rank.rank_label !== "" ? rank.rank_label : null,
    };
  });
}

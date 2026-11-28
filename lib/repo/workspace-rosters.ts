// The roster reads behind the workspace's Members tab (D71, D72): an alliance's end-of-day rosters with the
// member fields the workspace shows, the day each member was first seen, and its newest scheduled event's
// kills, the KvK recap's Start and End kills (D159), and the officers' map's End places (issue 791). Each
// function takes the alliance; lib/private passes its WorkspaceAccess's own union id, so a player who moved is seen by the old alliance only in the rosters
// from before the move. avatar_url and
// frame_url are never selected. The newest roster of any kind is in workspace-any-roster.ts.
import { and, desc, eq, gte, inArray, isNotNull, isNull, gt, lt, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, dailyRosters, events, memberSnapshots, snapshots } from "../schema";
import { phaseSnapshot } from "./snapshots";

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

/** The alliance's newest `n` usable end-of-day rosters that kept every field (D72), oldest first. Only the
 * row's own members: raw_json also keeps those the read left out for an empty rank (issue 481). */
export async function endOfDayReads(db: Db, unionId: number, n: number): Promise<RosterRead[]> {
  const rows = await db
    .select({
      day: dailyRosters.readDay,
      at: dailyRosters.sourceUpdatedAt,
      uids: dailyRosters.memberUids,
      members,
    })
    .from(dailyRosters)
    .where(and(usable(unionId), isNotNull(dailyRosters.rawJson)))
    .orderBy(desc(dailyRosters.readDay))
    .limit(n);
  return rows.reverse().map((r) => {
    const uids = new Set(r.uids);
    return {
      day: r.day,
      at: r.at as Date,
      members: r.members
        .map(member)
        .filter((m) => m !== null)
        .filter((m) => uids.has(m.uid)),
    };
  });
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

/** A scheduled event and the ids of one alliance's Start and End rows in it. */
interface StartEndRows {
  at: Date;
  startId: number;
  endId: number;
  /** When the End read started. */
  endAt: Date;
}

/**
 * The alliance's newest public scheduled event since `since` whose Start and End rows are both fresh and
 * not failed, with those two rows' ids; null when there is none. The one place the event rules live: not
 * manual, not a test, not `admin` (D28), and only the event's Start and End, never a sample or a row
 * between windows (D160).
 */
async function newestStartEnd(db: Db, unionId: number, since: Date): Promise<StartEndRows | null> {
  const rows = await db
    .select({
      eventId: events.id,
      at: events.eventAtUtc,
      phase: snapshots.phase,
      startedAt: snapshots.startedAt,
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
        // The event's Start and End: not a sample, not a row between windows (D160).
        phaseSnapshot,
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
  return { at: event.at, startId: before.id, endId: after.id, endAt: after.startedAt };
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
  const event = await newestStartEnd(db, unionId, since);
  if (!event) return null;
  const { startId, endId } = event;
  const kills = await db
    .select({
      id: memberSnapshots.allianceSnapshotId,
      uid: memberSnapshots.uid,
      kills: memberSnapshots.kills,
    })
    .from(memberSnapshots)
    .where(inArray(memberSnapshots.allianceSnapshotId, [startId, endId]));
  const byUid = (id: number) =>
    new Map(kills.filter((k) => k.id === id).map((k) => [k.uid, k.kills]));
  return { at: event.at, before: byUid(startId), after: byUid(endId) };
}

/** A member placed by a scheduled event's End read (issue 791): where it saw them, their kills on both sides. */
export interface EndPlace {
  x: number;
  y: number;
  /** Lifetime kills at the Start and End reads; null when that read has none (D15). */
  before: number | null;
  after: number | null;
}

/** The newest scheduled event's End read of one alliance, as the officers' map shows it (issue 791). */
export interface EventEndPlaces {
  at: Date;
  /** When the End read started. */
  endAt: Date;
  places: EndPlace[];
  /** Members of the End read with no place in it. */
  unplaced: number;
}

/** Only uid, x and y are read from the End row's raw_json. */
const placesOf = sql<
  { uid: unknown; x: unknown; y: unknown }[]
>`coalesce((select jsonb_agg(jsonb_build_object('uid', m->'uid', 'x', m->'x', 'y', m->'y')) from jsonb_array_elements(${allianceSnapshots.rawJson}->'members') m), '[]'::jsonb)`;

/**
 * The alliance's newest public scheduled event since `since` whose Start and End rows are both fresh and
 * not failed: each End member's place on the map and kills on both sides, no uid or name; null when there
 * is none. Three statements, bounded by the date and by the two rows' ids (D149).
 */
export async function eventEndPlaces(
  db: Db,
  unionId: number,
  since: Date,
): Promise<EventEndPlaces | null> {
  const event = await newestStartEnd(db, unionId, since);
  if (!event) return null;
  const { startId, endId } = event;
  const [kills, [raw]] = await Promise.all([
    db
      .select({
        id: memberSnapshots.allianceSnapshotId,
        uid: memberSnapshots.uid,
        kills: memberSnapshots.kills,
      })
      .from(memberSnapshots)
      .where(inArray(memberSnapshots.allianceSnapshotId, [startId, endId])),
    db.select({ members: placesOf }).from(allianceSnapshots).where(eq(allianceSnapshots.id, endId)),
  ]);
  const at = new Map(
    (raw?.members ?? []).flatMap((m) => {
      const [uid, x, y] = [num(m.uid), num(m.x), num(m.y)];
      return uid === null || x === null || y === null ? [] : [[uid, { x, y }] as const];
    }),
  );
  const start = new Map(kills.filter((k) => k.id === startId).map((k) => [k.uid, k.kills]));
  const end = kills.filter((k) => k.id === endId);
  const places = end.flatMap((k) => {
    const place = at.get(k.uid);
    return place ? [{ ...place, before: start.get(k.uid) ?? null, after: k.kills }] : [];
  });
  return { at: event.at, endAt: event.endAt, places, unplaced: end.length - places.length };
}

/** A member in a KvK recap's Start or End roster: the public name (D22) and lifetime kills (D15). */
export interface RecapMember {
  uid: number;
  name: string;
  kills: number | null;
}

/**
 * The KvK recap's reads (D159, post 5): the alliance's Start and End members (uid, name, kills) in the public
 * scheduled event between `from` and `to`. Undefined while that event's End has no finished row (none yet,
 * or running); null when there is no such event, or the alliance's Start or End row is missing, stale or
 * failed. Two statements, bounded by the event's time (D149); no other member field is selected.
 */
export async function recapKills(
  db: Db,
  unionId: number,
  from: Date,
  to: Date,
): Promise<{ before: RecapMember[]; after: RecapMember[] } | null | undefined> {
  const [event] = await db
    .select({ id: events.id, end: snapshots.status })
    .from(events)
    // The event's End: not a window's After between windows (D160).
    .leftJoin(
      snapshots,
      and(eq(snapshots.eventId, events.id), eq(snapshots.phase, "after"), phaseSnapshot),
    )
    .where(
      and(
        gte(events.eventAtUtc, from),
        lt(events.eventAtUtc, to),
        eq(events.manual, false),
        eq(events.isTest, false),
        ne(events.visibility, "admin"),
      ),
    )
    .limit(1);
  if (!event) return null;
  if (event.end === null || event.end === "running") return undefined;
  const rows = await db
    .select({
      phase: snapshots.phase,
      uid: memberSnapshots.uid,
      name: memberSnapshots.name,
      kills: memberSnapshots.kills,
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .where(
      and(
        eq(snapshots.eventId, event.id),
        // The event's Start and End (D160).
        phaseSnapshot,
        eq(allianceSnapshots.unionId, unionId),
        eq(allianceSnapshots.isFresh, true),
        isNull(allianceSnapshots.error),
      ),
    );
  const side = (phase: string) =>
    rows.filter((r) => r.phase === phase).map(({ uid, name, kills }) => ({ uid, name, kills }));
  const [before, after] = [side("before"), side("after")];
  return before.length > 0 && after.length > 0 ? { before, after } : null;
}

/** A scheduled event's Start and End might of one alliance's members; a null might stays null (D15). */
export interface EventMight {
  id: number;
  at: Date;
  /** When the End read started: end-of-day reads after it show the recovery. */
  afterAt: Date;
  before: Map<number, number | null>;
  after: Map<number, number | null>;
}

/**
 * The alliance's public scheduled events since `since` whose Start and End rows are both fresh and not
 * failed, the newest first, with each member's might on both sides. One statement, bounded by the date:
 * events by `events_event_at_utc_unique`, then each table by its own unique index (D149).
 */
export async function scheduledEventMight(
  db: Db,
  unionId: number,
  since: Date,
): Promise<EventMight[]> {
  const rows = await db
    .select({
      eventId: events.id,
      at: events.eventAtUtc,
      phase: snapshots.phase,
      startedAt: snapshots.startedAt,
      uid: memberSnapshots.uid,
      power: memberSnapshots.power,
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
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
        // The event's Start and End: not a sample, not a row between windows (D160).
        phaseSnapshot,
      ),
    );
  const byEvent = new Map<number, EventMight>();
  for (const r of rows) {
    const e = byEvent.get(r.eventId) ?? {
      id: r.eventId,
      at: r.at,
      afterAt: r.startedAt,
      before: new Map(),
      after: new Map(),
    };
    if (r.phase === "after") e.afterAt = r.startedAt;
    e[r.phase === "before" ? "before" : "after"].set(r.uid, r.power);
    byEvent.set(r.eventId, e);
  }
  return [...byEvent.values()]
    .filter((e) => e.before.size > 0 && e.after.size > 0)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
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

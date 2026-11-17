// Who was in an alliance's rosters (D107), of the one alliance passed in (D71): every daily read's member
// arrays (D60, D72), every public event sample's arrays (D69), and every public event Start or End roster's
// member rows (`member_snapshots`; those rosters keep no arrays). Only uid, name, might and kills are read,
// all public; raw_json and the blocked keys are never touched, so a former member's map position, online
// status or photo cannot reach the workspace through here. Also a former member's newest week of Alliance
// Duel points, which officers saved (the workspace's own table, not a roster field).
import { and, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceDuelPoints } from "../schema-import";

/** A uid in the alliance's rosters, as the last roster that listed them had them. */
export interface LastSeen {
  uid: number;
  name: string;
  power: number | null;
  kills: number | null;
  /** When the upstream read that roster. */
  at: Date;
}

/** A public event roster of the alliance (not a test, not admin-only), aliased `a`, `s`, `e`. */
const eventRoster = (unionId: number) => sql`
  from alliance_snapshots a
  join snapshots s on s.id = a.snapshot_id
  join events e on e.id = s.event_id
  where a.union_id = ${unionId} and a.error is null and a.source_updated_at is not null
    and not e.is_test and e.visibility <> 'admin'`;

const rosters = (unionId: number) => sql`
  select u.uid, u.name, u.power, u.kills, r.source_updated_at as at
  from daily_rosters r
  cross join lateral unnest(r.member_uids, r.member_names, r.member_power, r.member_kills)
    as u(uid, name, power, kills)
  where r.union_id = ${unionId} and r.error is null and r.source_updated_at is not null
  union all
  select u.uid, u.name, u.power, u.kills, x.at from (
    select a.member_uids, a.member_names, a.member_power, a.member_kills, a.source_updated_at as at
    ${eventRoster(unionId)}
  ) x
  cross join lateral unnest(x.member_uids, x.member_names, x.member_power, x.member_kills)
    as u(uid, name, power, kills)
  union all
  select m.uid, m.name, m.power, m.kills, x.at from (
    select a.id, a.source_updated_at as at ${eventRoster(unionId)}
  ) x
  join member_snapshots m on m.alliance_snapshot_id = x.id`;

/**
 * Each uid the alliance's rosters ever listed, with the last roster that did. Unbounded on purpose (owner
 * review, 2026-11-17): it unnests every stored roster of the alliance, about 100 uids per daily read plus
 * each event's Start, End and samples, so roughly 365 × 100 + events × 100 × (2 + samples) rows a year.
 * Read only when the Former members view opens. Bound it by date, or keep a last-seen table, if it shows
 * up in timings.
 */
export async function lastSeen(db: Db, unionId: number): Promise<LastSeen[]> {
  const result = await db.execute<{
    uid: string;
    name: string | null;
    power: string | null;
    kills: string | null;
    at: string | Date;
  }>(sql`
    select distinct on (uid) uid::text as uid, name, power::text as power, kills::text as kills, at
    from (${rosters(unionId)}) x
    where uid is not null
    order by uid, at desc`);
  const big = (v: string | null) => (v === null ? null : Number(v));
  return result.rows.map((r) => ({
    uid: Number(r.uid),
    name: r.name ?? "",
    power: big(r.power),
    kills: big(r.kills),
    at: new Date(r.at),
  }));
}

/** Whether any of the alliance's rosters ever listed `uid`. */
export async function wasInRoster(db: Db, unionId: number, uid: number): Promise<boolean> {
  const result = await db.execute<{ found: boolean }>(sql`
    select exists (
      select 1 from daily_rosters r
      where r.union_id = ${unionId} and r.error is null and ${uid}::bigint = any(r.member_uids)
    ) or exists (
      select 1 ${eventRoster(unionId)} and ${uid}::bigint = any(a.member_uids)
    ) or exists (
      select 1 ${eventRoster(unionId)}
        and exists (
          select 1 from member_snapshots m
          where m.alliance_snapshot_id = a.id and m.uid = ${uid}::bigint)
    ) as found`);
  return result.rows[0]?.found === true;
}

/** The Alliance Duel points of the newest week saved for each of `uids` (former members, D107). */
export async function newestDuelWeeks(db: Db, workspaceId: number, uids: readonly number[]) {
  if (uids.length === 0) return [];
  const p = allianceDuelPoints;
  const mine = and(eq(p.workspaceId, workspaceId), inArray(p.uid, [...uids]));
  const newest = db
    .select({ uid: p.uid, week: sql<string>`max(${p.week})`.as("newest_week") })
    .from(p)
    .where(mine)
    .groupBy(p.uid)
    .as("newest");
  return db
    .select({ uid: p.uid, week: p.week, day: p.day, points: p.points })
    .from(p)
    .innerJoin(newest, and(eq(p.uid, newest.uid), eq(p.week, newest.week)))
    .where(mine);
}

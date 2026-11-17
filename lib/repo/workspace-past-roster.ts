// Who was in an alliance's rosters (D107): every daily read's member arrays (D60, D72) and every public
// event roster's arrays (Start, End and samples, D69), of the one alliance passed in (D71). Only uid, name,
// might and kills are read, all public; raw_json and the blocked keys are never touched, so a former
// member's map position, online status or photo cannot reach the workspace through here.
import { sql } from "drizzle-orm";

import type { Db } from "../db";

/** A uid in the alliance's rosters, as the last roster that listed them had them. */
export interface LastSeen {
  uid: number;
  name: string;
  power: number | null;
  kills: number | null;
  /** When the upstream read that roster. */
  at: Date;
}

const rosters = (unionId: number) => sql`
  select u.uid, u.name, u.power, u.kills, r.source_updated_at as at
  from daily_rosters r
  cross join lateral unnest(r.member_uids, r.member_names, r.member_power, r.member_kills)
    as u(uid, name, power, kills)
  where r.union_id = ${unionId} and r.error is null and r.source_updated_at is not null
  union all
  select u.uid, u.name, u.power, u.kills, a.source_updated_at
  from alliance_snapshots a
  join snapshots s on s.id = a.snapshot_id
  join events e on e.id = s.event_id
  cross join lateral unnest(a.member_uids, a.member_names, a.member_power, a.member_kills)
    as u(uid, name, power, kills)
  where a.union_id = ${unionId} and a.error is null and a.source_updated_at is not null
    and not e.is_test and e.visibility <> 'admin'`;

/** Each uid the alliance's rosters ever listed, with the last roster that did. */
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
      select 1 from alliance_snapshots a
      join snapshots s on s.id = a.snapshot_id
      join events e on e.id = s.event_id
      where a.union_id = ${unionId} and a.error is null and not e.is_test
        and e.visibility <> 'admin' and ${uid}::bigint = any(a.member_uids)
    ) as found`);
  return result.rows[0]?.found === true;
}

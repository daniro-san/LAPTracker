// Members who joined / left per alliance between an event's two snapshots (main table, plan Phase 5), matched
// by uid, and what they moved in the alliance's Might and Kills (D69 amendment, 2026-11-21). Summed in SQL:
// only counts and sums per alliance leave the database.
import { and, desc, gt, inArray, sql } from "drizzle-orm";

import type { Db } from "../db";
import { dailyRosters } from "../schema";

/** What the members who joined and those who left account for in one total. */
export type MemberShare = { joined: number; left: number };

/**
 * `joined`: the joiners' figures at their first reading of the event in the alliance (a sample, else the
 * End), so what they gained or lost after joining stays in the event. `left`: the leavers' figures at the
 * Start. A null figure counts as 0 (D15, as #271). The total less `joined` plus `left` is the change without
 * them.
 */
export type RosterChange = { joined: number; left: number; kills: MemberShare; power: MemberShare };

type ChangeRow = {
  union_id: string;
  joined: string;
  left_n: string;
  joined_kills: number;
  joined_power: number;
  left_kills: number;
  left_power: number;
};

/** Each alliance in both snapshots (only `unionId`, when given) with its roster change. */
export async function rosterChanges(
  db: Db,
  eventId: number,
  snapshotIds: { before: number; after: number },
  unionId?: number,
): Promise<Map<number, RosterChange>> {
  const only = unionId === undefined ? sql`true` : sql`a.union_id = ${unionId}`;
  const result = await db.execute<ChangeRow>(sql`
    with b as (
      select a.union_id, m.uid, m.kills, m.power from alliance_snapshots a
      join member_snapshots m on m.alliance_snapshot_id = a.id
      where a.snapshot_id = ${snapshotIds.before} and ${only}
    ),
    e as (
      select a.union_id, m.uid, m.kills, m.power from alliance_snapshots a
      join member_snapshots m on m.alliance_snapshot_id = a.id
      where a.snapshot_id = ${snapshotIds.after} and ${only}
    ),
    firsts as (
      select distinct on (a.union_id, u.uid) a.union_id, u.uid, u.kills, u.power
      from snapshots s
      join alliance_snapshots a on a.snapshot_id = s.id and a.error is null
      cross join lateral unnest(a.member_uids, a.member_kills, a.member_power) as u(uid, kills, power)
      where s.event_id = ${eventId} and s.phase = 'sample' and s.status <> 'running' and ${only}
      order by a.union_id, u.uid, s.slot_at
    ),
    j as (
      select e.union_id, count(*) as n, sum(coalesce(f.kills, e.kills, 0))::float8 as kills,
        sum(coalesce(f.power, e.power, 0))::float8 as power
      from e
      left join b on b.union_id = e.union_id and b.uid = e.uid
      left join firsts f on f.union_id = e.union_id and f.uid = e.uid
      where b.uid is null
      group by e.union_id
    ),
    l as (
      select b.union_id, count(*) as n, sum(coalesce(b.kills, 0))::float8 as kills,
        sum(coalesce(b.power, 0))::float8 as power
      from b left join e on e.union_id = b.union_id and e.uid = b.uid
      where e.uid is null
      group by b.union_id
    )
    select u.union_id, coalesce(j.n, 0) as joined, coalesce(l.n, 0) as left_n,
      coalesce(j.kills, 0) as joined_kills, coalesce(j.power, 0) as joined_power,
      coalesce(l.kills, 0) as left_kills, coalesce(l.power, 0) as left_power
    from (select distinct union_id from e intersect select distinct union_id from b) u
    left join j on j.union_id = u.union_id
    left join l on l.union_id = u.union_id`);
  return new Map(
    result.rows.map((r) => [
      Number(r.union_id),
      {
        joined: Number(r.joined),
        left: Number(r.left_n),
        kills: { joined: Number(r.joined_kills), left: Number(r.left_kills) },
        power: { joined: Number(r.joined_power), left: Number(r.left_power) },
      },
    ]),
  );
}

/**
 * Each alliance's member count from its newest daily read that counted members (D60), for the tracker-call
 * estimates (D134). An alliance with none is absent.
 */
export async function latestMemberCounts(
  db: Db,
  unionIds: readonly number[],
): Promise<Map<number, number>> {
  if (unionIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([dailyRosters.unionId], {
      unionId: dailyRosters.unionId,
      members: dailyRosters.memberCount,
    })
    .from(dailyRosters)
    .where(and(inArray(dailyRosters.unionId, [...unionIds]), gt(dailyRosters.memberCount, 0)))
    .orderBy(dailyRosters.unionId, desc(dailyRosters.readDay));
  return new Map(rows.map((r) => [r.unionId, r.members ?? 0]));
}

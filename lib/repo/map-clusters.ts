// The officers' map's other alliances (issue 817, D163 amendment 2026-11-28): for each tracked alliance but
// the own one, its tag, its member count and the centre of its members' places, from the stored daily
// rosters of one server day (no upstream call). The centre is averaged in the database, so no other
// alliance's member place, name or uid leaves it.
import { sql } from "drizzle-orm";

import type { Db } from "../db";

/** The fewest placed members a cluster is drawn for: a mean of one or two places would show (or nearly
 * show) one member's own place. */
export const MIN_PLACED = 3;

/** Another alliance on the map: its tag, its members, and the mean of their places in map squares. */
export interface MapCluster {
  tag: string;
  members: number;
  x: number;
  y: number;
}

/**
 * The other alliances' clusters from the newest server day on or before `day` that has a usable roster
 * with raw_json, with that roster's newest time; none when there is no such day. One statement, bounded by
 * the day (daily_rosters_day_union_unique, D149). A member counts when the roster lists its uid and sent
 * both x and y as numbers. An alliance with fewer than MIN_PLACED placed members has no cluster.
 */
export async function mapClusters(
  db: Db,
  ownUnionId: number,
  day: string,
): Promise<{ at: Date | null; clusters: MapCluster[] }> {
  const result = await db.execute<{
    tag: string;
    members: number;
    x: number;
    y: number;
    at: string | Date | null;
  }>(sql`
    with d as (
      select max(read_day) as day from daily_rosters
      where read_day <= ${day} and is_fresh and error is null and raw_json is not null
    ), placed as (
      select r.union_id, coalesce(r.tag, r.name) as tag, r.member_count, r.source_updated_at,
        case when jsonb_typeof(m->'x') = 'number' and jsonb_typeof(m->'y') = 'number'
          and exists (select 1 from unnest(r.member_uids) u where to_jsonb(u) = m->'uid')
          then 1 end as ok,
        case when jsonb_typeof(m->'x') = 'number' then (m->>'x')::float8 end as x,
        case when jsonb_typeof(m->'y') = 'number' then (m->>'y')::float8 end as y
      from daily_rosters r
      cross join lateral jsonb_array_elements(r.raw_json->'members') m
      where r.read_day = (select day from d) and r.union_id <> ${ownUnionId}
        and r.is_fresh and r.error is null and r.member_count > 0
    )
    select tag, member_count as members, avg(x) filter (where ok = 1) as x,
      avg(y) filter (where ok = 1) as y, max(source_updated_at) as at
    from placed
    where tag is not null
    group by union_id, tag, member_count
    having count(ok) >= ${MIN_PLACED}
    order by tag`);
  const times = result.rows.flatMap((r) => (r.at ? [new Date(r.at).getTime()] : []));
  return {
    at: times.length > 0 ? new Date(Math.max(...times)) : null,
    clusters: result.rows.map((r) => ({
      tag: r.tag,
      members: Number(r.members),
      x: Number(r.x),
      y: Number(r.y),
    })),
  };
}

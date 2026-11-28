// Race to #1 (issue 285): the top tracked alliances by might today and their place in RACE_AHEAD weeks at
// this pace. The pace is the median of an alliance's last RACE_WEEKS Saturday-to-Saturday might changes, from
// its usable daily reads (/v1, D60: no ranks board number enters a change, D5), with the lowest and highest of
// those weeks. An alliance whose membership moved more than RACE_MOVED_MAX in those weeks, or without a usable
// read on each of their Saturdays, has no pace. Alliance totals only: the member uids are compared in SQL and
// only the counts come back; no member row, name or roster key is selected.
import { sql } from "drizzle-orm";

import { rankBy } from "../compute";
import type { Db } from "../db";
import { dailyFit } from "./history-readings";

/** How many alliances, the greatest might today first, the race looks at. */
export const RACE_TOP = 10;
/** How many Saturday-to-Saturday changes a pace takes the median of. */
export const RACE_WEEKS = 3;
/** How many weeks ahead the place is projected. */
export const RACE_AHEAD = 4;
/** Members who joined plus members who left, as a share of the first Saturday's: above this, no pace. */
export const RACE_MOVED_MAX = 0.1;

interface Label {
  unionId: number;
  tag: string | null;
  name: string | null;
}

export interface RaceRow extends Label {
  badgeId: number | null;
  might: number;
  /** Place by might today among the rows, 1 first. */
  rank: number;
  /** Might in RACE_AHEAD weeks at this pace. */
  projected: number;
  /** Place by `projected` among the rows. */
  projectedRank: number;
  /** The median weekly change, then the lowest and highest week. */
  pace: number;
  low: number;
  high: number;
}

export interface RaceLeft extends Label {
  /** "moved": membership changed a lot; "few": not a usable read on every Saturday. */
  reason: "moved" | "few";
}

export interface Race {
  /** The newest usable daily read's day. */
  today: string;
  /** The first and the last Saturday of the weeks. */
  from: string;
  to: string;
  /** By `rank`. */
  rows: RaceRow[];
  /** Greatest might today first. */
  left: RaceLeft[];
}

interface Raw {
  union_id: string;
  tag: string | null;
  name: string | null;
  badge_id: number | null;
  might: string;
  today: string;
  first: string;
  last: string;
  saturdays: number;
  pace: number | null;
  low: string | null;
  high: string | null;
  moved: number | null;
  base: number | null;
}

/** One row per alliance of the top RACE_TOP of the newest day (its tracked set, D133), with its weeks. */
const raceSql = sql`
  with today as (
    select max(read_day) as day from daily_rosters where ${dailyFit} and total_power is not null
  ),
  tracked as (
    select alliance_ids from tracked_sets, today where tracked_sets.day <= today.day
    order by tracked_sets.day desc limit 1
  ),
  top as (
    select union_id, tag, name, badge_id, total_power from daily_rosters, today
    where read_day = today.day and ${dailyFit} and total_power is not null
      and (not exists (select 1 from tracked) or exists (select 1 from tracked where union_id = any(tracked.alliance_ids)))
    order by total_power desc, union_id limit ${RACE_TOP}
  ),
  sats as (
    select g, (today.day - (extract(isodow from today.day)::int + 1) % 7 - 7 * g) as day
    from today, generate_series(0, ${RACE_WEEKS}) g
  ),
  weekly as (
    select daily_rosters.union_id, sats.g, daily_rosters.member_uids,
      daily_rosters.total_power - lead(daily_rosters.total_power)
        over (partition by daily_rosters.union_id order by sats.g) as change
    from sats join daily_rosters on daily_rosters.read_day = sats.day
    where daily_rosters.union_id in (select union_id from top) and ${dailyFit}
      and daily_rosters.total_power is not null
  ),
  ends as (
    select n.union_id, cardinality(o.member_uids) as base,
      (select count(*) from unnest(n.member_uids) u where u <> all(o.member_uids))
      + (select count(*) from unnest(o.member_uids) u where u <> all(n.member_uids)) as moved
    from weekly n join weekly o on o.union_id = n.union_id and o.g = ${RACE_WEEKS}
    where n.g = 0
  )
  select top.union_id, top.tag, top.name, top.badge_id, top.total_power as might,
    (select day from today)::text as today,
    (select day from sats where g = ${RACE_WEEKS})::text as first,
    (select day from sats where g = 0)::text as last,
    count(weekly.g)::int as saturdays,
    percentile_cont(0.5) within group (order by weekly.change) as pace,
    min(weekly.change) as low, max(weekly.change) as high,
    ends.moved::int as moved, ends.base::int as base
  from top
  left join weekly on weekly.union_id = top.union_id
  left join ends on ends.union_id = top.union_id
  group by top.union_id, top.tag, top.name, top.badge_id, top.total_power, ends.moved, ends.base
  order by top.total_power desc, top.union_id`;

/** The race over the newest usable daily read; null before the first one. */
export async function racePace(db: Db): Promise<Race | null> {
  const { rows } = await db.execute<Raw & Record<string, unknown>>(raceSql);
  const head = rows[0];
  if (!head) return null;
  const paced: Omit<RaceRow, "rank" | "projectedRank">[] = [];
  const left: RaceLeft[] = [];
  for (const r of rows) {
    const label = { unionId: Number(r.union_id), tag: r.tag, name: r.name };
    if (r.saturdays < RACE_WEEKS + 1 || r.pace === null) left.push({ ...label, reason: "few" });
    else if (!r.base || (r.moved ?? 0) / r.base > RACE_MOVED_MAX)
      left.push({ ...label, reason: "moved" });
    else {
      const might = Number(r.might);
      const pace = Number(r.pace);
      const projected = might + RACE_AHEAD * pace;
      paced.push({
        ...label,
        badgeId: r.badge_id,
        might,
        projected,
        pace,
        low: Number(r.low),
        high: Number(r.high),
      });
    }
  }
  const rank = rankBy(paced.map((r) => [r.unionId, r.might] as const));
  const ahead = rankBy(paced.map((r) => [r.unionId, r.projected] as const));
  const ranked = paced
    .map((r) => ({
      ...r,
      rank: rank.get(r.unionId) ?? 0,
      projectedRank: ahead.get(r.unionId) ?? 0,
    }))
    .sort((a, b) => a.rank - b.rank || a.unionId - b.unionId);
  return { today: head.today, from: head.first, to: head.last, rows: ranked, left };
}

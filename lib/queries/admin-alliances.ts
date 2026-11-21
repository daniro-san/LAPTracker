// /admin's Alliances table (issue 485, D144): what each workspace spent, from our own tables, in one statement
// grouped by workspace. Tracker calls of its own reads (the squads read and the Raid Shield check's morning
// read) on the quota day and the 7 quota days to it; Discord posts that went through its webhooks today (UTC);
// errors under its address in the last 24 h; when an officer last used the desk (D108's `seen_at`). Counts
// and times only: no name, no key, no webhook. Owner only (PIN).
import { sql } from "drizzle-orm";

import type { Db } from "../db";
import { usageDay } from "../workspace-features";

export interface AllianceUsage {
  /** Tracker calls on the quota day (`day`), and on it and the 6 quota days before. */
  callsToday: number;
  calls7d: number;
  /** Webhook posts that went through since 00:00 UTC: notices, garrison plans, thanks, and the shield
   * summary (one a day at most: its message is edited in place, `posted_at` the newest post or edit). */
  postsToday: number;
  /** Notice, garrison and thanks posts that failed since 00:00 UTC (a webhook Discord refused, or no answer). */
  postsFailed: number;
  /** app_errors rows under the workspace's address in the 24 h before `now`. */
  errors24h: number;
  /** The newest desk request of an officer's session still stored; null when none is. */
  officerSeenAt: Date | null;
}

const HOUR_MS = 3_600_000;

/** One row of the statement: Postgres sends a count (bigint) as a string. */
interface UsageRow extends Record<string, unknown> {
  id: number;
  calls_today: string | number;
  calls_7d: string | number;
  posts: string | number;
  failed: string | number;
  errors: string | number;
  seen: Date | string | null;
}

/**
 * Every workspace's usage, by workspace id. `day` is the quota day's daily read (`quotaDayRead`), the key of
 * `squad_reads` and `shield_checks`. Each part reads a bounded window through an index (the two reads' day
 * keys, `app_errors_at_idx`) or a small table (posts, sessions).
 */
export async function allianceUsage(
  db: Db,
  day: string,
  now: Date,
): Promise<Map<number, AllianceUsage>> {
  const dayStart = new Date(`${usageDay(now)}T00:00:00Z`).toISOString();
  const since = new Date(now.getTime() - 24 * HOUR_MS).toISOString();
  const result = await db.execute<UsageRow>(sql`
    with calls as (
      select union_id, sum(n) filter (where day = ${day}::date) as today, sum(n) as week
      from (
        select day, union_id, calls_used as n from squad_reads
        where day between ${day}::date - 6 and ${day}::date
        union all
        select day, union_id, morning_calls from shield_checks
        where day between ${day}::date - 6 and ${day}::date
      ) c
      group by union_id
    ),
    posts as (
      select workspace_id,
        count(*) filter (where status = 'posted') as n,
        count(*) filter (where status = 'failed') as failed
      from (
        select workspace_id, status from notice_publishes
        where published_at >= ${dayStart}
        union all
        -- A failed garrison post keeps its last try's time in posted_at, as a posted one does.
        select workspace_id, post_status from garrison_plans
        where posted_at >= ${dayStart}
        union all
        select workspace_id, status from thanks_shares
        where target = 'discord' and shared_at >= ${dayStart}
        union all
        select w.id, 'posted' from shield_checks s join workspaces w on w.union_id = s.union_id
        where s.posted_at >= ${dayStart}
      ) p
      group by workspace_id
    ),
    errors as (
      select workspace_slug, count(*) as n from app_errors
      where at >= ${since} and workspace_slug is not null
      group by workspace_slug
    ),
    seen as (
      select workspace_id, max(seen_at) as at from workspace_sessions
      where tier = 'officer'
      group by workspace_id
    )
    select w.id,
      coalesce(calls.today, 0) as calls_today,
      coalesce(calls.week, 0) as calls_7d,
      coalesce(posts.n, 0) as posts,
      coalesce(posts.failed, 0) as failed,
      coalesce(errors.n, 0) as errors,
      seen.at as seen
    from workspaces w
    left join calls on calls.union_id = w.union_id
    left join posts on posts.workspace_id = w.id
    left join errors on errors.workspace_slug = w.slug
    left join seen on seen.workspace_id = w.id`);
  return new Map(
    result.rows.map((r) => [
      Number(r.id),
      {
        callsToday: Number(r.calls_today),
        calls7d: Number(r.calls_7d),
        postsToday: Number(r.posts),
        postsFailed: Number(r.failed),
        errors24h: Number(r.errors),
        officerSeenAt: r.seen === null ? null : new Date(r.seen),
      },
    ]),
  );
}

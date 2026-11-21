// /admin's Alliances table (issue 485, D144): what each workspace spent, from our own tables, in one statement
// grouped by workspace. Tracker calls of its own reads (the squads read and the Raid Shield check's morning
// read) on the quota day and the 7 quota days to it; Discord posts that went through its webhooks today (UTC);
// errors under its address in the last 24 h; when an officer last used the desk (D108's `seen_at`); and when
// each setup step first happened (D145, amended 2026-11-21). Counts and times only: no name, no key, no
// webhook. Owner only (PIN).
import { sql } from "drizzle-orm";

import type { Db } from "../db";
import { usageDay } from "../workspace-features";

/** The setup steps, in order (#486's setup funnel, D145). */
export const SETUP_STEPS = [
  "created",
  "key_saved",
  "webhook",
  "first_roll_call",
  "first_notice",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
/** When the step first happened; "done" when it is done but no table keeps when; null: not yet. */
export type StepTime = Date | "done" | null;

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
  setup: Record<SetupStep, StepTime>;
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
  created: Date | string;
  key_saved: Date | string | null;
  key_kept: boolean | null;
  webhook: Date | string | null;
  first_roll_call: Date | string | null;
  first_notice: Date | string | null;
}

const at = (cell: Date | string | null) => (cell === null ? null : new Date(cell));

/**
 * The setup steps' parts of the statement: each step's first time in our own tables (D145, amended
 * 2026-11-21), so a workspace made before the analytics events existed shows its real dates:
 * - created: `workspaces.created_at`;
 * - key saved: the first `set` in `workspace_key_changes`, once a key was ever stored (`workspace_keys` has
 *   a row): a save's claim is written before the key's test and dropped when the key is refused, but a
 *   request that dies mid-test leaves it. "done" when a key is stored with no such row (only its status is
 *   read);
 * - webhook set: the earliest `saved_at` of its stored channels (a save again moves it later; Remove drops it);
 * - first roll call marked: the first `roll_call_marks` write of its roll calls;
 * - first notice published: the first `notice_publishes` row that went through.
 * The marks part reads each roll call's first mark from `roll_call_marks_call_written_idx`, one index probe
 * a roll call instead of every mark (D149); the others are small tables.
 */
const SETUP_PARTS = sql.raw(`key_set as (
      select workspace_id, min(changed_at) as at from workspace_key_changes
      where action = 'set'
      group by workspace_id
    ),
    hooks as (
      select workspace_id, min(saved_at) as at from workspace_webhooks
      group by workspace_id
    ),
    marked as (
      select r.workspace_id, min(m.at) as at
      from roll_calls r cross join lateral (
        select written_at as at from roll_call_marks
        where roll_call_id = r.id
        order by written_at limit 1
      ) m
      group by r.workspace_id
    ),
    published as (
      select workspace_id, min(published_at) as at from notice_publishes
      where status = 'posted'
      group by workspace_id
    )`);
const SETUP_COLUMNS = sql.raw(`w.created_at as created,
      case when k.workspace_id is not null then key_set.at end as key_saved,
      k.status <> 'unset' as key_kept,
      hooks.at as webhook,
      marked.at as first_roll_call,
      published.at as first_notice`);
const SETUP_JOINS = sql.raw(`left join key_set on key_set.workspace_id = w.id
    left join workspace_keys k on k.workspace_id = w.id
    left join hooks on hooks.workspace_id = w.id
    left join marked on marked.workspace_id = w.id
    left join published on published.workspace_id = w.id`);

function usageOf(r: UsageRow): AllianceUsage {
  return {
    callsToday: Number(r.calls_today),
    calls7d: Number(r.calls_7d),
    postsToday: Number(r.posts),
    postsFailed: Number(r.failed),
    errors24h: Number(r.errors),
    officerSeenAt: at(r.seen),
    setup: {
      created: new Date(r.created),
      key_saved: at(r.key_saved) ?? (r.key_kept ? "done" : null),
      webhook: at(r.webhook),
      first_roll_call: at(r.first_roll_call),
      first_notice: at(r.first_notice),
    },
  };
}

/**
 * Every workspace's usage, by workspace id. `day` is the quota day's daily read (`quotaDayRead`), the key of
 * `squad_reads` and `shield_checks`. Each part reads a bounded window through an index (the two reads' day
 * keys, `app_errors_at_idx`) or a small table (posts, sessions), plus the setup steps (SETUP_PARTS).
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
    ),
    ${SETUP_PARTS}
    select w.id,
      coalesce(calls.today, 0) as calls_today,
      coalesce(calls.week, 0) as calls_7d,
      coalesce(posts.n, 0) as posts,
      coalesce(posts.failed, 0) as failed,
      coalesce(errors.n, 0) as errors,
      seen.at as seen,
      ${SETUP_COLUMNS}
    from workspaces w
    left join calls on calls.union_id = w.union_id
    left join posts on posts.workspace_id = w.id
    left join errors on errors.workspace_slug = w.slug
    left join seen on seen.workspace_id = w.id
    ${SETUP_JOINS}`);
  return new Map(result.rows.map((r) => [Number(r.id), usageOf(r)]));
}

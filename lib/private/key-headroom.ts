// The key's headroom (D124 amendment 2026-11-28, issue 869): what this workspace's reads spent today on its
// tracker key, split by feature, what the plan still needs, and what the key has left as of its newest stored
// answer. Counts only, from our own tables: no upstream call, and never the key. Every function takes a
// WorkspaceAccess, so the workspace comes from the session, never from a request.
import { sql } from "drizzle-orm";

import type { Db } from "../db";
import { latestMemberCounts } from "../queries/rosters";
import { ESTIMATE_MEMBERS, trackerEstimate, usageDay } from "../workspace-features";
import type { WorkspaceAccess } from "./access";
import type { TrackerKeyView } from "./tracker-key";

/** What the tracker estimate says: calls on an ordinary quota day, and on Saturday (UTC). */
export interface Plan {
  daily: number;
  peak: number;
}

/**
 * The calls counted today, by feature. Squads includes Friday's Raid Shield read (that night's read IS the day's
 * squads read, D137). The raid opponent and the daily read are not attributable to one workspace (the site's
 * collector reads them for everyone, in one line for all alliances), so they are not counted here.
 */
export interface KeyCalls {
  squads: number;
  shield: number;
  afterReset: number;
  recruit: number;
}

const DAY_MS = 86_400_000;
const CODES: Record<string, keyof KeyCalls> = {
  "squads.batch": "squads",
  "shield.morning": "shield",
  "shield.reset": "afterReset",
  recruit: "recruit",
};

/**
 * One query, bounded to today's UTC quota day: the workspace's `squads.batch` lines (by its slug), its
 * `shield.morning` and `shield.reset` lines (by its alliance), and its recruit count. `run_logs` is read through
 * `read_day` (indexed) for today and yesterday, since Saturday morning's lines carry Friday's day, then cut to
 * the day by `at`. Another workspace's lines never match the slug or the alliance.
 */
export async function callsToday(db: Db, access: WorkspaceAccess, now: Date): Promise<KeyCalls> {
  const day = usageDay(now);
  const start = new Date(`${day}T00:00:00Z`);
  const before = usageDay(new Date(start.getTime() - DAY_MS));
  const end = new Date(start.getTime() + DAY_MS);
  const result = await db.execute<{ code: string; calls: number }>(sql`
    select code, calls from (
      select code,
        coalesce(sum(case when data->>'calls' ~ '^[0-9]+$' then (data->>'calls')::int end), 0)::int as calls
      from run_logs
      where read_day in (${day}::date, ${before}::date)
        and at >= ${start.toISOString()}::timestamptz
        and at < ${end.toISOString()}::timestamptz
        and (
          (code = 'squads.batch' and data->>'workspace' = ${access.slug})
          or (code in ('shield.morning', 'shield.reset') and union_id = ${access.unionId}::bigint)
        )
      group by code
      union all
      select 'recruit', used from recruit_reads
      where workspace_id = ${access.workspaceId} and day = ${day}::date
    ) counted`);
  const calls: KeyCalls = { squads: 0, shield: 0, afterReset: 0, recruit: 0 };
  for (const row of result.rows) {
    const feature = CODES[row.code];
    if (feature) calls[feature] += Number(row.calls);
  }
  return calls;
}

/** The calls the features on plan for today's quota day: Saturday (UTC) adds the weekly ones. */
export const plannedToday = (plan: Plan, now: Date): number =>
  now.getUTCDay() === 6 ? plan.peak : plan.daily;

export interface Headroom {
  calls: KeyCalls;
  /** The calls still planned today: the plan less what was counted, never below 0. */
  planned: number;
  /** The key's quota left as of its newest stored answer; null when none is known. */
  left: number | null;
  /** The plan needs more than the key has left. */
  short: boolean;
}

/** Pure: the headroom from the counts, the plan and the key's stored quota. */
export function headroomOf(
  calls: KeyCalls,
  plan: Plan,
  quotaRemaining: number | null,
  now: Date,
): Headroom {
  const used = calls.squads + calls.shield + calls.afterReset + calls.recruit;
  const planned = Math.max(0, plannedToday(plan, now) - used);
  const short = quotaRemaining !== null && planned > quotaRemaining;
  return { calls, planned, left: quotaRemaining, short };
}

/** Alliance settings: the card's numbers. Null when the key's state has no quota to measure. */
export async function headroomView(
  db: Db,
  access: WorkspaceAccess,
  view: TrackerKeyView,
  plan: Plan,
  now: Date,
): Promise<Headroom | null> {
  if (view.state !== "ok" && view.state !== "site") return null;
  return headroomOf(await callsToday(db, access, now), plan, view.quotaRemaining, now);
}

/**
 * Home's one-line warning: only when the plan exceeds what is left. Nothing is read without a stored quota;
 * the whole plan is the most that can still be needed, so when it already fits, no log query is made.
 */
export async function headroomWarning(
  db: Db,
  access: WorkspaceAccess,
  view: TrackerKeyView,
  now: Date,
): Promise<{ planned: number; left: number } | null> {
  const left = view.quotaRemaining;
  if (view.state !== "ok" || left === null) return null;
  const members = (await latestMemberCounts(db, [access.unionId])).get(access.unionId);
  const plan = trackerEstimate(access.features.on, members ?? ESTIMATE_MEMBERS);
  if (plannedToday(plan, now) <= left) return null;
  const h = headroomOf(await callsToday(db, access, now), plan, left, now);
  return h.short ? { planned: h.planned, left } : null;
}

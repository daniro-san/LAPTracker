// /admin's "Needs you" (issue 585, F11): what waits on the owner, one row per kind with its count in words and
// where it is done, only while there is one. Also the two verdicts Status shows beside its facts: today's API
// reading (F34: above the site's 1,000 a day is no "OK") and a late scheduler (the watcher's rule, D45/D141).
// Counts and times only (D71). English only (D48).
import type { PageIndexItem } from "@/lib/brand/components/layout/PageIndex";
import { DAILY_QUOTA } from "@/lib/budget";
import { copy, fill } from "@/lib/copy";
import type { CleanupJob } from "@/lib/queries/admin-page";
import { QUOTA_WARN_BELOW } from "@/lib/run";
import { heartbeatBoundary } from "@/lib/tick-gate";

import type { Look } from "./alliances-view";

const t = copy.admin.needs;

type Reading = { remaining: number | null; at: Date } | null;

const sameUtcDay = (a: Date, b: Date) =>
  a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/**
 * Today's API reading: none yet; from an earlier UTC day (the quota resets at 00:00 UTC, so no verdict);
 * above the site's daily quota (more than the site plans for, so no "OK", and no alarm either); under the
 * warning line; or ok.
 */
export type QuotaState = "unknown" | "old" | "above" | "low" | "ok";

export function quotaState(quota: Reading, now: Date): QuotaState {
  if (quota?.remaining == null) return "unknown";
  if (!sameUtcDay(quota.at, now)) return "old";
  if (quota.remaining > DAILY_QUOTA) return "above";
  return quota.remaining < QUOTA_WARN_BELOW ? "low" : "ok";
}

/**
 * The scheduler is late when its newest tick started before the newest heartbeat slot the watcher judges
 * (`heartbeatBoundary`, D45 amended by D141), or no tick was ever recorded: the watcher's own rule, so
 * /admin and the admin alert agree. An idle tick writes no row (D141), so a quiet hour is not late.
 */
export function tickLate(last: Date | null, now: Date): boolean {
  return last === null || last < heartbeatBoundary(now);
}

export interface NeedsInput {
  now: Date;
  /** The newest tick's start, and the same in words for the row. */
  tick: { last: Date | null; lastText: string | null };
  /** Today's daily read failed, partly failed or stuck, and Retry is offered (`dailyView`). */
  dailyRetry: boolean;
  /** Access requests with no answer yet. */
  requests: number;
  /** app_errors rows in the last 24 h. */
  errors24h: number;
  /** The daily jobs whose newest outcome failed (`failedCleanups`), newest first: the day's read and the
   * failure's day in words. */
  cleanups: readonly { job: CleanupJob; readDay: string; dayText: string }[];
  /** The Alliances rows' reasons (`attention`, D144): only setup and a key to fix count here. */
  workspaces: readonly { attention: readonly Look[] }[];
  /** Workspaces whose deletion is asked (D125): the owner can still cancel it. */
  deletions: number;
  /** The newest daily read's first quota check (`morningQuota`), taken before the day's spend; the only
   * reading "low" counts from. */
  morningQuota: Reading;
  /** Owner to-dos not done (lib/patch-notes.ts). */
  todos: number;
}

/** A row of "Needs you": a PageIndex row whose link may go to another admin page. */
export type NeedRow = PageIndexItem & { href: string };

const n = (x: number) => x.toLocaleString("en");

/** A row's state in words, or null when it does not wait. */
type Need = [id: string, href: string, label: string, state: string | null];

const counted = (count: number, words: string) => (count > 0 ? fill(words, { n: n(count) }) : null);

/**
 * The workspaces' row: "1 to set up · 1 with a key to fix". Page errors have their own row, and a used-up
 * limit or a key out of quota mends at 00:00 UTC, so neither counts here (owner and product reviews).
 */
function workspacesState(rows: NeedsInput["workspaces"]): string | null {
  const having = (look: Look) => rows.filter((r) => r.attention.includes(look)).length;
  const parts = [counted(having("setup"), t.setup), counted(having("key"), t.key)].filter(
    (p) => p !== null,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "Low" only from the reading taken before the day's spend: after the event's runs it is low by design. */
function quotaLowState(morning: Reading, now: Date): string | null {
  return quotaState(morning, now) === "low" && morning?.remaining != null
    ? fill(t.low, { n: n(morning.remaining) })
    : null;
}

function tickState({ now, tick }: NeedsInput): string | null {
  if (!tickLate(tick.last, now)) return null;
  return tick.lastText ? fill(t.late, { at: tick.lastText }) : t.noTick;
}

/** The rows that wait, in the order the owner acts on them (what stops runs first); empty when none does. */
export function needsYou(input: NeedsInput): NeedRow[] {
  const needs: Need[] = [
    ["need-tick", "#status", t.tick, tickState(input)],
    ["need-daily", "#run", t.daily, input.dailyRetry ? t.retry : null],
    ["need-requests", "#new-alliances", t.requests, counted(input.requests, t.waiting)],
    ["need-errors", "/admin/errors", t.errors, counted(input.errors24h, t.errors24h)],
    // Linked to the newest failure's run log, which holds the failed job's line (issue 507).
    [
      "need-cleanup",
      `/admin/runs/daily/${input.cleanups[0]?.readDay ?? ""}`,
      t.cleanup,
      input.cleanups.length > 0
        ? input.cleanups.map((c) => fill(t.cleanupFailed[c.job], { day: c.dayText })).join(" · ")
        : null,
    ],
    ["need-workspaces", "#alliances", t.workspaces, workspacesState(input.workspaces)],
    ["need-deletions", "#workspaces", t.deletions, counted(input.deletions, t.asked)],
    ["need-quota", "#status", t.quota, quotaLowState(input.morningQuota, input.now)],
    ["need-todos", "/admin/changes#todo", t.todos, counted(input.todos, t.open)],
  ];
  // The to-dos stand for weeks, so they wait without yarn: the after-build first-glance test read "25 open"
  // as weighing as much as a request waiting today.
  return needs.flatMap(([id, href, label, state]) =>
    state === null ? [] : [{ id, href, label, state, attention: id !== "need-todos" }],
  );
}

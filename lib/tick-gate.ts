// Whether a scheduler call needs the database at all (D141, issue 521). Neon's compute wakes on the first
// query and stays up about 5 minutes after the last, so a tick that only finds nothing to do still costs
// those minutes. The clock rules come first and need no database; the two facts only the database knows (a
// rehearsal pressed on /admin, the day's squads queue settled) are kept in the wake cache once they hold.
import type { AppContext } from "./app-context";
import type { Db } from "./db";
import { REHEARSAL_AFTER_MS } from "./rehearsal";
import { getDailyRead } from "./repo/daily-reads";
import { hasPendingRehearsal } from "./repo/rehearsals";
import { dayRosterUids, getSquadRead } from "./repo/squads";
import {
  dailyReadDue,
  eventsToCreate,
  lastOccurrence,
  quotaCheckDue,
  serverInstant,
  type ScheduleConfig,
} from "./schedule";
import { shieldWindowOpen } from "./shield-check";
import { squadsQueueDay } from "./squads";
import { squadTargets } from "./workspace-keys";

const MINUTE = 60_000;
const DAY_MS = 86_400_000;

/** The scheduled event's row is made in this first part of its day-ahead window (four ticks). */
export const CREATE_SPAN_MS = 60 * MINUTE;
/** The tick opens the database at least once every this many hours (00, 06, 12, 18 UTC), for D45's watcher. */
export const HEARTBEAT_EVERY_H = 6;
/**
 * A kept "settled" or "no rehearsal pending" is checked again after this long, should a forget be missed.
 * The writes that change either fact forget them (the rehearsal press, the daily read's Retry, a tracker key,
 * a feature switch), so this is only a bound.
 */
export const KEPT_MAX_AGE_S = 24 * 60 * 60;

const windowMs = (cfg: ScheduleConfig) => cfg.SNAPSHOT_WINDOW_MIN * MINUTE;

/** The 15-minute slot at the start of every HEARTBEAT_EVERY_H hours (UTC), plus `offsetMin`. */
const inHeartbeatSlot = (now: Date, offsetMin: number) =>
  now.getUTCHours() % HEARTBEAT_EVERY_H === 0 &&
  now.getUTCMinutes() >= offsetMin &&
  now.getUTCMinutes() < offsetMin + 15;

/** The tick slot that always opens the database, so the heartbeat row (D45) is never older than 6 h. */
export const heartbeatSlot = (now: Date) => inHeartbeatSlot(now, 0);

/** The watcher's slot, half an hour after the heartbeat's: the only time it reads the tick log. */
export const watchSlot = (now: Date) => inHeartbeatSlot(now, 30);

/**
 * The tick's own work (lib/tick.ts) can be due by the clock alone: the scheduled event's row in the first
 * hour of its day-ahead window, its Before-to-After span with samples, the Friday check, a REHEARSAL_AT slot
 * and the rehearsal it makes (Before at +15 min, After at +45 min, each with its window), the daily read.
 */
export function tickClockDue(now: Date, cfg: ScheduleConfig): boolean {
  const t = now.getTime();
  const w = windowMs(cfg);
  const scheduled = eventsToCreate(now, cfg).some(
    (e) => t >= e.beforeAt.getTime() || t < e.beforeAt.getTime() - DAY_MS + CREATE_SPAN_MS,
  );
  const rehearsal = cfg.REHEARSAL_AT.split(",")
    .filter((slot) => slot.trim() !== "")
    .some((slot) => t < lastOccurrence(slot, now, cfg).getTime() + w + REHEARSAL_AFTER_MS + w);
  return (
    heartbeatSlot(now) ||
    scheduled ||
    rehearsal ||
    quotaCheckDue(now, cfg) !== null ||
    dailyReadDue(now, cfg) !== null
  );
}

/**
 * Every squads target of `day` is done, stopped or skipped, or has no roster that could still come (the
 * day's read is over and its window closed): until a target or a roster changes, no batch has work.
 */
async function squadsSettled(ctx: AppContext, db: Db, day: string, now: Date): Promise<boolean> {
  const closed =
    now.getTime() >=
    serverInstant(day, ctx.env.DAILY_ROSTER_AT, ctx.env).getTime() + windowMs(ctx.env);
  const daily = await getDailyRead(db, day);
  if (!daily) return closed;
  if (daily.status === "running") return false;
  for (const target of await squadTargets(db, ctx.env.WORKSPACE_KEYS_SECRET, now)) {
    const row = await getSquadRead(db, day, target.unionId);
    if (row?.status === "running") return false;
    // No row yet: its first batch is due once its roster is in, and a roster can come until the window closes.
    if (!row && (!closed || (await dayRosterUids(db, day, target.unionId)))) return false;
  }
  return true;
}

/**
 * A tick's squads batch can have work (D132): from the quota day's daily read until the batch would cross
 * the 00:00 UTC reset, and until every target's queue is settled. No query before the read or after the reset.
 */
export async function squadsMayRun(ctx: AppContext, db: Db): Promise<boolean> {
  const now = ctx.now();
  const day = squadsQueueDay(now, ctx.env);
  if (!day || now < serverInstant(day, ctx.env.DAILY_ROSTER_AT, ctx.env)) return false;
  const settled = await ctx.wakeCache.holds(`squads-settled:${day}`, KEPT_MAX_AGE_S, () =>
    squadsSettled(ctx, db, day, now),
  );
  return !settled;
}

/**
 * Whether the tick needs the database now: the clock's windows, the Raid Shield check's (D137), the squads
 * queue, or a rehearsal pressed on /admin that is still pending. False means 204 with no query at all.
 */
export async function tickMayBeDue(ctx: AppContext, db: Db): Promise<boolean> {
  const now = ctx.now();
  if (tickClockDue(now, ctx.env) || shieldWindowOpen(now, ctx.env)) return true;
  if (await squadsMayRun(ctx, db)) return true;
  const idle = await ctx.wakeCache.holds(
    "no-rehearsal-pending",
    KEPT_MAX_AGE_S,
    async () => !(await hasPendingRehearsal(db, now, windowMs(ctx.env))),
  );
  return !idle;
}

// The scheduler's decision (plan §3.1), event-driven: scheduled events' rows are created from the env a
// day ahead; every event (scheduled or rehearsal) carries its own before_at/after_at; one action per tick.
// Between an event's Before and After, a sample every SAMPLE_EVERY_MIN (D69), only when no phase is due.
// The daily roster read (D60) comes last, when nothing else is due; after the day's first one, the workspaces
// whose deletion grace ended are deleted (D125), and app_errors older than 30 days go (D115).
import { secretsOf, type AppContext } from "./app-context";
import { RUN_DEADLINE_MS } from "./compute";
import { autoRetryDailyRead, runDailyRead, type DailyReadSummary } from "./daily-read";
import { databaseDown } from "./data-unavailable";
import type { Db } from "./db";
import {
  createNotifier,
  discordClock,
  rehearsalSkippedMessage,
  tickSilenceMessage,
} from "./notify";
import { dailyReadMessage } from "./notify-daily";
import { createRehearsal, type RehearsalResult } from "./rehearsal";
import { claimAlert, purgeOldAppErrors, TICK_SILENCE_ALERT } from "./repo/app-errors";
import {
  claimQuotaCheck,
  duePhases,
  dueSample,
  findOrCreateEvent,
  type NewEvent,
} from "./repo/events";
import { pruneEndedPictures } from "./repo/notice-picture-cleanup";
import { clearOldPlayerRaw } from "./repo/player-reads";
import { claimSlot, setSlotOutcome } from "./repo/rehearsals";
import { latestTickAt } from "./repo/ticks";
import { purgeDueWorkspaces } from "./repo/workspace-purge";
import { reportError } from "./report-error";
import { executeSample, executeSnapshot, quotaReport, type RunOutcome } from "./run";
import {
  dailyReadDue,
  endsInServerDay,
  eventsToCreate,
  nextEvent,
  quotaCheckDue,
  rehearsalSlotsDue,
  serverDay,
  slotOf,
} from "./schedule";
import { heartbeatBoundary } from "./tick-gate";
import { dayTargets, trackedChangeMessage } from "./tracked";

export type TickOutcome =
  | { kind: "idle" }
  | { kind: "run"; outcome: RunOutcome }
  | { kind: "sample"; slotAt: Date; outcome: RunOutcome }
  | { kind: "quota-check"; eventId: number; remaining: number | null; picturesPruned: number }
  | { kind: "rehearsal"; slotAt: Date; result: RehearsalResult }
  /** retried: the tick's automatic retry (D72), the day's last attempt; its failures notify officers (D148). */
  | { kind: "daily-read"; summary: DailyReadSummary; retried: boolean };

/** A scheduled slot that may not run is skipped once, with one admin note (plan §3.1). */
async function scheduledRehearsal(ctx: AppContext, db: Db, slotAt: Date): Promise<TickOutcome> {
  const result = await createRehearsal(db, ctx.now(), ctx.env);
  await setSlotOutcome(
    db,
    slotAt,
    result.ok ? "created" : result.reason,
    result.ok ? result.eventId : null,
  );
  if (!result.ok) {
    await createNotifier(ctx.env, ctx.fetch).admin(
      rehearsalSkippedMessage(result.reason, discordClock(ctx.env.SERVER_TZ).stamp(slotAt)),
      { test: true },
    );
  }
  return { kind: "rehearsal", slotAt, result };
}

/** The day's roster read when its window holds `now` and no caller claimed the day yet; on a later tick
 * in the window, once, the alliances it left without a roster (D72). One admin line when it falls
 * short. It runs on a scheduled event's day too (D72 supersedes D60's skip). */
async function dailyRead(
  ctx: AppContext,
  db: Db,
  now: Date,
  origin: string,
): Promise<TickOutcome | null> {
  const due = dailyReadDue(now, ctx.env);
  // INVARIANT daily-read.ends-before-midnight
  if (!due || !endsInServerDay(now, RUN_DEADLINE_MS, ctx.env)) return null;
  const deps = { v1: ctx.v1, now: ctx.now, secrets: secretsOf(ctx.env) };
  // D133: the day's ranks board and tracked set first (no quota), then the set and the
  // workspaces' alliances.
  const keys = { internal: ctx.internal, now: ctx.now, secret: ctx.env.WORKSPACE_KEYS_SECRET };
  const { set, targets } = await invalidateOnThrow(ctx, () => dayTargets(keys, db, due.day));
  // INVARIANT cache.write-invalidates-reads (D143): the day's board and set, then the read and its retry,
  // are on the public pages at their first view after the write. In the tick's body, not in `after`.
  if (set?.created) ctx.publicCache.invalidate();
  const change = set && (await trackedChangeMessage(db, set, origin));
  if (change) await createNotifier(ctx.env, ctx.fetch).admin(change);
  const first = await readThenInvalidate(ctx, () => runDailyRead(deps, db, due.day, targets));
  // D125: once a day, after the day's first read, the workspaces whose 14 days ended are deleted; D132:
  // and the player reads' raw bodies older than 90 days are cleared; D115: app_errors past 30 days go.
  if (first) await purgeWorkspaces(ctx, db, ctx.now());
  const summary =
    first ?? (await readThenInvalidate(ctx, () => autoRetryDailyRead(deps, db, due.day, targets)));
  if (!summary) return null;
  if (summary.status !== "complete") {
    const at = discordClock(ctx.env.SERVER_TZ).stamp(ctx.now());
    await createNotifier(ctx.env, ctx.fetch).admin(dailyReadMessage(summary, at, origin));
  }
  return { kind: "daily-read", summary, retried: first === null };
}

/** A daily read, then the public pages' shared reads dropped when it ran (null: another caller had the day),
 * or when it threw part way, since its rows may be partly written. Not when the database is down: the kept
 * pages are then all the public site has (D143). */
async function readThenInvalidate<T>(ctx: AppContext, read: () => Promise<T | null>) {
  let ran = true;
  try {
    const result = await read();
    ran = result !== null;
    return result;
  } catch (error) {
    ran = !databaseDown(error);
    throw error;
  } finally {
    if (ran) ctx.publicCache.invalidate();
  }
}

/** `write`, and when it throws part way (its rows may be partly written) the shared reads dropped; not when
 * the database is down, when the kept pages are all the public site has (D143). */
async function invalidateOnThrow<T>(ctx: AppContext, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (!databaseDown(error)) ctx.publicCache.invalidate();
    throw error;
  }
}

/**
 * The daily jobs of D125, D132 (raw bodies past 90 days) and D115 (app_errors past 30 days): counts only in
 * the log, and a failure never fails the day's read. A job that throws is one code-only line and a handled
 * PostHog exception (D115's 2026-11-21 amendment).
 */
async function purgeWorkspaces(ctx: AppContext, db: Db, now: Date): Promise<void> {
  await purgeDueWorkspaces(db, now)
    .then(({ workspaces, rows, failed }) => {
      console.info("workspaces.purged", { workspaces, rows, failed: failed.length });
      // One workspace's failure stops none of the others: each is logged by its error class.
      for (const code of failed)
        console.error("workspaces.purge_failed", { code, workspaces, rows });
    })
    .catch(tickJobFailed(ctx, "workspaces.purge_failed"));
  await clearOldPlayerRaw(db, now)
    .then((reads) => console.info("players.raw_cleared", { reads }))
    .catch(tickJobFailed(ctx, "players.raw_clear_failed"));
  await purgeOldAppErrors(db, now)
    .then((rows) => console.info("app_errors.purged", { rows }))
    .catch(tickJobFailed(ctx, "app_errors.purge_failed"));
}

/** A tick job's failure: a code-only line, and PostHog's handled exception. */
const tickJobFailed = (ctx: AppContext, code: string) => (error: unknown) => {
  console.error(code, { code: error instanceof Error ? error.name : "unknown" });
  reportError(ctx, { route: "/api/tick", kind: code, error });
};

/** The due sample of the slot holding now (D69), or null: a slot no tick took is not caught up.
 * SAMPLE_EVERY_MIN=0 is off. */
async function sample(
  ctx: AppContext,
  db: Db,
  now: Date,
  origin: string,
): Promise<TickOutcome | null> {
  if (ctx.env.SAMPLE_EVERY_MIN === 0) return null;
  const slotAt = slotOf(now, ctx.env.SAMPLE_EVERY_MIN);
  const event = await dueSample(db, slotAt);
  if (!event) return null;
  const outcome = await executeSample(ctx, db, { event, slotAt, origin });
  // INVARIANT sample.once-per-slot: another caller took this slot first, which is what the tick wanted.
  if (!outcome.ok && outcome.code === "sample_taken") return { kind: "idle" };
  return { kind: "sample", slotAt, outcome };
}

/** findOrCreateEvent; a row it creates is in every public page's event list (D143). */
async function eventRow(ctx: AppContext, db: Db, event: NewEvent) {
  const row = await findOrCreateEvent(db, event);
  if (row.created) ctx.publicCache.invalidate();
  return row;
}

export async function runTick(ctx: AppContext, db: Db, origin: string): Promise<TickOutcome> {
  const now = ctx.now();
  // (1) The coming scheduled event gets its row a day ahead, with its times fixed from the env then.
  for (const event of eventsToCreate(now, ctx.env)) await eventRow(ctx, db, event);

  // (2) At most one phase per tick: the earliest open window without a snapshot row.
  const [due] = await duePhases(db, now, ctx.env.SNAPSHOT_WINDOW_MIN * 60_000);
  if (due) {
    const outcome = await executeSnapshot(ctx, db, {
      event: due.event,
      phase: due.phase,
      force: false,
      origin,
    });
    // Another caller took the phase between our read and our claim: it holds what the tick wanted,
    // so this tick did nothing wrong and answers 204 (D43 amends D26).
    if (
      !outcome.ok &&
      (outcome.code === "snapshot_running" || outcome.code === "snapshot_complete")
    )
      return { kind: "idle" };
    return { kind: "run", outcome };
  }

  // (2b) A sample (D69): only on a tick that runs no phase, so Before and After always come first.
  const sampled = await sample(ctx, db, now, origin);
  if (sampled) return sampled;

  // (3) The Friday check, claimed on the coming scheduled event's row so it runs once.
  if (quotaCheckDue(now, ctx.env)) {
    const event = await eventRow(ctx, db, nextEvent(now, ctx.env));
    if (await claimQuotaCheck(db, event.id, now)) {
      const report = await quotaReport(ctx, db, { always: true });
      // The weekly cleanup of notice pictures (D119): deletes the warned ones, warns the next. The count only.
      // A failure is logged by its code and never fails the Friday check (review of PR 422).
      const picturesPruned = await pruneEndedPictures(db, serverDay(now, ctx.env), now).catch(
        (error: unknown) => {
          tickJobFailed(ctx, "notices.pictures.prune_failed")(error);
          return 0;
        },
      );
      console.info("notices.pictures.pruned", { count: picturesPruned });
      return {
        kind: "quota-check",
        eventId: event.id,
        remaining: report.remaining,
        picturesPruned,
      };
    }
  }

  // (4) REHEARSAL_AT: the first tick in a slot's window claims it.
  for (const slotAt of rehearsalSlotsDue(now, ctx.env)) {
    // INVARIANT rehearsal.once-per-slot
    if (await claimSlot(db, slotAt)) return scheduledRehearsal(ctx, db, slotAt);
  }

  // (5) The daily roster read (D60): last, once per server day inside its window, plus at most one
  // automatic retry of what fell short (D72). Never an event.
  return (await dailyRead(ctx, db, now, origin)) ?? { kind: "idle" };
}

/** The silence alert's repeat gap (D45). */
export const TICK_SILENCE_MS = 60 * 60_000;

/**
 * The watcher's check (POST /api/tick/watch, D45, D141): when the newest tick started before the newest
 * heartbeat slot it can judge (`heartbeatBoundary`), or none was ever recorded, one admin alert per silent
 * hour. No quota.
 */
export async function watchTicks(ctx: AppContext, db: Db): Promise<boolean> {
  const now = ctx.now();
  const last = await latestTickAt(db);
  if (last && last >= heartbeatBoundary(now)) return false;
  // INVARIANT tick.silence-alert-hourly: the claim decides which call posts, once per hour.
  if (!(await claimAlert(db, TICK_SILENCE_ALERT, now, TICK_SILENCE_MS))) return false;
  const at = last && {
    min: Math.floor((now.getTime() - last.getTime()) / 60_000),
    at: discordClock(ctx.env.SERVER_TZ).stamp(last),
  };
  await createNotifier(ctx.env, ctx.fetch).admin(tickSilenceMessage(at));
  return true;
}

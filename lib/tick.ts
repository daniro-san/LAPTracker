// The scheduler's decision (plan §3.1), event-driven: scheduled events' rows are created from the env a
// day ahead; every event (scheduled or rehearsal) carries its own before_at/after_at; one action per tick.
// The daily roster read (D60) comes last, when nothing else is due.
import type { AppContext } from "./app-context";
import { runDailyRead, type DailyReadSummary } from "./daily-read";
import type { Db } from "./db";
import {
  createNotifier,
  dailyReadMessage,
  discordClock,
  rehearsalSkippedMessage,
  tickSilenceMessage,
} from "./notify";
import { createRehearsal, type RehearsalResult } from "./rehearsal";
import { claimAlert, TICK_SILENCE_ALERT } from "./repo/app-errors";
import { claimQuotaCheck, duePhases, findOrCreateEvent, hasScheduledEvent } from "./repo/events";
import { claimSlot, setSlotOutcome } from "./repo/rehearsals";
import { latestTickAt } from "./repo/ticks";
import { executeSnapshot, quotaReport, type RunOutcome } from "./run";
import {
  dailyReadDue,
  eventsToCreate,
  nextEvent,
  quotaCheckDue,
  rehearsalSlotsDue,
} from "./schedule";
import { DAILY_ROSTER_IDS } from "../config/alliances";

export type TickOutcome =
  | { kind: "idle" }
  | { kind: "run"; outcome: RunOutcome }
  | { kind: "quota-check"; eventId: number; remaining: number | null }
  | { kind: "rehearsal"; slotAt: Date; result: RehearsalResult }
  | { kind: "daily-read"; summary: DailyReadSummary };

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

/** The day's roster read when its window holds `now` and no caller claimed the day yet; one admin
 * line when it falls short. Skipped on a scheduled event's day: its snapshots read the same rosters,
 * and the member history uses them (D60). The event's row exists by then (step 1, a day ahead). */
async function dailyRead(ctx: AppContext, db: Db, now: Date): Promise<TickOutcome | null> {
  const due = dailyReadDue(now, ctx.env);
  // INVARIANT daily-read.not-on-event-day
  if (!due || (await hasScheduledEvent(db, due.from, due.to))) return null;
  const summary = await runDailyRead(ctx, db, due.day, DAILY_ROSTER_IDS);
  if (!summary) return null;
  if (summary.status !== "complete") {
    const at = discordClock(ctx.env.SERVER_TZ).stamp(ctx.now());
    await createNotifier(ctx.env, ctx.fetch).admin(dailyReadMessage(summary, at));
  }
  return { kind: "daily-read", summary };
}

export async function runTick(ctx: AppContext, db: Db, origin: string): Promise<TickOutcome> {
  const now = ctx.now();
  // (1) The coming scheduled event gets its row a day ahead, with its times fixed from the env then.
  for (const event of eventsToCreate(now, ctx.env)) await findOrCreateEvent(db, event);

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

  // (3) The Friday check, claimed on the coming scheduled event's row so it runs once.
  if (quotaCheckDue(now, ctx.env)) {
    const event = await findOrCreateEvent(db, nextEvent(now, ctx.env));
    if (await claimQuotaCheck(db, event.id, now)) {
      const report = await quotaReport(ctx, db, { always: true });
      return { kind: "quota-check", eventId: event.id, remaining: report.remaining };
    }
  }

  // (4) REHEARSAL_AT: the first tick in a slot's window claims it.
  for (const slotAt of rehearsalSlotsDue(now, ctx.env)) {
    // INVARIANT rehearsal.once-per-slot
    if (await claimSlot(db, slotAt)) return scheduledRehearsal(ctx, db, slotAt);
  }

  // (5) The daily roster read (D60): last, once per server day inside its window. Never an event.
  return (await dailyRead(ctx, db, now)) ?? { kind: "idle" };
}

/** No tick for longer than this means the scheduler stopped (D45); also the alert's repeat gap. */
export const TICK_SILENCE_MS = 60 * 60_000;

/**
 * The watcher's check (POST /api/tick/watch, D45): when the newest tick started more than
 * TICK_SILENCE_MS ago, or none was ever recorded, one admin alert per silent hour. No quota.
 */
export async function watchTicks(ctx: AppContext, db: Db): Promise<boolean> {
  const now = ctx.now();
  const last = await latestTickAt(db);
  if (last && now.getTime() - last.getTime() <= TICK_SILENCE_MS) return false;
  // INVARIANT tick.silence-alert-hourly: the claim decides which call posts, once per hour.
  if (!(await claimAlert(db, TICK_SILENCE_ALERT, now, TICK_SILENCE_MS))) return false;
  const at = last && {
    min: Math.floor((now.getTime() - last.getTime()) / 60_000),
    at: discordClock(ctx.env.SERVER_TZ).stamp(last),
  };
  await createNotifier(ctx.env, ctx.fetch).admin(tickSilenceMessage(at));
  return true;
}

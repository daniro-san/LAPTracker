// The scheduler's decision (plan §3.1), event-driven: Saturday rows are created from the env a day
// ahead; every event (Saturday or rehearsal) carries its own before_at/after_at; one action per tick.
import type { AppContext } from "./app-context";
import type { Db } from "./db";
import { createNotifier, discordClock, rehearsalSkippedMessage } from "./notify";
import { createRehearsal, type RehearsalResult } from "./rehearsal";
import { claimQuotaCheck, duePhases, findOrCreateEvent } from "./repo/events";
import { claimSlot, setSlotOutcome } from "./repo/rehearsals";
import { executeSnapshot, quotaReport, type RunOutcome } from "./run";
import { eventsToCreate, nextEvent, quotaCheckDue, rehearsalSlotsDue } from "./schedule";

export type TickOutcome =
  | { kind: "idle" }
  | { kind: "run"; outcome: RunOutcome }
  | { kind: "quota-check"; eventId: number; remaining: number | null }
  | { kind: "rehearsal"; slotAt: Date; result: RehearsalResult };

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

export async function runTick(ctx: AppContext, db: Db, origin: string): Promise<TickOutcome> {
  const now = ctx.now();
  // (1) The coming Saturday gets its row a day ahead, with its times fixed from the env then.
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

  // (3) The Friday check, claimed on the coming Saturday's row so it runs once.
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
  return { kind: "idle" };
}

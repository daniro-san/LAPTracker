// The read model for the views that set events side by side on their 15-minute samples (issue 284, D86):
// the server fight clock and the compare page's server pulse. Alliance totals only, never rosters.
//
// One notion of "sampled" (`sampledEventIds`): a public event with at least one usable sample, i.e. a
// `phase = 'sample'` snapshot that finished and holds an alliance row that was read and is fresh. Every
// view reads it from here. It is its own query, not a count on `listEvents`: `listEvents` runs on every
// page (the header's event list), and only these views need the answer.
//
// An event that is not sampled is listed all the same, marked, with no slots, and costs no row read. A
// sampled event's rows come from `rowsOf`, the event cache's `progress-done` key once its End has a row
// (D79), so a finished event costs nothing after the first view; a live one is read at most once a minute.
import { and, eq, exists, inArray, isNull, ne } from "drizzle-orm";

import type { Db } from "../db";
import { eventClock, offReason, type EventClock, type OffReason } from "../fight-clock";
import { serverPulse } from "../live";
import { serverMinuteOfDay } from "../schedule";
import { allianceSnapshots, events, snapshots } from "../schema";
import { listEvents, type EventSummary } from "./events";
import { readingsOf, type ProgressRow } from "./live";
import { publicEvent } from "./visibility";

/** The ids among `ids` (all public events when omitted) that have a usable sample. */
export async function sampledEventIds(db: Db, ids?: readonly number[]): Promise<Set<number>> {
  if (ids?.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ id: events.id })
    .from(events)
    .innerJoin(snapshots, eq(snapshots.eventId, events.id))
    .where(
      and(
        publicEvent,
        ids ? inArray(events.id, [...ids]) : undefined,
        eq(snapshots.phase, "sample"),
        ne(snapshots.status, "running"),
        exists(
          db
            .select({ one: allianceSnapshots.id })
            .from(allianceSnapshots)
            .where(
              and(
                eq(allianceSnapshots.snapshotId, snapshots.id),
                eq(allianceSnapshots.isFresh, true),
                isNull(allianceSnapshots.error),
              ),
            ),
        ),
      ),
    );
  return new Set(rows.map((r) => r.id));
}

/** An event's rows for the pulse, as the event cache keeps them: `done` says its End has a row. */
export type RowsOf = (eventId: number, done: boolean) => Promise<ProgressRow[]>;

export interface PulseOptions {
  /** `SAMPLE_EVERY_MIN`. */
  everyMin: number;
  /** `SERVER_TZ`: the clock the slots line up on. */
  serverTz: string;
  rowsOf: RowsOf;
}

export interface EventPulse {
  id: number;
  sampled: boolean;
  /** Null when the event is not sampled; its slots may be empty when its Start or samples cannot be read. */
  clock: EventClock | null;
}

/**
 * The slots of each event on the server clock, in the order given: for a sampled event the per-slot kills,
 * shares, states and its busiest 30 minutes; for an unsampled one `sampled: false` and no slots. Events
 * are read one after the other: a cold cache holds as many database connections as one.
 */
export async function eventPulses(
  db: Db,
  refs: readonly { id: number; done: boolean }[],
  { everyMin, serverTz, rowsOf }: PulseOptions,
): Promise<EventPulse[]> {
  const sampled = await sampledEventIds(
    db,
    refs.map((r) => r.id),
  );
  const out: EventPulse[] = [];
  for (const { id, done } of refs) {
    if (!sampled.has(id)) {
      out.push({ id, sampled: false, clock: null });
      continue;
    }
    const { start, samples } = readingsOf(await rowsOf(id, done));
    const pulse = start ? serverPulse([start, ...samples], everyMin * 60_000) : [];
    out.push({
      id,
      sampled: true,
      clock: eventClock(pulse, everyMin, (at) => serverMinuteOfDay(at, { SERVER_TZ: serverTz })),
    });
  }
  return out;
}

export type FightClockEvent = EventSummary & {
  pulse: EventPulse;
  /** Why the event is off; null when it is sampled. */
  off: OffReason | null;
};

/** The newest scheduled events the fight clock shows: about three months of weekly events (D86). */
export const FIGHT_CLOCK_EVENTS = 12;

/** The End has a row: the event is over and its reads can be kept for a day (D79). */
export const isDone = (e: Pick<EventSummary, "snapshots">) =>
  e.snapshots.some((s) => s.phase === "after");

/**
 * The server fight clock's data: the newest `FIGHT_CLOCK_EVENTS` public scheduled events (a manual round
 * has no schedule), newest first, each sampled or off. `listed` is the whole event list, for the header's selector.
 */
export async function getFightClock(db: Db, now: Date, options: PulseOptions) {
  const listed = await listEvents(db);
  const allScheduled = listed.filter((e) => !e.manual);
  const scheduled = allScheduled.slice(0, FIGHT_CLOCK_EVENTS);
  const pulses = await eventPulses(
    db,
    scheduled.map((e) => ({ id: e.id, done: isDone(e) })),
    options,
  );
  // The first sampled event over every scheduled event, not only the ones shown: once the window slides, an
  // older unsampled event must not name a later date.
  const everSampled = await sampledEventIds(
    db,
    allScheduled.map((e) => e.id),
  );
  const sampledAt = allScheduled
    .filter((e) => everSampled.has(e.id))
    .map((e) => e.eventAtUtc.getTime());
  const firstSampledAt = sampledAt.length ? new Date(Math.min(...sampledAt)) : null;
  const rows = scheduled.map((e, i): FightClockEvent => {
    const pulse = pulses[i] as EventPulse;
    return {
      ...e,
      pulse,
      off: pulse.sampled
        ? null
        : offReason({ eventAtUtc: e.eventAtUtc, ended: isDone(e) }, firstSampledAt, now),
    };
  });
  return { listed, events: rows };
}

// The event page's data, loaded once per request for both the page and its <title> (React `cache`).
// What depends only on the database for one event goes through the shared event cache (issue 327).
import type { Metadata } from "next";
import { cache } from "react";

import { getAppContext } from "@/lib/app-context";
import { DONE_MAX_AGE_S, LIVE_MAX_AGE_S } from "@/lib/event-cache";
import { withPageDb } from "@/lib/page";
import { getEventPage } from "@/lib/queries/event-page";
import {
  eventPulses,
  getFightClock,
  type EventPulse,
  type PulseOptions,
  type RowsOf,
} from "@/lib/queries/fight-clock";
import { eventProgressOf, progressRows } from "@/lib/queries/live";

import { requestClock, requestCopy } from "./locale";

// The turnout so far is read only while the event has no End: a live event's entry. Its read opens its own
// connection, because Next can run it in the background after this request's connection is closed.
export const loadEventPage = cache((id: number | null) =>
  withPageDb((db) =>
    getEventPage(db, id, getAppContext().env.SNAPSHOT_WINDOW_MIN, (eventId, load) =>
      getAppContext().eventCache.read(eventId, "turnout-so-far", LIVE_MAX_AGE_S, () =>
        withPageDb(load),
      ),
    ),
  ),
);

/** `Sat, Oct 31 · Event Ledger`: the event's day, so tabs and shared links tell events apart. */
export async function eventTitle({
  page,
}: Awaited<ReturnType<typeof loadEventPage>>): Promise<Metadata> {
  if (!page) return {};
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  return { title: `${clock.weekday(page.detail.eventAtUtc)} · ${copy.site.name}` };
}

/**
 * The live section's data (issue 307). Its rows are shared between requests (a database connection is
 * opened only on a miss); the figures are computed from them per request, because they depend on `now`.
 * An event whose End has a row gets no more samples, so its entry is kept longer, under its own key.
 */
export async function loadProgress(
  detail: { id: number; snapshots: readonly { phase: string }[] },
  now: Date,
) {
  const done = detail.snapshots.some((s) => s.phase === "after");
  const rows = await progressRowsOf(detail.id, done);
  return eventProgressOf(rows, { now, everyMin: getAppContext().env.SAMPLE_EVERY_MIN });
}

/** An event's progress rows through the shared cache, under the key its End picks (issue 327): the
 * event page and the views across events (D86) read the same entry. */
export const progressRowsOf: RowsOf = (eventId, done) =>
  getAppContext().eventCache.read(
    eventId,
    done ? "progress-done" : "progress",
    done ? DONE_MAX_AGE_S : LIVE_MAX_AGE_S,
    () => withPageDb((db) => progressRows(db, eventId)),
  );

/** What the views across events need to read each event's slots (D86). */
export const pulseOptions = (): PulseOptions => {
  const { env } = getAppContext();
  return { everyMin: env.SAMPLE_EVERY_MIN, serverTz: env.SERVER_TZ, rowsOf: progressRowsOf };
};

/** The server fight clock's data (D86), once per request. Its rows come through the shared event cache. */
export const loadFightClock = cache(async () => {
  const options = pulseOptions();
  const data = await withPageDb((db) => getFightClock(db, getAppContext().now(), options));
  return { ...data, everyMin: options.everyMin };
});

/** Events A and B of the compare page on their samples (D86), once per request. */
export const loadComparePulses = cache(
  async (a: number, aDone: boolean, b: number, bDone: boolean) => {
    const options = pulseOptions();
    const [pa, pb] = await withPageDb((db) =>
      eventPulses(
        db,
        [
          { id: a, done: aDone },
          { id: b, done: bDone },
        ],
        options,
      ),
    );
    return { pulses: { a: pa as EventPulse, b: pb as EventPulse }, everyMin: options.everyMin };
  },
);

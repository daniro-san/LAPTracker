// The event page's data, loaded once per request for both the page and its <title> (React `cache`).
// What depends only on the database for one event goes through the shared event cache (issue 327).
import type { Metadata } from "next";
import { cache } from "react";

import { getAppContext } from "@/lib/app-context";
import { DONE_MAX_AGE_S, LIVE_MAX_AGE_S } from "@/lib/event-cache";
import { withPageDb } from "@/lib/page";
import { getEventPage } from "@/lib/queries/event-page";
import { eventProgressOf, progressRows } from "@/lib/queries/live";

import { requestClock, requestCopy } from "./locale";

// The turnout so far is read only while the event has no End: a live event's entry.
export const loadEventPage = cache((id: number | null) =>
  withPageDb((db) =>
    getEventPage(db, id, (eventId, load) =>
      getAppContext().eventCache.read(eventId, "turnout-so-far", LIVE_MAX_AGE_S, load),
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
  const { eventCache, env } = getAppContext();
  const done = detail.snapshots.some((s) => s.phase === "after");
  const rows = await eventCache.read(
    detail.id,
    done ? "progress-done" : "progress",
    done ? DONE_MAX_AGE_S : LIVE_MAX_AGE_S,
    () => withPageDb((db) => progressRows(db, detail.id)),
  );
  return eventProgressOf(rows, { now, everyMin: env.SAMPLE_EVERY_MIN });
}

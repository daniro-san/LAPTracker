// The event page's data, loaded once per request for both the page and its <title> (React `cache`).
import type { Metadata } from "next";
import { cache } from "react";

import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { getEventPage } from "@/lib/queries/event-page";
import { eventProgress } from "@/lib/queries/live";

import { requestClock, requestCopy } from "./locale";

export const loadEventPage = cache((id: number | null) => withPageDb((db) => getEventPage(db, id)));

/** `Sat, Oct 31 · Event Ledger`: the event's day, so tabs and shared links tell events apart. */
export async function eventTitle({
  page,
}: Awaited<ReturnType<typeof loadEventPage>>): Promise<Metadata> {
  if (!page) return {};
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  return { title: `${clock.weekday(page.detail.eventAtUtc)} · ${copy.site.name}` };
}

/** The live section's data (issue 307): read per request, not cached, because it depends on `now`. */
export const loadProgress = (eventId: number, now: Date) =>
  withPageDb((db) => eventProgress(db, eventId, { now, everyMin: getEnv().SAMPLE_EVERY_MIN }));

// The event page's data, loaded once per request for both the page and its <title> (React `cache`).
import type { Metadata } from "next";
import { cache } from "react";

import { withPageDb } from "@/lib/page";
import { getEventPage } from "@/lib/queries/event-page";

import { requestClock, requestCopy } from "./locale";

export const loadEventPage = cache((id: number | null) => withPageDb((db) => getEventPage(db, id)));

/** `Sat, Oct 31 · OG's LAP Tracker`: the event's day, so tabs and shared links tell events apart. */
export async function eventTitle({
  page,
}: Awaited<ReturnType<typeof loadEventPage>>): Promise<Metadata> {
  if (!page) return {};
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  return { title: `${clock.weekday(page.detail.eventAtUtc)} · ${copy.site.name}` };
}

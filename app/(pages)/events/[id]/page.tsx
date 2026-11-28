// `/events/[id]`: any past event, same component as `/` (plan Phase 5).
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { eventTitle, loadEventPage } from "@/app/_ui/event-page";
import { comparisonRows } from "@/app/_ui/event-rows";
import { EventView } from "@/app/_ui/EventView";
import { cardText, eventCard } from "@/app/_ui/link-card-facts";
import { notFoundTitle, requestCopy, requestLocale } from "@/app/_ui/locale";
import { cardPreview } from "@/app/_ui/preview";

const idOf = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : null);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idOf((await params).id);
  const loaded = id === null ? null : await loadEventPage(id);
  if (!loaded?.page) return notFoundTitle();
  const [meta, copy, locale] = await Promise.all([
    eventTitle(loaded),
    requestCopy(),
    requestLocale(),
  ]);
  // The ledger's first rows, as the page orders them, are the link preview's facts (issue 830).
  const { detail, changes, names, ranks } = loaded.page;
  const rows = comparisonRows(detail.snapshots, changes, names, ranks, copy, detail.between);
  const title = String(meta.title);
  const facts = cardText(eventCard(title, null, rows, locale));
  return { ...meta, ...cardPreview(`/img/card/event/${detail.id}`, title, facts) };
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ interval?: string | string[] }>;
}) {
  const id = idOf((await params).id);
  if (id === null) notFound();
  const [{ events, homeId, page }, { interval }] = await Promise.all([
    loadEventPage(id),
    searchParams,
  ]);
  if (!page) notFound();
  const drill = {
    path: `/events/${id}`,
    interval: typeof interval === "string" ? interval : undefined,
  };
  // EventView reads the live section: which cache entry it uses depends on the page's End (issue 327).
  return <EventView events={events} homeId={homeId} {...page} drill={drill} />;
}

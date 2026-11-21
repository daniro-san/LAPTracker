// `/events/[id]`: any past event, same component as `/` (plan Phase 5).
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { eventTitle, loadEventPage } from "@/app/_ui/event-page";
import { EventView } from "@/app/_ui/EventView";
import { notFoundTitle } from "@/app/_ui/locale";

const idOf = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : null);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idOf((await params).id);
  const loaded = id === null ? null : await loadEventPage(id);
  return loaded?.page ? eventTitle(loaded) : notFoundTitle();
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idOf((await params).id);
  if (id === null) notFound();
  const { events, homeId, page } = await loadEventPage(id);
  if (!page) notFound();
  // EventView reads the live section: which cache entry it uses depends on the page's End (issue 327).
  return <EventView events={events} homeId={homeId} {...page} />;
}

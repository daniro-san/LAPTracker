// `/events/[id]`: any past event, same component as `/` (plan Phase 5).
import { notFound } from "next/navigation";

import { EventView } from "@/app/_ui/EventView";
import { withPageDb } from "@/lib/page";
import { getEventPage } from "@/lib/queries/event-page";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  if (!/^\d{1,9}$/.test(raw)) notFound();
  const { events, page } = await withPageDb((db) => getEventPage(db, Number(raw)));
  if (!page) notFound();
  return <EventView events={events} {...page} />;
}

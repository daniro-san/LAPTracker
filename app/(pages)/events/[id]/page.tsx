// `/events/[id]`: any past event, same component as `/` (plan Phase 5).
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { eventTitle, loadEventPage, loadProgress } from "@/app/_ui/event-page";
import { EventView } from "@/app/_ui/EventView";

const idOf = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : null);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idOf((await params).id);
  return id === null ? {} : eventTitle(await loadEventPage(id));
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idOf((await params).id);
  if (id === null) notFound();
  // The live section's read does not depend on the page's: start both together.
  const [{ events, homeId, page }, progress] = await Promise.all([
    loadEventPage(id),
    loadProgress(id, new Date()),
  ]);
  if (!page) notFound();
  return <EventView events={events} homeId={homeId} {...page} progress={progress} />;
}

// `/`: the most recent event's comparison (plan Phase 5).
import type { Metadata } from "next";

import { EmptyEvents } from "@/app/_ui/EmptyEvents";
import { eventTitle, loadEventPage } from "@/app/_ui/event-page";
import { EventView } from "@/app/_ui/EventView";

export async function generateMetadata(): Promise<Metadata> {
  return eventTitle(await loadEventPage(null));
}

export default async function HomePage() {
  const { events, page } = await loadEventPage(null);
  if (!page) return <EmptyEvents />;
  return <EventView events={events} {...page} />;
}

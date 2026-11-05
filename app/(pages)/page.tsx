// `/`: the most recent event's comparison (plan Phase 5).
import { EmptyEvents } from "@/app/_ui/EmptyEvents";
import { EventView } from "@/app/_ui/EventView";
import { withPageDb } from "@/lib/page";
import { getEventPage } from "@/lib/queries/event-page";

export default async function HomePage() {
  const { events, page } = await withPageDb((db) => getEventPage(db, null));
  if (!page) return <EmptyEvents />;
  return <EventView events={events} {...page} />;
}

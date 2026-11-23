// `/`: the home event's comparison (`homeEvent`: the newest event with data, D28; plan Phase 5).
import type { Metadata } from "next";

import { EmptyEvents } from "@/app/_ui/EmptyEvents";
import { eventTitle, loadEventPage } from "@/app/_ui/event-page";
import { EventView } from "@/app/_ui/EventView";

export async function generateMetadata(): Promise<Metadata> {
  return eventTitle(await loadEventPage(null));
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string | string[] }>;
}) {
  const [{ events, homeId, page }, { interval }] = await Promise.all([
    loadEventPage(null),
    searchParams,
  ]);
  if (!page) return <EmptyEvents />;
  const drill = { path: "/", interval: typeof interval === "string" ? interval : undefined };
  return <EventView events={events} homeId={homeId} {...page} drill={drill} />;
}

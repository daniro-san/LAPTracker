// events table.
import { eq } from "drizzle-orm";

import type { Db } from "../db";
import { events } from "../schema";
import type { EventRow } from "./index";

export async function getEvent(db: Db, eventId: number): Promise<EventRow | null> {
  const [row] = await db
    .select({ id: events.id, allianceIds: events.allianceIds })
    .from(events)
    .where(eq(events.id, eventId));
  return row ?? null;
}

export async function setEventAllianceIds(db: Db, eventId: number, ids: number[]): Promise<void> {
  await db.update(events).set({ allianceIds: ids }).where(eq(events.id, eventId));
}

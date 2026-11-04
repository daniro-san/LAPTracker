// events table.
import { and, eq, isNull } from "drizzle-orm";

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

export interface ScheduledEvent {
  id: number;
  quotaCheckedAt: Date | null;
}

/**
 * The event at `eventAtUtc`, created on first use with no alliances (the BEFORE run copies them).
 * Insert-or-nothing then select, so two concurrent ticks end up with the same row.
 */
export async function findOrCreateEvent(
  db: Db,
  name: string,
  eventAtUtc: Date,
): Promise<ScheduledEvent> {
  await db
    .insert(events)
    .values({ name, eventAtUtc, allianceIds: [] })
    .onConflictDoNothing({ target: events.eventAtUtc });
  const [row] = await db
    .select({ id: events.id, quotaCheckedAt: events.quotaCheckedAt })
    .from(events)
    .where(eq(events.eventAtUtc, eventAtUtc));
  if (!row) throw new Error("event row missing after insert");
  return row;
}

/** A dry-run event (plan Phase 7), so a weekday test never touches the coming Saturday's event. */
export async function createTestEvent(db: Db, name: string, eventAtUtc: Date): Promise<number> {
  const [row] = await db
    .insert(events)
    .values({ name, eventAtUtc, allianceIds: [], isTest: true })
    .returning({ id: events.id });
  if (!row) throw new Error("test event insert returned no row");
  return row.id;
}

/** Claims the event's Friday check; true for exactly one caller. */
export async function claimQuotaCheck(db: Db, eventId: number, at: Date): Promise<boolean> {
  // INVARIANT tick.friday-check-once
  const rows = await db
    .update(events)
    .set({ quotaCheckedAt: at })
    .where(and(eq(events.id, eventId), isNull(events.quotaCheckedAt)))
    .returning({ id: events.id });
  return rows.length > 0;
}

// `--with-states` of scripts/seed.ts: the two states the three past events cannot show.
import type { Db } from "../lib/db";
import { events, snapshots } from "../lib/schema";
import type { BaseAlliance } from "./seed-data";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LAST_SEED_DAY = "2026-10-31";

/** `--with-states`: an empty scheduled event a week ahead, and one whose After snapshot is running. */
export async function seedStates(
  db: Db,
  base: BaseAlliance[],
  now: Date,
  seedBefore: (eventId: number, day: Date) => Promise<void>,
): Promise<void> {
  const ahead = new Date(now.getTime() + 7 * DAY);
  ahead.setUTCHours(12, 0, 0, 0);
  const [empty] = await db
    .insert(events)
    .values({
      name: `Seed Saturday Event ${ahead.toISOString().slice(0, 10)}`,
      eventAtUtc: new Date(ahead.getTime() + 2 * HOUR),
      allianceIds: base.map((a) => a.unionId),
      beforeAt: ahead,
      afterAt: new Date(ahead.getTime() + 4 * HOUR),
    })
    .returning({ id: events.id });
  if (!empty) throw new Error("seed: the empty event was not inserted");
  const day = new Date(`${LAST_SEED_DAY}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 7);
  const [live] = await db
    .insert(events)
    .values({
      name: `Seed Saturday Event ${day.toISOString().slice(0, 10)}`,
      eventAtUtc: new Date(day.getTime() + 2 * HOUR),
      allianceIds: base.map((a) => a.unionId),
      beforeAt: day,
      afterAt: new Date(day.getTime() + 4 * HOUR),
    })
    .returning({ id: events.id });
  if (!live) throw new Error("seed: the running event was not inserted");
  await seedBefore(live.id, day);
  await db.insert(snapshots).values({
    eventId: live.id,
    phase: "after",
    startedAt: new Date(now.getTime() - 30_000),
    status: "running",
  });
}

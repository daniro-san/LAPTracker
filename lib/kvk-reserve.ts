// The KvK opponent's part of the reserves outside a run (D152): the squads read, lookups, the Raid Shield
// checks and the daily read keep the opponent's calls still due, and only on the KvK's quota day with an
// opponent saved. Split from lib/squads.ts, which stays pure.
import type { Db } from "./db";
import { opponentCallsDueAt } from "./repo/kvk";
import type { ScheduleConfig } from "./schedule";
import { eventOnQuotaDay } from "./squads";

/** The opponent's calls still due on `now`'s quota day; 0 on any other day (no query) and with no opponent. */
export async function opponentReserve(db: Db, now: Date, cfg: ScheduleConfig): Promise<number> {
  const event = eventOnQuotaDay(now, cfg);
  return event ? opponentCallsDueAt(db, event.eventAtUtc, now) : 0;
}

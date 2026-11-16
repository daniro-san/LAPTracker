// Daily roster reads for scripts/seed.ts (D60): one a day from Sunday to Friday after each of the first
// two seeded Saturdays, so the player page's Daily progress and the member history show daily readings.
// Might drifts part of the way from one event's End to the next event's Start; kills stay where the End
// reading left them (the real ones are unchanged day to day and move at events). Reseeding gives the same
// numbers.
import type { Db } from "../lib/db";
import { dailyReads, dailyRosters } from "../lib/schema";
import { rosterAt, type BaseAlliance } from "./seed-data";

const DAY = 86_400_000;
const WEEKS = [
  { event: 0, sunday: "2026-10-18" },
  { event: 1, sunday: "2026-10-25" },
];

/** Alliance `i`'s roster, its might `share` of the way from event `event`'s End to event `event + 1`'s Start. */
function rosterRow(base: BaseAlliance[], i: number, event: number, share: number) {
  const from = rosterAt(base, i, event, "after");
  const next = new Map(rosterAt(base, i, event + 1, "before").members.map((m) => [m.uid, m]));
  const step = (a: number, b: number) => Math.round(a + (b - a) * share);
  const members = from.members.map((m) => {
    const to = next.get(m.uid) ?? m;
    return { ...m, power: step(m.power, to.power) };
  });
  const a = base[i] as BaseAlliance;
  return {
    unionId: a.unionId,
    tag: from.tag,
    name: from.name,
    badgeId: i === 4 ? null : a.badgeId, // as the event rows: alliance 4 without a badge
    memberCount: members.length,
    totalPower: members.reduce((s, m) => s + m.power, 0),
    totalKills: members.reduce((s, m) => s + m.kills, 0),
    isFresh: true,
    memberUids: members.map((m) => m.uid),
    memberNames: members.map((m) => m.name),
    memberPower: members.map((m) => m.power),
    memberKills: members.map((m) => m.kills),
  };
}

/** Twelve complete daily reads of every seeded alliance, at 08:01 UTC (06:01 server time). */
export async function seedDaily(db: Db, base: BaseAlliance[]): Promise<void> {
  for (const { event, sunday } of WEEKS) {
    for (let d = 0; d < 6; d++) {
      const at = new Date(new Date(`${sunday}T08:01:00Z`).getTime() + d * DAY);
      const day = at.toISOString().slice(0, 10);
      await db.insert(dailyReads).values({
        day,
        startedAt: at,
        finishedAt: new Date(at.getTime() + 50_000),
        status: "complete",
        callsUsed: base.length + 1,
      });
      await db.insert(dailyRosters).values(
        base.map((_, i) => ({
          ...rosterRow(base, i, event, (d + 1) / 7),
          readDay: day,
          sourceUpdatedAt: new Date(at.getTime() + 30_000),
        })),
      );
    }
  }
}

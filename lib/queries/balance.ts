// Server power balance (D85, issue 283): each tracked alliance's might from its newest usable daily roster
// (D60; event rosters are not counted) and the top share per day. Alliance totals only: no member row, name
// or roster key is selected.
import { and, desc, gte, isNotNull } from "drizzle-orm";

import { concentration, type BalanceAlliance, type ConcentrationPoint } from "../balance";
import type { Db } from "../db";
import { newestEventIds, recentTrackedSets } from "../repo/alliances";
import { dailyRosters } from "../schema";
import { trackedSets } from "../schema-alliances";
import { dailyFit } from "./history-readings";

/** The trend looks back this many days. */
export const BALANCE_DAYS = 90;

export interface PowerBalance {
  /** Greatest might first. */
  alliances: BalanceAlliance[];
  /** The top share per day, oldest first, over the days every one of `alliances` was read. */
  trend: ConcentrationPoint[];
}

/** One usable daily roster's alliance figures (totals only). */
export interface DailyAlliance extends BalanceAlliance {
  day: string;
}

/** Every usable daily roster of the last `BALANCE_DAYS` days, newest day first. Shared with the standing (D90). */
export async function dailyAlliances(db: Db, now: Date): Promise<DailyAlliance[]> {
  const since = new Date(now.getTime() - BALANCE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      day: dailyRosters.readDay,
      unionId: dailyRosters.unionId,
      tag: dailyRosters.tag,
      name: dailyRosters.name,
      badgeId: dailyRosters.badgeId,
      might: dailyRosters.totalPower,
      members: dailyRosters.memberCount,
      at: dailyRosters.sourceUpdatedAt,
    })
    .from(dailyRosters)
    .where(and(dailyFit, isNotNull(dailyRosters.totalPower), gte(dailyRosters.readDay, since)))
    .orderBy(desc(dailyRosters.readDay));
  // D133: a day counts its tracked set only, not the workspaces' alliances outside it or a lookup's roster.
  // A day before the first set counts the alliances the newest event read (D4's list), else every roster.
  const [sets, eventIds] = await Promise.all([
    db
      .select({ day: trackedSets.day, ids: trackedSets.allianceIds })
      .from(trackedSets)
      .orderBy(desc(trackedSets.day)),
    newestEventIds(db),
  ]);
  const counted = (r: { day: string; unionId: number }) => {
    const ids = sets.find((s) => s.day <= r.day)?.ids ?? eventIds;
    return ids.length === 0 || ids.includes(r.unionId);
  };
  return rows.filter(counted).map((r) => ({
    ...r,
    might: r.might ?? 0,
    members: r.members ?? 0,
    at: r.at ?? new Date(`${r.day}T00:00:00Z`),
  }));
}

export async function powerBalance(db: Db, now: Date): Promise<PowerBalance> {
  const [usable, [set], eventIds] = await Promise.all([
    dailyAlliances(db, now),
    recentTrackedSets(db, 1),
    newestEventIds(db),
  ]);
  const tracked = set?.allianceIds ?? eventIds;
  // Newest first, so the first row of an alliance is its newest read. Only today's tracked set (D133): an
  // alliance that left it keeps its days in the trend but is not one of the alliances shown.
  const newest = new Map<number, (typeof usable)[number]>();
  for (const r of usable)
    if (!newest.has(r.unionId) && (tracked.length === 0 || tracked.includes(r.unionId)))
      newest.set(r.unionId, r);
  const alliances = [...newest.values()]
    .map(({ day: _, ...a }): BalanceAlliance => a)
    .sort((a, b) => b.might - a.might);
  return { alliances, trend: concentration(usable, alliances.length) };
}

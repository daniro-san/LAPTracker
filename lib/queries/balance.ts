// Server power balance (D85, issue 283): each tracked alliance's might from its newest usable daily roster
// (D60; event rosters are not counted) and the top share per day. Alliance totals only: no member row, name
// or roster key is selected.
import { and, desc, gte, isNotNull } from "drizzle-orm";

import { concentration, type BalanceAlliance, type ConcentrationPoint } from "../balance";
import type { Db } from "../db";
import { dailyRosters } from "../schema";
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
  return rows.map((r) => ({
    ...r,
    might: r.might ?? 0,
    members: r.members ?? 0,
    at: r.at ?? new Date(`${r.day}T00:00:00Z`),
  }));
}

export async function powerBalance(db: Db, now: Date): Promise<PowerBalance> {
  const usable = await dailyAlliances(db, now);
  // Newest first, so the first row of an alliance is its newest read.
  const newest = new Map<number, (typeof usable)[number]>();
  for (const r of usable) if (!newest.has(r.unionId)) newest.set(r.unionId, r);
  const alliances = [...newest.values()]
    .map(({ day: _, ...a }): BalanceAlliance => a)
    .sort((a, b) => b.might - a.might);
  return { alliances, trend: concentration(usable, alliances.length) };
}

// The alliances recruiting (issue 792, beside D128): for each alliance, the newest daily read of the last
// RECRUITING_DAYS days that kept a response, with its joining rules; only those with a spot free, most spots
// first. The same raw_json fields as the statement card, picked out in SQL; the label is the read's own columns.
import { and, desc, gte, isNotNull, isNull } from "drizzle-orm";

import { addDays } from "../calendar-time";
import type { Db } from "../db";
import { dailyRosters } from "../schema";
import { joiningColumns, joiningOf, type Joining } from "./statement";

/** A read older than this many days before today is left out: its spots may be gone. */
export const RECRUITING_DAYS = 2;

export interface RecruitingRow extends Omit<Joining, "members" | "capacity"> {
  members: number;
  capacity: number;
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** The server day of the read the row comes from. */
  day: string;
  /** capacity − members, above 0. */
  spotsFree: number;
}

/** Most spots free first; then the lowest minimum might (more players qualify), then by id. */
const bySpots = (a: RecruitingRow, b: RecruitingRow) =>
  b.spotsFree - a.spotsFree || (a.minMight ?? 0) - (b.minMight ?? 0) || a.unionId - b.unionId;

/** `today` is the server day (`2026-11-27`): reads from `today − RECRUITING_DAYS` on count. */
export async function recruitingAlliances(db: Db, today: string): Promise<RecruitingRow[]> {
  const rows = await db
    .selectDistinctOn([dailyRosters.unionId], {
      unionId: dailyRosters.unionId,
      tag: dailyRosters.tag,
      name: dailyRosters.name,
      badgeId: dailyRosters.badgeId,
      day: dailyRosters.readDay,
      ...joiningColumns,
    })
    .from(dailyRosters)
    .where(
      and(
        gte(dailyRosters.readDay, addDays(today, -RECRUITING_DAYS)),
        isNull(dailyRosters.error),
        isNotNull(dailyRosters.rawJson),
      ),
    )
    .orderBy(dailyRosters.unionId, desc(dailyRosters.readDay));
  return rows
    .flatMap(({ unionId, tag, name, badgeId, day, ...raw }) => {
      const { members, capacity, ...rules } = joiningOf(raw);
      if (members === null || capacity === null || capacity <= members) return [];
      const spotsFree = capacity - members;
      return [{ unionId, tag, name, badgeId, day, ...rules, members, capacity, spotsFree }];
    })
    .sort(bySpots);
}

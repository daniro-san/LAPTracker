// Which alliance's usable daily roster listed one player on each day (D60, D89; issue 461): the public
// membership the alliance pages already show, day by day. Fields read: the alliance id and the read day. No
// name, might, kills or blocked roster key is selected (the uids are read only to pick the asked ones).
import { and, arrayContains, arrayOverlaps, asc, gte, ne } from "drizzle-orm";

import type { Db } from "../db";
import { dailyRosters } from "../schema";
import { dailyFit } from "./history-readings";

export interface RosterSighting {
  /** The server day of the daily read. */
  day: string;
  unionId: number;
}

/** Every usable daily roster that listed `uid`, the oldest first. */
export function rosterSightings(db: Db, uid: number): Promise<RosterSighting[]> {
  return db
    .select({ day: dailyRosters.readDay, unionId: dailyRosters.unionId })
    .from(dailyRosters)
    .where(and(dailyFit, arrayContains(dailyRosters.memberUids, [uid])))
    .orderBy(asc(dailyRosters.readDay), asc(dailyRosters.unionId));
}

/**
 * For the Insights page's "came from" and "went to" (issue 489): each of `uids` in every usable daily roster
 * of another alliance than `ours` from `since` on, the alliance id and the day only.
 */
export async function sightingsElsewhere(
  db: Db,
  uids: readonly number[],
  ours: number,
  since: string,
): Promise<(RosterSighting & { uid: number })[]> {
  if (uids.length === 0) return [];
  const rows = await db
    .select({
      day: dailyRosters.readDay,
      unionId: dailyRosters.unionId,
      uids: dailyRosters.memberUids,
    })
    .from(dailyRosters)
    .where(
      and(
        dailyFit,
        ne(dailyRosters.unionId, ours),
        gte(dailyRosters.readDay, since),
        arrayOverlaps(dailyRosters.memberUids, [...uids]),
      ),
    );
  const wanted = new Set(uids);
  return rows.flatMap((r) =>
    r.uids.filter((uid) => wanted.has(uid)).map((uid) => ({ uid, day: r.day, unionId: r.unionId })),
  );
}

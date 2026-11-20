// Which alliance's usable daily roster listed one player on each day (D60, D89; issue 461): the public
// membership the alliance pages already show, day by day. Fields read: the alliance id and the read day. No
// name, might, kills or blocked roster key is selected.
import { and, asc, sql } from "drizzle-orm";

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
    .where(and(dailyFit, sql`${uid} = any(${dailyRosters.memberUids})`))
    .orderBy(asc(dailyRosters.readDay), asc(dailyRosters.unionId));
}

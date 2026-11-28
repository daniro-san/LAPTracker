// Joins and leaves on the public alliance page (issue 823): who joined and left the alliance each server day
// of the last MOVES_DAYS, and which alliance they came from or went to. Each usable daily roster of the
// alliance is diffed against its previous one by uid (compute.rosterDiff, as member history, D60); the other
// side is the alliance whose usable daily roster lists the uid on the earlier day (a join) or the later day (a
// leave), placed as the member flow places them (D89, flow.placeMembers). Fields read: each roster's day,
// union id, tag, read time and uids, and this alliance's member names. No raw_json, no blocked key.
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { addDays } from "../calendar-time";
import { rosterDiff } from "../compute";
import type { Db } from "../db";
import { placeMembers } from "../flow";
import { dailyRosters } from "../schema";
import { dailyFit } from "./history-readings";

/** The list reaches back this many server days; the short count, WEEK_DAYS. */
export const MOVES_DAYS = 30;
export const WEEK_DAYS = 7;

export interface AllianceMove {
  /** The server day of the roster that showed the change. */
  day: string;
  kind: "joined" | "left";
  uid: number;
  name: string;
  /** The alliance the member was in before joining, or is in after leaving; null: not in a tracked one. */
  other: { unionId: number; tag: string | null } | null;
}

/** The tab of an alliance with no usable roster in the window. */
export const NO_MOVES: AllianceMoves = {
  compared: false,
  week: { joined: 0, left: 0 },
  month: { joined: 0, left: 0 },
  moves: [],
};

export interface MoveCounts {
  joined: number;
  left: number;
}

export interface AllianceMoves {
  /** False while the alliance has fewer than two usable rosters in the window: nothing to compare. */
  compared: boolean;
  week: MoveCounts;
  month: MoveCounts;
  /** Newest day first; within a day, joins first, then by name. */
  moves: AllianceMove[];
}

const countsOf = (moves: readonly AllianceMove[]): MoveCounts => ({
  joined: moves.filter((m) => m.kind === "joined").length,
  left: moves.filter((m) => m.kind === "left").length,
});

/**
 * The alliance's joins and leaves of the MOVES_DAYS server days up to `today`, or null when it has no usable
 * daily roster in them. One query: every usable daily
 * roster of the window that is this alliance's or lists any of its members of the window (the GIN index on
 * member_uids).
 */
export async function allianceMoves(
  db: Db,
  unionId: number,
  today: string,
): Promise<AllianceMoves | null> {
  const since = addDays(today, -MOVES_DAYS);
  // A usable roster of the window (dailyFit), for both the outer query and the subquery of this alliance's
  // uids: the subquery reads `daily_rosters` unaliased, so these qualified columns name its own rows there.
  const inWindow = and(
    dailyFit,
    gte(dailyRosters.readDay, since),
    lte(dailyRosters.readDay, today),
  );
  const ownUids = sql`(select coalesce(array_agg(u), '{}') from ${dailyRosters}
    cross join unnest(${dailyRosters.memberUids}) u where ${and(eq(dailyRosters.unionId, unionId), inWindow)})`;
  const rows = await db
    .select({
      day: dailyRosters.readDay,
      unionId: dailyRosters.unionId,
      tag: dailyRosters.tag,
      at: dailyRosters.sourceUpdatedAt,
      uids: dailyRosters.memberUids,
      names: sql<
        string[] | null
      >`case when ${dailyRosters.unionId} = ${unionId} then ${dailyRosters.memberNames} end`,
    })
    .from(dailyRosters)
    .where(
      and(
        inWindow,
        sql`(${eq(dailyRosters.unionId, unionId)} or ${dailyRosters.memberUids} && ${ownUids})`,
      ),
    );
  const own = rows.filter((r) => r.unionId === unionId).sort((a, b) => a.day.localeCompare(b.day));
  // No usable roster in the window: null, which the shared cache never keeps, so a crawl of unknown ids
  // leaves no entries (D143).
  if (own.length === 0) return null;
  const placed = new Map<string, Map<number, number>>();
  const placeOn = (day: string) => {
    let map = placed.get(day);
    if (!map) {
      const others = rows.filter((r) => r.day === day && r.unionId !== unionId);
      map = placeMembers(others.map((r) => ({ ...r, at: r.at?.getTime() ?? 0 })));
      placed.set(day, map);
    }
    return map;
  };
  const otherOn = (day: string, uid: number) => {
    const id = placeOn(day).get(uid);
    if (id === undefined) return null;
    const tag = rows.find((r) => r.day === day && r.unionId === id)?.tag ?? null;
    return { unionId: id, tag };
  };
  const membersOf = (r: (typeof own)[number]) =>
    r.uids.map((uid, i) => ({ uid, name: r.names?.[i] ?? "" }));
  const moves = own.slice(1).flatMap((now, i) => {
    const was = own[i] as (typeof own)[number];
    const diff = rosterDiff(membersOf(was), membersOf(now));
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    return [
      ...diff.joined.sort(byName).map((m): AllianceMove => ({
        day: now.day,
        kind: "joined",
        ...m,
        other: otherOn(was.day, m.uid),
      })),
      ...diff.left.sort(byName).map((m): AllianceMove => ({
        day: now.day,
        kind: "left",
        ...m,
        other: otherOn(now.day, m.uid),
      })),
    ];
  });
  moves.sort((a, b) => b.day.localeCompare(a.day));
  const weekFrom = addDays(today, 1 - WEEK_DAYS);
  return {
    compared: own.length > 1,
    week: countsOf(moves.filter((m) => m.day >= weekFrom)),
    month: countsOf(moves),
    moves,
  };
}

// A member's own page (issue 487, D142): reads of one player of one alliance or workspace. lib/private passes
// the MeAccess's union id, workspace id and uid (the approved link's), never a request's. raw_json is read
// only for that one member and only for the three daily fields (D127; owner, 2026-11-21, D142), on the last
// two game weeks' rows; no other member's values and no blocked field (x, y, online, last_online_at,
// joined_at, avatar_url) is read.
import { and, desc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import {
  allianceSnapshots,
  calendarEntries,
  calendarOccurrences,
  dailyRosters,
  events,
  memberSnapshots,
  rollCallMarks,
  rollCalls,
  rollCallTeam,
  snapshots,
} from "../schema";
import { live } from "./trash";
import { usable } from "./workspace-rosters";

/** How many of the alliance's newest usable rosters are read: 30 days with room for a missed day. */
export const OWN_ROWS = 40;

/** One usable roster of the alliance, as it concerns one member. */
export interface OwnDay {
  day: string;
  /** The roster lists the member. */
  listed: boolean;
  /** The member's name in that roster; null when it does not list them. */
  name: string | null;
  power: number | null;
  kills: number | null;
  /** The member's daily fields as sent (D127), on rows from `dailyFrom` that kept raw_json; else null. */
  daily: { active: unknown; daily_honor: unknown; daily_tech: unknown } | null;
}

const num = (v: string | null) => (v === null ? null : Number(v));

/** The alliance's newest OWN_ROWS usable rosters, the oldest first, as they concern `uid`. */
export async function ownDays(
  db: Db,
  unionId: number,
  uid: number,
  dailyFrom: string,
): Promise<OwnDay[]> {
  const i = sql`array_position(${dailyRosters.memberUids}, ${uid}::bigint)`;
  const rows = await db
    .select({
      day: dailyRosters.readDay,
      listed: sql<boolean>`${i} is not null`,
      name: sql<string | null>`(${dailyRosters.memberNames})[${i}]`,
      // As text: Drizzle reads a null bigint element as 0, and a null stays null (D15).
      power: sql<string | null>`((${dailyRosters.memberPower})[${i}])::text`,
      kills: sql<string | null>`((${dailyRosters.memberKills})[${i}])::text`,
      daily: sql<
        OwnDay["daily"]
      >`case when ${i} is not null and ${dailyRosters.readDay} >= ${dailyFrom} then (select jsonb_build_object('active', m->'active', 'daily_honor', m->'daily_honor', 'daily_tech', m->'daily_tech') from jsonb_array_elements(${dailyRosters.rawJson}->'members') m where m->>'uid' = ${String(uid)} limit 1) end`,
    })
    .from(dailyRosters)
    .where(usable(unionId))
    .orderBy(desc(dailyRosters.readDay))
    .limit(OWN_ROWS);
  return rows
    .reverse()
    .map((r) => ({ ...r, power: num(r.power), kills: num(r.kills), daily: r.daily ?? null }));
}

/**
 * The member's might at the Start of the alliance's newest public scheduled event (the Saturday KvK)
 * between `since` and `now`; null when none read them.
 */
export async function mightBeforeEvent(
  db: Db,
  unionId: number,
  uid: number,
  since: Date,
  now: Date,
): Promise<{ at: Date; power: number } | null> {
  const [row] = await db
    .select({ at: events.eventAtUtc, power: memberSnapshots.power })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        eq(memberSnapshots.uid, uid),
        eq(allianceSnapshots.unionId, unionId),
        eq(allianceSnapshots.isFresh, true),
        isNull(allianceSnapshots.error),
        eq(snapshots.phase, "before"),
        eq(events.manual, false),
        eq(events.isTest, false),
        ne(events.visibility, "admin"),
        gte(events.eventAtUtc, since),
        lte(events.eventAtUtc, now),
        sql`${memberSnapshots.power} is not null`,
      ),
    )
    .orderBy(desc(events.eventAtUtc))
    .limit(1);
  return row && row.power !== null ? { at: row.at, power: row.power } : null;
}

/** The member's Elixir Scramble team (A or B) in the week starting `week`, or null. */
export async function ownTeam(
  db: Db,
  workspaceId: number,
  uid: number,
  week: string,
): Promise<string | null> {
  const [row] = await db
    .select({ variant: rollCalls.variant })
    .from(rollCallTeam)
    .innerJoin(rollCalls, eq(rollCalls.id, rollCallTeam.rollCallId))
    .where(
      and(
        eq(rollCalls.workspaceId, workspaceId),
        eq(rollCalls.kind, "elixir"),
        eq(rollCalls.week, week),
        isNull(rollCalls.deletedAt),
        eq(rollCallTeam.uid, uid),
      ),
    )
    .limit(1);
  return row?.variant ?? null;
}

/** The member's Alliance Caravan seats in the week starting `week`: the day and the seat. */
export async function ownSeats(db: Db, workspaceId: number, uid: number, week: string) {
  const o = calendarOccurrences;
  return db
    .select({
      movedTo: o.day,
      planned: calendarEntries.day,
      coach: sql<boolean>`${o.coachUid} = ${uid}`,
      second: o.secondKind,
    })
    .from(o)
    .innerJoin(calendarEntries, eq(calendarEntries.id, o.entryId))
    .where(
      and(
        eq(o.workspaceId, workspaceId),
        eq(o.week, week),
        eq(calendarEntries.kind, "caravan"),
        live(calendarEntries),
        eq(o.cancelled, false),
        or(eq(o.coachUid, uid), eq(o.secondUid, uid)),
      ),
    );
}

/** The newest mark of each part for the member, on the workspace's live roll calls from `today` on. */
export async function ownMarks(db: Db, workspaceId: number, uid: number, today: string) {
  const rows = await db
    .selectDistinctOn([rollCallMarks.rollCallId, rollCallMarks.part], {
      kind: rollCalls.kind,
      variant: rollCalls.variant,
      day: rollCalls.day,
      part: rollCallMarks.part,
      mark: rollCallMarks.mark,
    })
    .from(rollCallMarks)
    .innerJoin(rollCalls, eq(rollCalls.id, rollCallMarks.rollCallId))
    .where(
      and(
        eq(rollCalls.workspaceId, workspaceId),
        isNull(rollCalls.deletedAt),
        isNull(rollCalls.archivedAt),
        gte(rollCalls.day, today),
        eq(rollCallMarks.uid, uid),
      ),
    )
    .orderBy(rollCallMarks.rollCallId, rollCallMarks.part, desc(rollCallMarks.version));
  return rows.filter((r) => r.mark !== null);
}

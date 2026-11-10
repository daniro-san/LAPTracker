// Member history's roster reads (D60): the usable rosters of one alliance, from its daily reads and its
// public event snapshots. Split from member-history.ts for its size. Served member fields: uid, name,
// power, kills only.
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, dailyRosters, events, memberSnapshots, snapshots } from "../schema";
import type { HistoryEvent, HistoryMember } from "./member-history";
import { publicEvent } from "./visibility";

export interface Reading {
  at: Date;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  event: HistoryEvent | null;
  members: HistoryMember[];
}

const numbers = (values: (string | null)[]) => values.map((v) => (v === null ? null : Number(v)));

/** A usable roster: fresh, no error, not empty; older than `before` when given. */
export const dailyUsable = (unionId: number, before: Date | null) =>
  and(
    eq(dailyRosters.unionId, unionId),
    eq(dailyRosters.isFresh, true),
    isNull(dailyRosters.error),
    gt(dailyRosters.memberCount, 0),
    before ? lt(dailyRosters.sourceUpdatedAt, before) : undefined,
  );

const eventUsable = (unionId: number, before: Date | null) =>
  and(
    eq(allianceSnapshots.unionId, unionId),
    publicEvent,
    eq(allianceSnapshots.isFresh, true),
    isNull(allianceSnapshots.error),
    gt(allianceSnapshots.memberCount, 0),
    before ? lt(allianceSnapshots.sourceUpdatedAt, before) : undefined,
  );

export const dailyHead = {
  at: dailyRosters.sourceUpdatedAt,
  tag: dailyRosters.tag,
  name: dailyRosters.name,
  badgeId: dailyRosters.badgeId,
};

const eventHead = {
  at: allianceSnapshots.sourceUpdatedAt,
  tag: allianceSnapshots.tag,
  name: allianceSnapshots.name,
  badgeId: allianceSnapshots.badgeId,
  event: {
    id: events.id,
    name: events.name,
    manual: events.manual,
    eventAtUtc: events.eventAtUtc,
    phase: snapshots.phase,
  },
};

/** Usable daily rosters older than `before` (null: all), newest first. */
export async function dailyReadings(db: Db, unionId: number, before: Date | null, n: number) {
  const rows = await db
    .select({
      ...dailyHead,
      uids: dailyRosters.memberUids,
      names: dailyRosters.memberNames,
      // As text: Drizzle reads a null bigint element as 0, and a null stays null (D15).
      power: sql<(string | null)[]>`${dailyRosters.memberPower}::text[]`,
      kills: sql<(string | null)[]>`${dailyRosters.memberKills}::text[]`,
    })
    .from(dailyRosters)
    .where(dailyUsable(unionId, before))
    .orderBy(desc(dailyRosters.sourceUpdatedAt))
    .limit(n);
  return rows.map((r): Reading => {
    const [power, kills] = [numbers(r.power), numbers(r.kills)];
    return {
      at: r.at as Date,
      tag: r.tag,
      name: r.name,
      badgeId: r.badgeId,
      event: null,
      members: r.uids.map((uid, i) => ({
        uid,
        name: r.names[i] ?? "",
        power: power[i] ?? null,
        kills: kills[i] ?? null,
      })),
    };
  });
}

/** Usable rosters of public event snapshots older than `before` (null: all), newest first. */
export async function eventReadings(db: Db, unionId: number, before: Date | null, n: number) {
  const rows = await eventHeads(db, unionId, before, n);
  const members =
    rows.length === 0
      ? []
      : await db
          .select({
            id: memberSnapshots.allianceSnapshotId,
            uid: memberSnapshots.uid,
            name: memberSnapshots.name,
            power: memberSnapshots.power,
            kills: memberSnapshots.kills,
          })
          .from(memberSnapshots)
          .where(
            inArray(
              memberSnapshots.allianceSnapshotId,
              rows.map((r) => r.id),
            ),
          );
  return rows.map(({ id, ...r }): Reading => ({
    ...r,
    at: r.at as Date,
    members: members.filter((m) => m.id === id).map(({ id: _, ...m }) => m),
  }));
}

/** The heads of usable public event rosters older than `before`, newest first, with the row id. */
export function eventHeads(db: Db, unionId: number, before: Date | null, n: number) {
  return db
    .select({ id: allianceSnapshots.id, ...eventHead })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(eventUsable(unionId, before))
    .orderBy(desc(allianceSnapshots.sourceUpdatedAt))
    .limit(n);
}

// The newest roster LAPTracker stores for an alliance, of any kind (owner, 2026-11-16): a daily read's
// members (D60), an event's Start or End roster, or an event sample (D69), even a stale one. The Members
// tab shows it until the alliance has its first end-of-day read (D72), so no workspace waits a day.
// Sanctuary and rank come from the newest Start or End roster that lists the member; the end-of-day
// fields are null. Also the names each member used in the alliance's rosters (the sheet import's
// matching, issue #297). Every read is of the one alliance passed in (D71).
import { and, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, dailyRosters, events, memberSnapshots, snapshots } from "../schema";
import type { RosterMember } from "./workspace-rosters";

export interface AnyRoster {
  /** When the upstream read it. */
  at: Date;
  members: RosterMember[];
}

interface Arrays {
  at: Date | null;
  uids: number[] | null;
  names: string[] | null;
  /** As text: Drizzle reads a null bigint element as 0, and a null might stays null (D15). */
  power: (string | null)[] | null;
}

const UNREAD = {
  dailyTech: null,
  dailyHonor: null,
  active: null,
  joinedAt: null,
  lastOnlineAt: null,
  x: null,
  y: null,
};

async function newestDaily(db: Db, unionId: number): Promise<Arrays | null> {
  const [row] = await db
    .select({
      at: dailyRosters.sourceUpdatedAt,
      uids: dailyRosters.memberUids,
      names: dailyRosters.memberNames,
      power: sql<(string | null)[]>`${dailyRosters.memberPower}::text[]`,
    })
    .from(dailyRosters)
    .where(
      and(
        eq(dailyRosters.unionId, unionId),
        isNull(dailyRosters.error),
        gt(dailyRosters.memberCount, 0),
        isNotNull(dailyRosters.sourceUpdatedAt),
      ),
    )
    .orderBy(desc(dailyRosters.sourceUpdatedAt))
    .limit(1);
  return row ?? null;
}

/** The alliance's newest roster in a public event: any phase, or only a Start or End (member rows). */
async function newestSnapshot(db: Db, unionId: number, startOrEnd: boolean) {
  const [row] = await db
    .select({
      id: allianceSnapshots.id,
      at: allianceSnapshots.sourceUpdatedAt,
      phase: snapshots.phase,
      uids: allianceSnapshots.memberUids,
      names: allianceSnapshots.memberNames,
      power: sql<(string | null)[] | null>`${allianceSnapshots.memberPower}::text[]`,
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        eq(allianceSnapshots.unionId, unionId),
        isNull(allianceSnapshots.error),
        gt(allianceSnapshots.memberCount, 0),
        isNotNull(allianceSnapshots.sourceUpdatedAt),
        eq(events.isTest, false),
        ne(events.visibility, "admin"),
        startOrEnd ? ne(snapshots.phase, "sample") : undefined,
      ),
    )
    .orderBy(desc(allianceSnapshots.sourceUpdatedAt))
    .limit(1);
  return row ?? null;
}

const memberRows = (db: Db, allianceSnapshotId: number) =>
  db
    .select({
      uid: memberSnapshots.uid,
      name: memberSnapshots.name,
      power: memberSnapshots.power,
      lv: memberSnapshots.lv,
      rankCode: memberSnapshots.rankCode,
      rankLabel: memberSnapshots.rankLabel,
    })
    .from(memberSnapshots)
    .where(eq(memberSnapshots.allianceSnapshotId, allianceSnapshotId));

type Ranked = Awaited<ReturnType<typeof memberRows>>[number];

const member = (m: Ranked): RosterMember => ({ ...m, rankLabel: m.rankLabel || null, ...UNREAD });

/** The alliance's newest roster of any kind, or null when LAPTracker has none. */
export async function anyRoster(db: Db, unionId: number): Promise<AnyRoster | null> {
  const [daily, snapshot, startOrEnd] = await Promise.all([
    newestDaily(db, unionId),
    newestSnapshot(db, unionId, false),
    newestSnapshot(db, unionId, true),
  ]);
  const ranked = startOrEnd ? await memberRows(db, startOrEnd.id) : [];
  const newest = [daily, snapshot]
    .filter((r) => r !== null)
    .sort((a, b) => (b.at as Date).getTime() - (a.at as Date).getTime())[0];
  if (!newest) return null;
  // A Start or End is itself the newest Start or End, so its member rows are `ranked`.
  if (newest === snapshot && snapshot.phase !== "sample") {
    return { at: newest.at as Date, members: ranked.map(member) };
  }
  const byUid = new Map(ranked.map((r) => [r.uid, r]));
  const power = (v: string | null | undefined) =>
    v === null || v === undefined ? null : Number(v);
  return {
    at: newest.at as Date,
    members: (newest.uids ?? []).map((uid, i) => {
      const r = byUid.get(uid);
      return member({
        uid,
        name: newest.names?.[i] ?? "",
        power: power(newest.power?.[i]),
        lv: r?.lv ?? null,
        rankCode: r?.rankCode ?? null,
        rankLabel: r?.rankLabel ?? null,
      });
    }),
  };
}

/** Every name each member used in the alliance's rosters, the most recently seen first. */
export async function namesSeen(db: Db, unionId: number): Promise<Map<number, string[]>> {
  const result = await db.execute<{ uid: string; name: string }>(sql`
    select uid::text as uid, name from (
      select u.uid, u.name, max(r.source_updated_at) as seen
      from daily_rosters r cross join lateral unnest(r.member_uids, r.member_names) as u(uid, name)
      where r.union_id = ${unionId} and r.error is null
      group by u.uid, u.name
      union all
      select m.uid, m.name, max(a.source_updated_at)
      from member_snapshots m
      join alliance_snapshots a on a.id = m.alliance_snapshot_id
      join snapshots s on s.id = a.snapshot_id
      join events e on e.id = s.event_id
      where a.union_id = ${unionId} and a.error is null and not e.is_test
      group by m.uid, m.name
    ) n order by seen desc nulls last`);
  const names = new Map<number, string[]>();
  for (const r of result.rows) {
    const own = names.get(Number(r.uid)) ?? [];
    if (!own.includes(r.name)) own.push(r.name);
    names.set(Number(r.uid), own);
  }
  return names;
}

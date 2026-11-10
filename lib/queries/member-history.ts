// Member history (D60, issue 197): one alliance's rosters over time, from its daily reads and its public
// event snapshots, each diffed against the previous usable one by uid (compute.rosterDiff). Served member
// fields: uid, name, power, kills only; joined and left come from the diff, never from joined_at (§12.1).
import { and, arrayOverlaps, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";

import { rosterDiff } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, dailyRosters, events, memberSnapshots, snapshots } from "../schema";
import { publicEvent } from "./visibility";

export interface HistoryMember {
  uid: number;
  name: string;
  power: number | null;
  kills: number | null;
}

export interface HistoryChange extends HistoryMember {
  powerChange: number | null;
  killsChange: number | null;
}

export interface HistoryLeaver extends HistoryMember {
  /** The alliance of the member's newest sighting, when it is another one. */
  nowIn: { unionId: number; tag: string | null } | null;
}

export interface HistoryEvent {
  id: number;
  name: string;
  manual: boolean;
  eventAtUtc: Date;
  phase: "before" | "after";
}

export interface HistoryCard {
  /** When the game's data was read. */
  at: Date;
  /** The event snapshot this roster belongs to; null for a daily read. */
  event: HistoryEvent | null;
  /** The previous usable roster's time; null for the first one stored. */
  since: Date | null;
  roster: HistoryMember[];
  joined: HistoryMember[];
  left: HistoryLeaver[];
  renamed: { uid: number; from: string; to: string }[];
  /** Members in both rosters whose kills or might changed, most kills gained first. */
  changed: HistoryChange[];
}

export interface MemberHistory {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** Newest first. */
  cards: HistoryCard[];
  /** The `before` of the next page, or null when this page reaches the first roster. */
  older: Date | null;
}

interface Reading {
  at: Date;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  event: HistoryEvent | null;
  members: HistoryMember[];
}

/** after − before for one member's figure; null when either side is null (D15). */
const change = (before: number | null, after: number | null) =>
  before === null || after === null ? null : after - before;

const numbers = (values: (string | null)[]) => values.map((v) => (v === null ? null : Number(v)));

/** Usable daily rosters (fresh, no error, not empty) older than `before` (null: all), newest first. */
async function dailyReadings(db: Db, unionId: number, before: Date | null, n: number) {
  const rows = await db
    .select({
      at: dailyRosters.sourceUpdatedAt,
      tag: dailyRosters.tag,
      name: dailyRosters.name,
      badgeId: dailyRosters.badgeId,
      uids: dailyRosters.memberUids,
      names: dailyRosters.memberNames,
      // As text: Drizzle reads a null bigint element as 0, and a null stays null (D15).
      power: sql<(string | null)[]>`${dailyRosters.memberPower}::text[]`,
      kills: sql<(string | null)[]>`${dailyRosters.memberKills}::text[]`,
    })
    .from(dailyRosters)
    .where(
      and(
        eq(dailyRosters.unionId, unionId),
        eq(dailyRosters.isFresh, true),
        isNull(dailyRosters.error),
        gt(dailyRosters.memberCount, 0),
        before ? lt(dailyRosters.sourceUpdatedAt, before) : undefined,
      ),
    )
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
async function eventReadings(db: Db, unionId: number, before: Date | null, n: number) {
  const rows = await db
    .select({
      id: allianceSnapshots.id,
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
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        eq(allianceSnapshots.unionId, unionId),
        publicEvent,
        eq(allianceSnapshots.isFresh, true),
        isNull(allianceSnapshots.error),
        before ? lt(allianceSnapshots.sourceUpdatedAt, before) : undefined,
      ),
    )
    .orderBy(desc(allianceSnapshots.sourceUpdatedAt))
    .limit(n);
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
  return rows
    .map(({ id, ...r }): Reading => ({
      ...r,
      at: r.at as Date,
      members: members.filter((m) => m.id === id).map(({ id: _, ...m }) => m),
    }))
    .filter((r) => r.members.length > 0);
}

/** Each leaver's newest sighting in any stored roster, when it is in another alliance (public data only). */
async function whereNow(db: Db, unionId: number, uids: number[]) {
  const found = new Map<number, { at: Date; unionId: number; tag: string | null }>();
  if (uids.length === 0) return found;
  const keep = (uid: number, s: { at: Date | null; unionId: number; tag: string | null }) => {
    const seen = found.get(uid);
    if (s.at && (!seen || s.at > seen.at)) found.set(uid, { ...s, at: s.at });
  };
  const [fromEvents, fromDaily] = await Promise.all([
    db
      .select({
        uid: memberSnapshots.uid,
        at: allianceSnapshots.sourceUpdatedAt,
        unionId: allianceSnapshots.unionId,
        tag: allianceSnapshots.tag,
      })
      .from(memberSnapshots)
      .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
      .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
      .innerJoin(events, eq(events.id, snapshots.eventId))
      .where(and(inArray(memberSnapshots.uid, uids), publicEvent)),
    db
      .select({
        uids: dailyRosters.memberUids,
        at: dailyRosters.sourceUpdatedAt,
        unionId: dailyRosters.unionId,
        tag: dailyRosters.tag,
      })
      .from(dailyRosters)
      .where(arrayOverlaps(dailyRosters.memberUids, uids)),
  ]);
  for (const { uid, ...s } of fromEvents) keep(uid, s);
  for (const { uids: list, ...s } of fromDaily)
    for (const uid of uids) if (list.includes(uid)) keep(uid, s);
  for (const [uid, s] of found) if (s.unionId === unionId) found.delete(uid);
  return found;
}

function card(
  now: Reading,
  was: Reading | undefined,
): Omit<HistoryCard, "left"> & {
  left: HistoryMember[];
} {
  const base = { at: now.at, event: now.event, since: was?.at ?? null, roster: now.members };
  if (!was) return { ...base, joined: [], left: [], renamed: [], changed: [] };
  const diff = rosterDiff(was.members, now.members);
  const changed = diff.stayed
    .map(({ before, after }) => ({
      ...after,
      powerChange: change(before.power, after.power),
      killsChange: change(before.kills, after.kills),
    }))
    .filter((m) => (m.powerChange ?? 0) !== 0 || (m.killsChange ?? 0) !== 0)
    .sort(
      (a, b) =>
        (b.killsChange ?? 0) - (a.killsChange ?? 0) || (b.powerChange ?? 0) - (a.powerChange ?? 0),
    );
  return {
    ...base,
    joined: diff.joined,
    left: diff.left,
    renamed: diff.renamed.map((r) => ({ uid: r.after.uid, from: r.before.name, to: r.after.name })),
    changed,
  };
}

/** The leavers of each card with the alliance they are in now, when that is another one. */
async function withNowIn(db: Db, unionId: number, cards: ReturnType<typeof card>[]) {
  const now = await whereNow(
    db,
    unionId,
    cards.flatMap((c) => c.left.map((m) => m.uid)),
  );
  return cards.map((c): HistoryCard => ({
    ...c,
    left: c.left.map((m) => {
      const s = now.get(m.uid);
      return { ...m, nowIn: s ? { unionId: s.unionId, tag: s.tag } : null };
    }),
  }));
}

/** The alliance's tag, name and badge as the page's newest roster has them. */
const headOf = (r: Reading | undefined) => ({
  tag: r?.tag ?? null,
  name: r?.name ?? null,
  badgeId: r?.badgeId ?? null,
});

/**
 * One page of an alliance's member history: up to `limit` rosters older than `before`, newest first,
 * each diffed against the next older usable roster. Null when the alliance has no usable roster at all.
 */
export async function memberHistory(
  db: Db,
  unionId: number,
  { before = null, limit = 14 }: { before?: Date | null; limit?: number } = {},
): Promise<MemberHistory | null> {
  const [daily, fromEvents] = await Promise.all([
    dailyReadings(db, unionId, before, limit + 1),
    eventReadings(db, unionId, before, limit + 1),
  ]);
  const readings = [...daily, ...fromEvents]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit + 1);
  if (readings.length === 0 && !before) return null;
  const shown = readings.slice(0, limit);
  const cards = shown.map((r, i) => card(r, readings[i + 1]));
  const last = shown.at(-1);
  return {
    unionId,
    ...headOf(readings[0]),
    cards: await withNowIn(db, unionId, cards),
    older: readings.length > limit && last ? last.at : null,
  };
}

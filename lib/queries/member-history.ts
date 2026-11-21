// Member history (D60, issue 197): one alliance's rosters over time, from its daily reads and its public
// event snapshots, each diffed against the previous usable one by uid (compute.rosterDiff). Served member
// fields: uid, name, power, kills only; joined and left come from the diff, never from joined_at (§12.1).
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";

import { rosterDiff } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, dailyRosters, events, memberSnapshots, snapshots } from "../schema";
import { dailyReadings, eventReadings, type Reading } from "./history-readings";
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

/** What a card holds under its head: loaded with the page for the open card, else on open (D60). */
export type HistoryCardBody = Pick<
  HistoryCard,
  "roster" | "joined" | "left" | "renamed" | "changed"
>;

/** A card's head only: when, which event, since when, and how many joined, left and changed name (null on
 * the first card, which has nothing to compare with). */
export type HistoryEntry = Pick<HistoryCard, "at" | "event" | "since"> & {
  counts: { joined: number; left: number; renamed: number } | null;
};

export interface MemberHistoryIndex {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** Newest first. */
  entries: HistoryEntry[];
  older: Date | null;
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

/** after − before for one member's figure; null when either side is null (D15). */
const change = (before: number | null, after: number | null) =>
  before === null || after === null ? null : after - before;

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
const headOf = (r: Pick<Reading, "tag" | "name" | "badgeId"> | undefined) => ({
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

/** How many members joined, left and changed name since the previous card's roster (issue 473). */
export const countsOf = (c: {
  since: Date | null;
  joined: readonly unknown[];
  left: readonly unknown[];
  renamed: readonly unknown[];
}) =>
  c.since === null
    ? null
    : { joined: c.joined.length, left: c.left.length, renamed: c.renamed.length };

/**
 * The heads of one page of member history, without member lists: the same rosters, order and paging
 * as memberHistory, for a page whose cards load their contents on open, each with its counts of who
 * joined, left and changed name (issue 473). Null as memberHistory.
 */
export async function memberHistoryIndex(
  db: Db,
  unionId: number,
  { before = null, limit = 14 }: { before?: Date | null; limit?: number } = {},
): Promise<MemberHistoryIndex | null> {
  const [daily, fromEvents] = await Promise.all([
    dailyReadings(db, unionId, before, limit + 1),
    eventReadings(db, unionId, before, limit + 1),
  ]);
  const readings = [...daily, ...fromEvents]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit + 1);
  if (readings.length === 0 && !before) return null;
  const shown = readings.slice(0, limit);
  const last = shown.at(-1);
  return {
    unionId,
    ...headOf(readings[0]),
    entries: shown.map((r, i) => {
      const { at, event, since, joined, left, renamed } = card(r, readings[i + 1]);
      return { at, event, since, counts: countsOf({ since, joined, left, renamed }) };
    }),
    older: readings.length > limit && last ? last.at : null,
  };
}

/** The contents of the card read at `at` (the page loads them when a closed card opens), or null. */
export async function memberHistoryCard(
  db: Db,
  unionId: number,
  at: Date,
): Promise<HistoryCardBody | null> {
  // The newest card older than a millisecond after `at` is the one read at `at`, if one was.
  const page = await memberHistory(db, unionId, { before: new Date(at.getTime() + 1), limit: 1 });
  const card = page?.cards[0];
  if (!card || card.at.getTime() !== at.getTime()) return null;
  const { roster, joined, left, renamed, changed } = card;
  return { roster, joined, left, renamed, changed };
}

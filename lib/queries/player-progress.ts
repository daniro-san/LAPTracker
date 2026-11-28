// Daily progress of one player (issue 270): every usable roster that holds the player, from the daily
// reads (D60) and from public events' Start and End, oldest first, with the player's rank by might inside
// that roster; and the change over the last 7 days next to the alliance's median member. Served fields:
// the alliance's union id and tag, the player's name, might, kills and rank (§12.1); raw_json is never read.
// `progressSteps` turns the readings into the player's day by day (issue 773).
import { and, arrayContains, desc, eq, sql } from "drizzle-orm";

import { pickRosterRows } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, dailyRosters, events, memberSnapshots, snapshots } from "../schema";
import { dailyFit, dailyReadings, eventFit, eventHead, eventReadings } from "./history-readings";
import type { HistoryEvent, HistoryMember } from "./member-history";
import { peerRank } from "./players";

export interface ProgressReading {
  /** When the game's data was read. */
  at: Date;
  /** The event and its Start (`before`) or End (`after`); null for a daily read. */
  event: HistoryEvent | null;
  unionId: number;
  tag: string | null;
  /** The player's name in that roster. */
  name: string;
  power: number | null;
  kills: number | null;
  /** 1 + the roster-mates with more might; null without a might. */
  rank: number | null;
}

export interface ProgressSummary {
  from: ProgressReading;
  to: ProgressReading;
  /** to.power − from.power. */
  power: number;
  /** The median member's might change in percent, over members in both rosters; null when the two
   * readings are of different alliances. */
  alliance: { unionId: number; tag: string | null; medianPercent: number } | null;
}

export interface PlayerProgress {
  /** Oldest first. */
  readings: ProgressReading[];
  summary: ProgressSummary | null;
}

/** "The last 7 days" with room for a read that ran a few hours early or late. */
const WEEK_MS = 6.5 * 24 * 3_600_000;

const num = (v: string | null) => (v === null ? null : Number(v));

async function dailyOf(db: Db, uid: number): Promise<ProgressReading[]> {
  const i = sql`array_position(${dailyRosters.memberUids}, ${uid}::bigint)`;
  const own = sql`(${dailyRosters.memberPower})[${i}]`;
  const rows = await db
    .select({
      at: dailyRosters.sourceUpdatedAt,
      unionId: dailyRosters.unionId,
      tag: dailyRosters.tag,
      name: sql<string | null>`(${dailyRosters.memberNames})[${i}]`,
      // As text: Drizzle reads a null bigint element as 0, and a null stays null (D15).
      power: sql<string | null>`${own}::text`,
      kills: sql<string | null>`((${dailyRosters.memberKills})[${i}])::text`,
      rank: sql<
        number | null
      >`case when ${own} is null then null else (select count(*)::int + 1 from unnest(${dailyRosters.memberPower}) p where p > ${own}) end`,
    })
    .from(dailyRosters)
    .where(and(dailyFit, arrayContains(dailyRosters.memberUids, [uid])));
  return rows.map((r) => ({
    ...r,
    at: r.at as Date,
    name: r.name ?? "",
    event: null,
    power: num(r.power),
    kills: num(r.kills),
  }));
}

async function eventsOf(db: Db, uid: number): Promise<ProgressReading[]> {
  const rows = await db
    .select({
      uid: memberSnapshots.uid,
      eventId: events.id,
      phase: snapshots.phase,
      at: allianceSnapshots.sourceUpdatedAt,
      unionId: allianceSnapshots.unionId,
      tag: allianceSnapshots.tag,
      event: eventHead.event,
      name: memberSnapshots.name,
      power: memberSnapshots.power,
      kills: memberSnapshots.kills,
      rank: peerRank(memberSnapshots.power, "power"),
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(eq(memberSnapshots.uid, uid), eventFit))
    .orderBy(desc(allianceSnapshots.id));
  // Two rows of one snapshot (the player moved between two alliances' reads): one, as the player page.
  return pickRosterRows(rows, () => true).map(({ uid: _, eventId: __, phase: ___, ...r }) => ({
    ...r,
    at: r.at as Date,
  }));
}

/** The members of the roster `r` was read from. */
async function rosterOf(db: Db, r: ProgressReading): Promise<HistoryMember[]> {
  const upTo = new Date(r.at.getTime() + 1);
  const [roster] = r.event
    ? await eventReadings(db, r.unionId, upTo, 1)
    : await dailyReadings(db, r.unionId, upTo, 1);
  return roster?.members ?? [];
}

/** The median of each member's might change in percent, over members with a might in both rosters. */
function medianPercent(from: HistoryMember[], to: HistoryMember[]): number | null {
  const was = new Map(from.map((m) => [m.uid, m.power]));
  const changes = to
    .flatMap((m) => {
      const p = was.get(m.uid);
      return p && m.power !== null ? [((m.power - p) / p) * 100] : [];
    })
    .sort((a, b) => a - b);
  const mid = changes.length >> 1;
  if (changes.length === 0) return null;
  return changes.length % 2 === 1
    ? (changes[mid] as number)
    : ((changes[mid - 1] as number) + (changes[mid] as number)) / 2;
}

/**
 * The summary's two readings: the newest, and the newest at least 6.5 days older (7 days, give or take
 * a read's hours), else the oldest. Null with fewer than two readings or without both mights.
 */
async function summaryOf(db: Db, readings: ProgressReading[]): Promise<ProgressSummary | null> {
  const to = readings.at(-1);
  const from =
    to && (readings.findLast((r) => r.at.getTime() <= to.at.getTime() - WEEK_MS) ?? readings[0]);
  if (!to || !from || from === to || from.power === null || to.power === null) return null;
  const same = from.unionId === to.unionId;
  const rosters = same ? await Promise.all([rosterOf(db, from), rosterOf(db, to)]) : null;
  const median = rosters && medianPercent(rosters[0], rosters[1]);
  return {
    from,
    to,
    power: to.power - from.power,
    alliance: median === null ? null : { unionId: to.unionId, tag: to.tag, medianPercent: median },
  };
}

/** Every usable reading of one player, oldest first, and the 7-day summary. */
export async function playerProgress(db: Db, uid: number): Promise<PlayerProgress> {
  const [daily, fromEvents] = await Promise.all([dailyOf(db, uid), eventsOf(db, uid)]);
  const readings = [...daily, ...fromEvents].sort((a, b) => a.at.getTime() - b.at.getTime());
  return { readings, summary: await summaryOf(db, readings) };
}

/** More than this between two readings: no usable roster held the player in between (issue 773). A daily
 * read's time moves by a few hours from day to day (D72), so one missed day is more than 24 h. */
const GAP_MS = 36 * 3_600_000;

export interface ProgressStep {
  reading: ProgressReading;
  /** The reading before it; null for the first reading. */
  previous: ProgressReading | null;
  /** Might and kills against the previous reading; null for the first or without a value on either side. */
  power: number | null;
  kills: number | null;
  /** The previous name, when the player changed name since the previous reading. */
  renamedFrom: string | null;
  /** The previous alliance, when the player is in another alliance than at the previous reading. */
  movedFrom: { unionId: number; tag: string | null } | null;
  /** More than 36 h since the previous reading: the change spans days with no reading. */
  gap: boolean;
}

const diffOf = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);

/** Each reading against the one before it, newest first: the player's day by day (issue 773). */
export function progressSteps(readings: ProgressReading[]): ProgressStep[] {
  return readings
    .map((r, i): ProgressStep => {
      const p = readings[i - 1] ?? null;
      return {
        reading: r,
        previous: p,
        power: p && diffOf(p.power, r.power),
        kills: p && diffOf(p.kills, r.kills),
        renamedFrom: p && p.name !== "" && r.name !== "" && p.name !== r.name ? p.name : null,
        movedFrom: p && p.unionId !== r.unionId ? { unionId: p.unionId, tag: p.tag } : null,
        gap: p !== null && r.at.getTime() - p.at.getTime() > GAP_MS,
      };
    })
    .reverse();
}

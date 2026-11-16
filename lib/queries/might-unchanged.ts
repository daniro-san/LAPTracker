// The officer view of might that has not moved (D70, issue 273): from one alliance's usable rosters
// (daily reads and public event rosters, D60), the members whose might is identical in every reading of a
// run that holds at least MIN_DAILY_READS daily reads, and the members whose might fell by LOST_MIGHT_PCT
// or more over the newest MIN_DAILY_READS daily reads. Served member fields: uid, name, might, kills only.
import type { Db } from "../db";
import { dailyReadings, eventReadings, type Reading } from "./history-readings";
import type { HistoryMember } from "./member-history";

/** Daily reads an alliance needs before the lists mean anything (owner, 2026-11-16). */
export const MIN_DAILY_READS = 7;
/** A member first seen in the alliance less than this many days before the newest reading is left out. */
export const NEW_MEMBER_DAYS = 14;
/** The share of might a member must have lost over the span to be listed under "lost might". */
export const LOST_MIGHT_PCT = 5;
/** How far back the read goes: the newest daily reads, and the event rosters among them. */
const LOOKBACK_DAILY = 60;
const LOOKBACK_EVENTS = 30;
const DAY_MS = 86_400_000;

export interface UnchangedRow {
  uid: number;
  name: string;
  /** Might in the newest reading, which is also its value in every reading of the run. */
  might: number;
  /** Days between the first and the last reading of the run. */
  days: number;
  /** Kills gained over the run; null when either side is unknown (D15). */
  killsChange: number | null;
}

export interface LostRow {
  uid: number;
  name: string;
  might: number;
  /** Negative: might now minus might at the start of the span. */
  mightChange: number;
  /** The share of the starting might that was lost, in percent. */
  pct: number;
  killsChange: number | null;
}

export interface MightUnchanged {
  unionId: number;
  tag: string | null;
  name: string | null;
  /** Usable daily reads found (at most the lookback). */
  dailyReads: number;
  ready: boolean;
  /** The span of the newest MIN_DAILY_READS daily reads; null while not ready. */
  period: { from: Date; to: Date; daily: number; events: number } | null;
  /** Members in the newest reading. */
  members: number;
  unchanged: UnchangedRow[];
  lost: LostRow[];
}

const change = (before: number | null, after: number | null) =>
  before === null || after === null ? null : after - before;

type ByUid = Map<number, HistoryMember>[];

/** Index of the reading that opens the span: the MIN_DAILY_READS-th newest daily reading. */
function spanStartOf(readings: Reading[]) {
  let seen = 0;
  for (let i = readings.length - 1; i >= 0; i--)
    if (!readings[i]?.event && ++seen === MIN_DAILY_READS) return i;
  return 0;
}

/** Per uid, the index of the oldest reading it is in. */
function firstSeenIndex(readings: Reading[]) {
  const first = new Map<number, number>();
  readings.forEach((r, i) => r.members.forEach((m) => first.has(m.uid) || first.set(m.uid, i)));
  return first;
}

/** The run of one member: the index of its oldest reading, going back while it holds the same might. */
function runStartOf(byUid: ByUid, uid: number, might: number) {
  let start = byUid.length - 1;
  while (start > 0 && byUid[start - 1]?.get(uid)?.power === might) start--;
  return start;
}

/** The members of the newest reading whose might held over a run of enough daily reads. */
function unchangedList(readings: Reading[], byUid: ByUid, newest: Reading) {
  const firstSeen = firstSeenIndex(readings);
  const rows: UnchangedRow[] = [];
  for (const m of newest.members) {
    if (m.power === null) continue;
    const start = runStartOf(byUid, m.uid, m.power);
    const dailyInRun = readings.slice(start).filter((r) => !r.event).length;
    const first = readings[firstSeen.get(m.uid) ?? start] as Reading;
    const settled = newest.at.getTime() - first.at.getTime() >= NEW_MEMBER_DAYS * DAY_MS;
    if (dailyInRun < MIN_DAILY_READS || !settled) continue;
    rows.push({
      uid: m.uid,
      name: m.name,
      might: m.power,
      days: Math.round((newest.at.getTime() - (readings[start] as Reading).at.getTime()) / DAY_MS),
      killsChange: change(byUid[start]?.get(m.uid)?.kills ?? null, m.kills),
    });
  }
  return rows.sort((a, b) => b.days - a.days || b.might - a.might);
}

/** The members of the newest reading whose might fell by LOST_MIGHT_PCT or more since the span's start. */
function lostList(byUid: ByUid, spanStart: number, newest: Reading) {
  const rows: LostRow[] = [];
  for (const m of newest.members) {
    const was = byUid[spanStart]?.get(m.uid);
    if (m.power === null || !was?.power) continue;
    if ((was.power - m.power) * 100 < LOST_MIGHT_PCT * was.power) continue;
    rows.push({
      uid: m.uid,
      name: m.name,
      might: m.power,
      mightChange: m.power - was.power,
      pct: ((was.power - m.power) / was.power) * 100,
      killsChange: change(was.kills, m.kills),
    });
  }
  return rows.sort((a, b) => b.pct - a.pct);
}

/** The two lists for one alliance; both empty and `ready` false until it has MIN_DAILY_READS daily reads. */
export async function mightUnchanged(db: Db, unionId: number): Promise<MightUnchanged> {
  const [daily, events] = await Promise.all([
    dailyReadings(db, unionId, null, LOOKBACK_DAILY),
    eventReadings(db, unionId, null, LOOKBACK_EVENTS),
  ]);
  const readings = [...daily, ...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const newest = readings.at(-1);
  const base = {
    unionId,
    tag: newest?.tag ?? null,
    name: newest?.name ?? null,
    dailyReads: daily.length,
    members: newest?.members.length ?? 0,
  };
  if (!newest || daily.length < MIN_DAILY_READS)
    return { ...base, ready: false, period: null, unchanged: [], lost: [] };

  const byUid: ByUid = readings.map((r) => new Map(r.members.map((m) => [m.uid, m])));
  const spanStart = spanStartOf(readings);
  return {
    ...base,
    ready: true,
    period: {
      from: (readings[spanStart] as Reading).at,
      to: newest.at,
      daily: MIN_DAILY_READS,
      events: readings.slice(spanStart).filter((r) => r.event).length,
    },
    unchanged: unchangedList(readings, byUid, newest),
    lost: lostList(byUid, spanStart, newest),
  };
}

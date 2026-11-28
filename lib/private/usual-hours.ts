// Members' usual hours in game (issue 873, D163), pure: each member's presence readings of the last 30 days
// (`last_online_at` from the own alliance's daily rosters and `last_seen_at` from its own player reads), each
// distinct time one reading, give the server hours the member is usually in game: the shortest run of hours
// that holds 60 % of the readings. Fewer than 7 readings say nothing. The alliance's histogram counts the
// members whose run holds each hour. A daily reading leans toward late hours, and the card says so. Desk
// only, own alliance; nothing here is "online now".
import { zoneOffset } from "./calendar-time";

/** The window the readings come from. */
export const USUAL_DAYS = 30;
/** Fewer readings than this are "not enough readings yet". */
export const USUAL_MIN_READINGS = 7;
/** The band holds at least this share of a member's readings. */
const SHARE = 0.6;

/** A member's band: server hours `from` to `to` inclusive (it may run through midnight), and its readings. */
export interface Band {
  from: number;
  to: number;
  /** The readings inside the band. */
  n: number;
}

export interface Usual {
  /** Distinct readings in the window. */
  readings: number;
  /** Null with fewer than USUAL_MIN_READINGS readings. */
  band: Band | null;
}

/** The distinct reading times (epoch ms) of the window ending at `now`; one time seen twice counts once. */
export function distinctReadings(times: Iterable<number>, now: Date): number[] {
  const since = now.getTime() - USUAL_DAYS * 86_400_000;
  return [...new Set(times)].filter((t) => t >= since && t <= now.getTime());
}

/** The server hour (0–23) of an instant. */
export function serverHour(at: number, serverZone: string): number {
  const minute = Math.floor(at / 60_000) + zoneOffset(serverZone, at);
  return Math.floor((((minute % 1440) + 1440) % 1440) / 60);
}

/** The shortest run of hours holding at least 60 % of the readings; ties go to the run with more, then the earlier. */
export function bandOf(hours: number[]): Band {
  const counts = Array.from({ length: 24 }, (_, h) => hours.filter((x) => x === h).length);
  const need = Math.ceil(hours.length * SHARE);
  for (let length = 1; length <= 24; length++) {
    let best: Band | null = null;
    for (let from = 0; from < 24; from++) {
      let n = 0;
      for (let i = 0; i < length; i++) n += counts[(from + i) % 24] as number;
      if (n >= need && (!best || n > best.n)) best = { from, to: (from + length - 1) % 24, n };
    }
    if (best) return best;
  }
  return { from: 0, to: 23, n: hours.length };
}

/** A member's usual hours from their reading times (epoch ms). */
export function usualOf(times: Iterable<number>, now: Date, serverZone: string): Usual {
  const readings = distinctReadings(times, now);
  if (readings.length < USUAL_MIN_READINGS) return { readings: readings.length, band: null };
  return {
    readings: readings.length,
    band: bandOf(readings.map((t) => serverHour(t, serverZone))),
  };
}

/** The server hours a band covers, in order. */
export const bandHours = (b: Band): number[] =>
  Array.from({ length: ((b.to - b.from + 24) % 24) + 1 }, (_, i) => (b.from + i) % 24);

/** The alliance's usual hours: the members counted, and for each server hour the members whose band holds it. */
export interface HourCounts {
  /** The members of the newest daily update. */
  members: number;
  /** Those with enough readings: the counts' scale. */
  enough: number;
  byHour: number[];
}

export const NO_HOURS: HourCounts = { members: 0, enough: 0, byHour: Array(24).fill(0) };

/** The histogram of `uids` (the newest daily update's members) from each one's reading times. */
export function hourCounts(
  uids: number[],
  times: Map<number, number[]>,
  now: Date,
  serverZone: string,
): HourCounts {
  const byHour: number[] = Array(24).fill(0);
  let enough = 0;
  for (const uid of uids) {
    const { band } = usualOf(times.get(uid) ?? [], now, serverZone);
    if (!band) continue;
    enough++;
    for (const h of bandHours(band)) byHour[h] = (byHour[h] as number) + 1;
  }
  return { members: uids.length, enough, byHour };
}

/** Each member's reading times (epoch ms): `last_online_at` of the daily rosters and the player reads' `last_seen_at`. */
export function presenceTimes(
  reads: { members: { uid: number; lastOnlineAt: Date | null }[] }[],
  seen: { uid: number; at: Date }[],
): Map<number, number[]> {
  const times = new Map<number, number[]>();
  const add = (uid: number, at: Date) => times.set(uid, [...(times.get(uid) ?? []), at.getTime()]);
  for (const r of reads) for (const m of r.members) if (m.lastOnlineAt) add(m.uid, m.lastOnlineAt);
  for (const s of seen) add(s.uid, s.at);
  return times;
}

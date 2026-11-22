// The Insights page's Time zones card (owner, 2026-11-22), pure: the newest daily update's members by the
// time zone their officers recorded (D80), grouped by the UTC offset each zone has now, at the next 00:00 ST
// reset and at the next KvK start, so a group never holds two clock times for one moment (summer time).
// Members with no zone recorded are a count that never joins a group or a share (D75). Counts only: no uid
// or name leaves this module. Usual hours are Members' (08:00–22:59 on their own clock, `isDaytime`).
import { addDays, parseTime, weekdayIndex, zonedInstant, zoneOffset } from "./calendar-time";
import type { MemberFacts } from "./fact-fields";
import { clockAt, isDaytime } from "./members-list";

/** The newest daily update's members and how many of them have each zone. */
export interface ZoneCounts {
  members: number;
  zones: { zone: string; n: number }[];
}

/** The instants the card says on each zone's clock. */
export interface Moments {
  now: Date;
  /** The next 00:00 ST. */
  reset: Date;
  /** The next scheduled KvK start. */
  kvk: Date;
}

export interface ZoneGroup {
  /** Minutes east of UTC at each moment (UTC−3 is −180); every zone of the group has these. */
  offsets: { now: number; reset: number; kvk: number };
  n: number;
  /** The group's IANA zones, most members first, then by city name. */
  zones: string[];
}

/** The IANA city of a zone ("Sao Paulo" for America/Sao_Paulo); null for a fixed-offset Etc zone. */
export const cityOf = (zone: string): string | null =>
  zone.startsWith("Etc/") ? null : (zone.split("/").at(-1) ?? zone).replaceAll("_", " ");

/** How many of `uids` (the newest daily update's members) have each time zone; a cleared fact has none. */
export function zoneCountsOf(uids: number[], facts: Map<number, MemberFacts>): ZoneCounts {
  const perZone = new Map<string, number>();
  for (const uid of uids) {
    const zone = facts.get(uid)?.timeZone?.value;
    if (zone) perZone.set(zone, (perZone.get(zone) ?? 0) + 1);
  }
  return {
    members: uids.length,
    zones: [...perZone]
      .sort((a, b) => b[1] - a[1] || (cityOf(a[0]) ?? a[0]).localeCompare(cityOf(b[0]) ?? b[0]))
      .map(([zone, n]) => ({ zone, n })),
  };
}

export const knownOf = (c: ZoneCounts) => c.zones.reduce((sum, z) => sum + z.n, 0);

/** The 00:00 ST after the server's `today`. */
export const nextReset = (today: string, serverZone: string) =>
  new Date(zonedInstant(addDays(today, 1), 0, serverZone));

/**
 * The first KvK start after `now`: `weekday` (0 = Sunday) at `time` ST, the schedule's EVENT_WEEKDAY and
 * EVENT_TIME. Never a KvK already running (its start is past), unlike `nextEvent`.
 */
export function nextKvk(
  now: Date,
  today: string,
  serverZone: string,
  weekday: number,
  time: string,
) {
  const minute = parseTime(time) ?? 0;
  const day = addDays(today, (weekday - ((weekdayIndex(today) + 1) % 7) + 7) % 7);
  const at = zonedInstant(day, minute, serverZone);
  return new Date(at > now.getTime() ? at : zonedInstant(addDays(day, 7), minute, serverZone));
}

/** The groups, west to east: by the offset now, then at the reset, then at KvK. */
export function zoneGroups(c: ZoneCounts, m: Moments): ZoneGroup[] {
  const groups = new Map<string, ZoneGroup>();
  for (const { zone, n } of c.zones) {
    const offsets = {
      now: zoneOffset(zone, m.now.getTime()),
      reset: zoneOffset(zone, m.reset.getTime()),
      kvk: zoneOffset(zone, m.kvk.getTime()),
    };
    const key = `${offsets.now} ${offsets.reset} ${offsets.kvk}`;
    const g = groups.get(key) ?? { offsets, n: 0, zones: [] };
    g.n += n;
    // `c.zones` is most members first, then by city name, so the group's zones keep that order.
    g.zones.push(zone);
    groups.set(key, g);
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.offsets.now - b.offsets.now ||
      a.offsets.reset - b.offsets.reset ||
      a.offsets.kvk - b.offsets.kvk,
  );
}

/** For each server hour 0–23 of `today`: the members with a zone whose own clock is in their usual hours. */
export function usualHours(c: ZoneCounts, today: string, serverZone: string): number[] {
  const clock = clockAt(today, serverZone);
  return Array.from({ length: 24 }, (_, hour) =>
    c.zones.reduce((sum, z) => sum + (isDaytime(clock(z.zone, hour)) ? z.n : 0), 0),
  );
}

/** The server hours with the most members in their usual hours, as runs ([11, 12] is 11:00–12:59). */
export function busiestHours(byHour: number[]): { from: number; to: number; n: number }[] {
  const top = Math.max(0, ...byHour);
  if (top === 0) return [];
  const runs: { from: number; to: number; n: number }[] = [];
  byHour.forEach((n, hour) => {
    if (n !== top) return;
    const last = runs.at(-1);
    if (last && last.to === hour - 1) last.to = hour;
    else runs.push({ from: hour, to: hour, n });
  });
  // A run through midnight (…23 and 0…) is one run.
  const [first, last] = [runs[0], runs.at(-1)];
  if (runs.length > 1 && first && last && first.from === 0 && last.to === 23) {
    runs.pop();
    runs[0] = { from: last.from, to: first.to, n: top };
  }
  return runs.sort((a, b) => a.from - b.from);
}

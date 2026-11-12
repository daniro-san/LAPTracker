// Scheduled-event times and weekly slots from the env (plan §3.1). Pure: `now` is passed in, times are server
// time (SERVER_TZ), every instant returned is UTC; works for any IANA zone, not only fixed offsets.
// Which phase is due is not decided here: the tick reads before_at/after_at from the events rows.
import type { Env } from "./env";

export type ScheduleConfig = Pick<
  Env,
  | "SERVER_TZ"
  | "EVENT_WEEKDAY"
  | "EVENT_TIME"
  | "SNAPSHOT_BEFORE"
  | "SNAPSHOT_AFTER"
  | "SNAPSHOT_WINDOW_MIN"
  | "QUOTA_CHECK_AT"
  | "REHEARSAL_AT"
  | "DAILY_ROSTER_AT"
>;

export interface ScheduledEvent {
  name: string;
  eventAtUtc: Date;
  beforeAt: Date;
  afterAt: Date;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_MS = 86_400_000;

// The name `eventOn` gives a scheduled event ("Saturday Event 2026-10-31"; the seed prefixes "Seed ").
const GENERATED_NAME = new RegExp(`\\b(${WEEKDAY_NAMES.join("|")}) Event \\d{4}-\\d{2}-\\d{2}$`);

/** True while a scheduled event keeps its generated name, i.e. the owner has not renamed it (D39). */
export const isGeneratedName = (name: string) => GENERATED_NAME.test(name);

interface WallClock {
  y: number;
  m: number;
  d: number;
  weekday: number;
  hh: number;
  mm: number;
}

function wallClock(instant: Date, tz: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(part(type));
  return {
    y: num("year"),
    m: num("month"),
    d: num("day"),
    weekday: WEEKDAYS.indexOf(part("weekday")?.toLowerCase() as (typeof WEEKDAYS)[number]),
    hh: num("hour"),
    mm: num("minute"),
  };
}

/** The UTC instant at which the wall clock in `tz` reads the given date and time. */
function zonedToUtc(day: Day, hhmm: string, tz: string): Date {
  const [hh = 0, mm = 0] = hhmm.split(":").map(Number);
  const guess = Date.UTC(day.y, day.m - 1, day.d, hh, mm);
  const offset = (t: number) => {
    const w = wallClock(new Date(t), tz);
    return Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm) - t;
  };
  // Second pass settles instants next to a DST change.
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}

/** Calendar arithmetic on a server-time date, independent of the host's zone. */
type Day = { y: number; m: number; d: number };

function addDays(day: Day, n: number): Day {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d) + n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const isoDate = (day: Day) =>
  `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;

function eventOn(day: Day, cfg: ScheduleConfig): ScheduledEvent {
  return {
    name: `${WEEKDAY_NAMES[cfg.EVENT_WEEKDAY]} Event ${isoDate(day)}`,
    eventAtUtc: zonedToUtc(day, cfg.EVENT_TIME, cfg.SERVER_TZ),
    beforeAt: zonedToUtc(day, cfg.SNAPSHOT_BEFORE, cfg.SERVER_TZ),
    afterAt: zonedToUtc(day, cfg.SNAPSHOT_AFTER, cfg.SERVER_TZ),
  };
}

/** The last, this and next week's events around `now`, in time order. */
function eventsAround(now: Date, cfg: ScheduleConfig): ScheduledEvent[] {
  const local = wallClock(now, cfg.SERVER_TZ);
  const thisWeek = addDays(local, -((local.weekday - cfg.EVENT_WEEKDAY + 7) % 7));
  return [-7, 0, 7].map((n) => eventOn(addDays(thisWeek, n), cfg));
}

/** The event whose EVENT_TIME is nearest to `now` (plan §3.1). */
export function currentEvent(now: Date, cfg: ScheduleConfig): ScheduledEvent {
  const distance = (e: ScheduledEvent) => Math.abs(e.eventAtUtc.getTime() - now.getTime());
  return eventsAround(now, cfg).reduce((best, e) => (distance(e) < distance(best) ? e : best));
}

/**
 * The event "Run something now" and `/api/snapshot` act on: the nearest scheduled event while its two
 * phases are not both complete; once the nearest one is complete, the next one (D55's closed-round idea
 * for scheduled events). `nearestDone` is whether `currentEvent(now)` has both snapshots complete.
 */
export function targetEvent(now: Date, cfg: ScheduleConfig, nearestDone: boolean): ScheduledEvent {
  const nearest = currentEvent(now, cfg);
  return nearestDone ? (eventsAround(nearest.eventAtUtc, cfg)[2] as ScheduledEvent) : nearest;
}

const windowMs = (cfg: ScheduleConfig) => cfg.SNAPSHOT_WINDOW_MIN * 60_000;

/**
 * The scheduled events that should have a row now: from a day before BEFORE until AFTER's window
 * closes (plan §3.1 "create it when within a day of it"). Usually none, at most one.
 */
export function eventsToCreate(now: Date, cfg: ScheduleConfig): ScheduledEvent[] {
  const t = now.getTime();
  return eventsAround(now, cfg).filter(
    (e) => t >= e.beforeAt.getTime() - DAY_MS && t < e.afterAt.getTime() + windowMs(cfg),
  );
}

/** The first event whose AFTER is still ahead of `now`, for the Friday message. */
export function nextEvent(now: Date, cfg: ScheduleConfig): ScheduledEvent {
  const events = eventsAround(now, cfg);
  return events.find((e) => e.afterAt > now) ?? (events.at(-1) as ScheduledEvent);
}

/** The most recent occurrence of "<day> HH:MM" (server time) at or before `now`. */
export function lastOccurrence(slot: string, now: Date, cfg: ScheduleConfig): Date {
  const [dayName = "", time = "00:00"] = slot.trim().split(/\s+/);
  const weekday = WEEKDAYS.indexOf(dayName as (typeof WEEKDAYS)[number]);
  const local = wallClock(now, cfg.SERVER_TZ);
  const day = addDays(local, -((local.weekday - weekday + 7) % 7));
  const at = zonedToUtc(day, time, cfg.SERVER_TZ);
  return at > now ? zonedToUtc(addDays(day, -7), time, cfg.SERVER_TZ) : at;
}

const inWindow = (now: Date, at: Date, cfg: ScheduleConfig) =>
  now >= at && now.getTime() < at.getTime() + windowMs(cfg);

/** The Friday check's occurrence whose window holds `now`, or null (plan §3.1). */
export function quotaCheckDue(now: Date, cfg: ScheduleConfig): Date | null {
  const at = lastOccurrence(cfg.QUOTA_CHECK_AT, now, cfg);
  return inWindow(now, at, cfg) ? at : null;
}

/** REHEARSAL_AT occurrences whose window holds `now` (plan §3.1); empty REHEARSAL_AT = none. */
export function rehearsalSlotsDue(now: Date, cfg: ScheduleConfig): Date[] {
  return cfg.REHEARSAL_AT.split(",")
    .filter((slot) => slot.trim() !== "")
    .map((slot) => lastOccurrence(slot, now, cfg))
    .filter((at) => inWindow(now, at, cfg))
    .sort((a, b) => a.getTime() - b.getTime());
}

/** Today's daily read (D60) while `now` is in its window: the server date it belongs to and that
 * date's bounds as UTC instants, else null. */
export function dailyReadDue(
  now: Date,
  cfg: ScheduleConfig,
): { day: string; from: Date; to: Date } | null {
  const today = wallClock(now, cfg.SERVER_TZ);
  const at = zonedToUtc(today, cfg.DAILY_ROSTER_AT, cfg.SERVER_TZ);
  if (!inWindow(now, at, cfg)) return null;
  const from = zonedToUtc(today, "00:00", cfg.SERVER_TZ);
  return { day: isoDate(today), from, to: zonedToUtc(addDays(today, 1), "00:00", cfg.SERVER_TZ) };
}

/** The server date `now` falls on, as a daily read's `day` ("2026-11-12"). */
export const serverDay = (now: Date, cfg: Pick<ScheduleConfig, "SERVER_TZ">) =>
  isoDate(wallClock(now, cfg.SERVER_TZ));

/** 0 = Sunday … 6 = Saturday, in server time. */
export function serverWeekday(at: Date, cfg: Pick<ScheduleConfig, "SERVER_TZ">): number {
  return wallClock(at, cfg.SERVER_TZ).weekday;
}

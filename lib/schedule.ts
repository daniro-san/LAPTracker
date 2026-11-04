// When things are due (plan §3.1). Pure: `now` is passed in, times come from the env in server
// time (SERVER_TZ), and every instant returned is UTC. Works for any IANA zone, not only fixed offsets.
import type { Env } from "./env";
import type { Phase } from "./repo";

export type ScheduleConfig = Pick<
  Env,
  | "SERVER_TZ"
  | "EVENT_WEEKDAY"
  | "EVENT_TIME"
  | "SNAPSHOT_BEFORE"
  | "SNAPSHOT_AFTER"
  | "SNAPSHOT_WINDOW_MIN"
  | "QUOTA_CHECK_AT"
>;

export type Action = "quota-check" | Phase;

export interface ScheduledEvent {
  name: string;
  eventAtUtc: Date;
  /** The event day's date in server time, YYYY-MM-DD. */
  date: string;
}

export interface DueAction {
  action: Action;
  event: ScheduledEvent;
  at: Date;
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
function zonedToUtc(day: { y: number; m: number; d: number }, hhmm: string, tz: string): Date {
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
function addDays(day: { y: number; m: number; d: number }, n: number) {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d) + n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const isoDate = (day: { y: number; m: number; d: number }) =>
  `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;

function eventOn(day: { y: number; m: number; d: number }, cfg: ScheduleConfig): ScheduledEvent {
  const date = isoDate(day);
  return {
    name: `${WEEKDAY_NAMES[cfg.EVENT_WEEKDAY]} Event ${date}`,
    eventAtUtc: zonedToUtc(day, cfg.EVENT_TIME, cfg.SERVER_TZ),
    date,
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

/** When each action of `event` is scheduled. The quota check is the last QUOTA_CHECK_AT before it. */
export function actionTimes(event: ScheduledEvent, cfg: ScheduleConfig): Record<Action, Date> {
  const [y = 0, m = 0, d = 0] = event.date.split("-").map(Number);
  const day = { y, m, d };
  const [checkDay = "fri", checkTime = "20:00"] = cfg.QUOTA_CHECK_AT.split(" ");
  const back =
    (cfg.EVENT_WEEKDAY - WEEKDAYS.indexOf(checkDay as (typeof WEEKDAYS)[number]) + 7) % 7;
  const sameDayAfter = back === 0 && checkTime >= cfg.EVENT_TIME;
  return {
    "quota-check": zonedToUtc(addDays(day, -(sameDayAfter ? 7 : back)), checkTime, cfg.SERVER_TZ),
    before: zonedToUtc(day, cfg.SNAPSHOT_BEFORE, cfg.SERVER_TZ),
    after: zonedToUtc(day, cfg.SNAPSHOT_AFTER, cfg.SERVER_TZ),
  };
}

/** The first event whose AFTER snapshot is still ahead of `now`, for the Friday message. */
export function nextEvent(now: Date, cfg: ScheduleConfig): ScheduledEvent {
  const events = eventsAround(now, cfg);
  return events.find((e) => actionTimes(e, cfg).after > now) ?? (events.at(-1) as ScheduledEvent);
}

/**
 * Every action whose window [at, at + SNAPSHOT_WINDOW_MIN) contains `now`, earliest first. The tick
 * runs the first one not already done, and only that one.
 */
export function dueActions(now: Date, cfg: ScheduleConfig): DueAction[] {
  const windowMs = cfg.SNAPSHOT_WINDOW_MIN * 60_000;
  return eventsAround(now, cfg)
    .flatMap((event) =>
      Object.entries(actionTimes(event, cfg)).map(([action, at]) => ({
        action: action as Action,
        event,
        at,
      })),
    )
    .filter(({ at }) => now >= at && now.getTime() < at.getTime() + windowMs)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** "Sat 2026-11-07 10:00 server (12:00 UTC)", for admin messages. */
export function describeInstant(at: Date, cfg: ScheduleConfig): string {
  const w = wallClock(at, cfg.SERVER_TZ);
  const hhmm = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const day = WEEKDAY_NAMES[w.weekday]?.slice(0, 3);
  return `${day} ${isoDate(w)} ${hhmm(w.hh, w.mm)} server (${hhmm(at.getUTCHours(), at.getUTCMinutes())} UTC)`;
}

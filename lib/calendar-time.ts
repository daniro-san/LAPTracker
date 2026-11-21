// The calendar's clock (issue 300), pure and browser-safe: server days as "YYYY-MM-DD", a time as minutes
// after the server's midnight, the instant a server day and time fall on, and the same instant on the
// viewer's own clock. Weeks run Monday to Sunday (naming.md: the calendar week starts on Monday in all
// three languages). Works for any IANA zone; the server's (Etc/GMT+2) has no daylight saving.
import { serverInstant } from "./schedule";

export const DAY_MS = 86_400_000;

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (day: string, n: number) => isoDay(dayMs(day) + n * DAY_MS);

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (day: string) => (new Date(dayMs(day)).getUTCDay() + 6) % 7;

/** The Monday of the week that holds `day`. */
export const mondayOf = (day: string) => addDays(day, -weekdayIndex(day));

/** Whole days from `a` to `b`. */
export const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const isDay = (text: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(dayMs(text)) && isoDay(dayMs(text)) === text;

/** "16:00" for 960. */
export const hhmm = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/**
 * A 24-hour time as officers type it ("18:00", "1800", "18", "18.00", "18h00", "9:05") in minutes after
 * midnight; null for anything else.
 */
export function parseTime(text: string): number | null {
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/i.exec(text.trim());
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2] ?? 0)];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * A time field's text as it is typed on a phone's digit keypad, which has no ":" key: the colon goes in by
 * itself ("2100" reads "21:00", "930" reads "9:30"). A colon, dot or "h" the officer typed is kept as the
 * split. Only digits and that one colon are kept, at most "HH:MM".
 */
export function typedTime(text: string): string {
  const split = /^([^:.h]*)[:.h](.*)$/i.exec(text);
  const digits = (s: string) => s.replace(/\D/g, "");
  if (split) return `${digits(split[1] ?? "").slice(0, 2)}:${digits(split[2] ?? "").slice(0, 2)}`;
  const d = digits(text).slice(0, 4);
  if (d.length <= 2) return d;
  return (d[0] ?? "0") > "2" ? `${d[0]}:${d.slice(1, 3)}` : `${d.slice(0, 2)}:${d.slice(2)}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsIn(zone: string, at: number) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(zone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** The day ("YYYY-MM-DD") the clock of `zone` shows at `at`. */
export const dayIn = (zone: string, at: number) => partsIn(zone, at).day;

/** Minutes east of UTC on the clock of `zone` at `at`. */
export function zoneOffset(zone: string, at: number): number {
  const wall = partsIn(zone, at);
  return Math.round(
    (dayMs(wall.day) + wall.minute * 60_000 - Math.floor(at / 60_000) * 60_000) / 60_000,
  );
}

/** The instant (epoch ms) at which the clock of `zone` reads `minute` on `day`: lib/schedule's one
 * zone conversion (`serverInstant`), which works for any IANA zone. */
export const zonedInstant = (day: string, minute: number, zone: string): number =>
  serverInstant(day, hhmm(minute), { SERVER_TZ: zone }).getTime();

/**
 * The instant `at` on the clock of `zone`: its time, and how many days its date lies from `serverDay`
 * (−1, 0 or +1 for a viewer within 24 hours of the server).
 */
export function clockIn(
  at: number,
  zone: string,
  serverDay: string,
): { time: string; shift: number } {
  const wall = partsIn(zone, at);
  return { time: hhmm(wall.minute), shift: daysBetween(serverDay, wall.day) };
}

/** "UTC−2", "UTC+5:30": the zone's offset at `at`, with a true minus sign. */
export function offsetLabel(zone: string, at: number): string {
  const off = zoneOffset(zone, at);
  const sign = off < 0 ? "−" : "+";
  const abs = Math.abs(off);
  return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, "0")}` : ""}`;
}

// Number and time formatting shared by every page (DESIGN.md "Language-light rules"): `Intl` with the
// request's locale (app/_ui/locale.ts), compact by default and exact on tap, times in server time with
// the words "server time" after them, in the admin area too (07c S3a); public pages use the viewer's own
// zone and date order when they chose them (D38).
import { copy } from "@/lib/copy";

const MINUS = "−";

/** The footnote mark on a falling total whose members left (DESIGN.md `member-mark`). */
export const MEMBER_MARK = "*";

const numberFormats = new Map<string, Intl.NumberFormat>();

/** Intl formatters are costly to build; one per locale and style, reused across requests. */
function numberFormat(locale: string, style: "compact" | "exact" | "percent"): Intl.NumberFormat {
  const key = `${locale}|${style}`;
  let format = numberFormats.get(key);
  if (!format) {
    const options: Record<typeof style, Intl.NumberFormatOptions> = {
      compact: { notation: "compact", minimumSignificantDigits: 3, maximumSignificantDigits: 3 },
      exact: { maximumFractionDigits: 0 },
      percent: { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 },
    };
    format = new Intl.NumberFormat(locale, options[style]);
    numberFormats.set(key, format);
  }
  return format;
}

/** 3.94B (en), 3,94 bi (pt-BR), 3,94 млрд (ru); below 1,000 the plain integer. Always unsigned. */
export function compact(n: number, locale: string): string {
  const abs = Math.abs(n);
  return numberFormat(locale, abs < 1000 ? "exact" : "compact").format(abs);
}

export const exact = (n: number, locale: string): string =>
  numberFormat(locale, "exact").format(Math.abs(n));

export const signOf = (n: number): "+" | typeof MINUS | "" => (n > 0 ? "+" : n < 0 ? MINUS : "");

/** A signed percent of `base`; null when `base` is 0 or unknown. */
export function percent(delta: number | null, base: number | null): number | null {
  if (delta === null || base === null || base === 0) return null;
  return (delta / base) * 100;
}

export const percentText = (p: number, locale: string): string =>
  `${signOf(p)}${numberFormat(locale, "percent").format(Math.abs(p) / 100)}`;

/** `[NSE] Natural Selection`: the game's own way of writing an alliance. */
export const allianceLabel = (tag: string | null, name: string | null): string =>
  [tag !== null ? `[${tag}]` : null, name].filter(Boolean).join(" ");

/** `+3 joined`, `−2 left`: the sign is a symbol, so it is not part of the copy. */
export const joinedText = (n: number) => `+${n} ${copy.ledger.joined}`;
export const leftText = (n: number) => `${MINUS}${n} ${copy.ledger.left}`;
/** `−2 Members`: the kills note names the loss in the game's own word (persona test, 7b). */
export const membersLostText = (n: number) => `${MINUS}${n} ${copy.ledger.members}`;

/** `Name: Old → New`. */
export const changeText = (label: string, from: string, to: string) => `${label}: ${from} → ${to}`;

/** The DOM id of an alliance's row on the main page ("jump to my alliance"). */
export const rowAnchor = (unionId: number) => `alliance-${unionId}`;

/** The viewer's settings (D38), one cookie each; no cookie = server time and the locale's own dates. */
export const ZONE_COOKIE = "tz";
export const DATE_COOKIE = "date";

/** The date orders a viewer may pick (#27). Month names stay in the request's locale. */
export const DATE_FORMATS = ["d-mmm", "mmm-d", "dd/mm", "dd.mm", "iso"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

/** A `date` cookie value on the allow-list, else null (the locale's own order). */
export const parseDateFormat = (value: string | undefined): DateFormat | null =>
  (DATE_FORMATS as readonly string[]).includes(value ?? "") ? (value as DateFormat) : null;

/** How the viewer reads times: `own` = in the zone their browser reported, followed by "your time". */
export interface ClockView {
  own: boolean;
  date: DateFormat | null;
}

/** Dates and times for one request: the viewer's locale, the server's clock or the viewer's own
 * (DESIGN.md). */
export interface Clock {
  /** "Oct 31" */
  day: (d: Date) => string;
  /** "Sat, Oct 31" */
  weekday: (d: Date) => string;
  /** "Saturday, October 31" */
  long: (d: Date) => string;
  /** "16:01", for column heads that say "server time" once */
  hhmm: (d: Date) => string;
  /** "16:01 server time" */
  time: (d: Date) => string;
  /** "Oct 31, 16:01 server time": status chips and "as of" lines spell it out like the admin */
  at: (d: Date) => string;
  /** "Sat, 07/11/2026, 12:00 server time" in pt-BR: the full date for the admin area */
  stamp: (d: Date) => string;
  /** "Server time" or "Your time": the corner of a table whose heads are bare times */
  zone: string;
}

export function makeClock(
  locale: string,
  timeZone: string,
  view: ClockView = { own: false, date: null },
): Clock {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone, ...o });
  const day = f({ month: "short", day: "numeric" });
  const weekday = f({ weekday: "short", month: "short", day: "numeric" });
  const long = f({ weekday: "long", month: "long", day: "numeric" });
  const hhmm = f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const full = f({
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const word = view.own ? copy.time.yourTime : copy.time.serverTime;
  const ordered = view.date ? orderedDay(f, view.date) : null;
  const dayText = ordered ? (d: Date) => ordered(d, "short") : (d: Date) => day.format(d);
  const shortName = f({ weekday: "short" });
  const longName = f({ weekday: "long" });
  return {
    day: dayText,
    weekday: ordered
      ? (d) => `${shortName.format(d)}, ${ordered(d, "short")}`
      : (d) => weekday.format(d),
    long: ordered ? (d) => `${longName.format(d)}, ${ordered(d, "long")}` : (d) => long.format(d),
    hhmm: (d) => hhmm.format(d),
    time: (d) => `${hhmm.format(d)} ${word}`,
    at: (d) => `${dayText(d)}, ${hhmm.format(d)} ${word}`,
    stamp: (d) => `${full.format(d)} ${word}`,
    zone: view.own ? copy.ledger.yourTime : copy.ledger.serverTime,
  };
}

/** A day and month in the chosen order, built from the locale's own parts (`formatToParts`), so the
 * month reads "out." in pt-BR and "окт." in ru. */
function orderedDay(
  f: (o: Intl.DateTimeFormatOptions) => Intl.DateTimeFormat,
  date: DateFormat,
): (d: Date, month: "short" | "long") => string {
  const named = {
    short: f({ day: "numeric", month: "short" }),
    long: f({ day: "numeric", month: "long" }),
  };
  const numeric = f({ year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = (fmt: Intl.DateTimeFormat, d: Date) =>
    Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return (d, month) => {
    if (date === "d-mmm" || date === "mmm-d") {
      const p = parts(named[month], d);
      return date === "d-mmm" ? `${p.day} ${p.month}` : `${p.month} ${p.day}`;
    }
    const p = parts(numeric, d);
    if (date === "iso") return `${p.year}-${p.month}-${p.day}`;
    return `${p.day}${date === "dd/mm" ? "/" : "."}${p.month}`;
  };
}

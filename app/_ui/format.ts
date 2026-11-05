// Number and time formatting shared by every page (DESIGN.md "Language-light rules"): `Intl` with the
// request's locale (app/_ui/locale.ts), compact by default and exact on tap, times in server time with
// the word "server" after them, in the admin area too (07c S3a).
import { copy } from "@/lib/copy";

const MINUS = "−";

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

/** Dates and times for one request: the viewer's locale, the server's clock (DESIGN.md). */
export interface Clock {
  /** "Oct 31" */
  day: (d: Date) => string;
  /** "Sat, Oct 31" */
  weekday: (d: Date) => string;
  /** "Saturday, October 31" */
  long: (d: Date) => string;
  /** "16:01", for column heads that say "server" once */
  hhmm: (d: Date) => string;
  /** "16:01 server" */
  time: (d: Date) => string;
  /** "Oct 31, 16:01 server" */
  at: (d: Date) => string;
  /** "Sat, 07/11/2026, 12:00 server" in pt-BR: the full date for the admin area */
  stamp: (d: Date) => string;
}

export function makeClock(locale: string, timeZone: string): Clock {
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
  const time = (d: Date) => `${hhmm.format(d)} ${copy.time.server}`;
  return {
    day: (d) => day.format(d),
    weekday: (d) => weekday.format(d),
    long: (d) => long.format(d),
    hhmm: (d) => hhmm.format(d),
    time,
    at: (d) => `${day.format(d)}, ${time(d)}`,
    stamp: (d) => `${full.format(d)} ${copy.time.server}`,
  };
}

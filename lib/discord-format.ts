// The Discord messages' formats (lib/notify.ts) and the event picture's (lib/event-image.tsx). Discord
// has no viewer locale, so they use one fixed English format, in server time.
import { copy } from "./copy";

export const MINUS = "−";
export const sign = (n: number) => (n > 0 ? "+" : n < 0 ? MINUS : "");
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 3,
});
export const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `85.8M`, `2`: the size of a number, compact above 1,000, without its sign. */
export const compact = (n: number) =>
  Math.abs(n) < 1000 ? String(Math.abs(n)) : compactFormat.format(Math.abs(n));

/** `+85.8M`, `−2`: compact above 1,000, signed with a real minus. */
export const signedCompact = (n: number) => `${sign(n)}${compact(n)}`;

export interface DiscordClock {
  /** "Sat, Nov 7, 14:01 server time": the public pages' date, with the weekday. */
  at: (d: Date) => string;
  /** "Sat, 11/07/2026, 14:01 server time": /admin's date. */
  stamp: (d: Date) => string;
  /** "Sat, Nov 7" and "14:01", in server time: the event picture's parts (D58). */
  day: (d: Date) => string;
  time: (d: Date) => string;
}

export function discordClock(timeZone: string): DiscordClock {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone, ...o });
  const day = f({ weekday: "short", month: "short", day: "numeric" });
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
  return {
    at: (d) => `${day.format(d)}, ${hhmm.format(d)} ${copy.time.serverTime}`,
    stamp: (d) => `${full.format(d)} ${copy.time.serverTime}`,
    day: (d) => day.format(d),
    time: (d) => hhmm.format(d),
  };
}

// The Discord messages' formats (lib/notify.ts) and the event picture's (lib/event-image.tsx). Discord
// has no viewer locale, so they use one fixed English format, in server time.
import { compactLarge } from "./compact";
import { copy } from "./copy";

/**
 * Text people type (a round's name; an alliance's tag and name, or a member's name, typed in game) shows
 * literally: Discord markdown is backslash-escaped and mentions get a zero-width space after the `@`. Pure,
 * so the desk's "Copy names" uses it in the browser too (issue 585).
 */
export const escapeDiscord = (text: string) =>
  text
    .replace(/[\\*_~`|>[\]]/g, "\\$&")
    .replace(/@(everyone|here)/g, "@\u200b$1")
    .replace(/<@/g, "<@\u200b");

export const MINUS = "−";
export const sign = (n: number) => (n > 0 ? "+" : n < 0 ? MINUS : "");
export const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `85.8M`, `2`: the size of a number, compact above 1,000, without its sign. */
export const compact = (n: number) =>
  Math.abs(n) < 1000 ? String(Math.abs(n)) : compactLarge(n, "en-US");

/** `+85.8M`, `−2`: compact above 1,000, signed with a real minus. */
export const signedCompact = (n: number) => `${sign(n)}${compact(n)}`;

/** `54 %`: a share as a whole percent, with a space as the issue writes it. */
export const shareText = (part: number, whole: number) => `${Math.round((part / whole) * 100)} %`;

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

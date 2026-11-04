// Number and time formatting shared by every page (plan Phase 5): compact by default, exact on tap.
const MINUS = "−";

const compactFormat = new Intl.NumberFormat("en", {
  notation: "compact",
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 3,
});

/** 3.94B, 34.2M, 93.0M, 12.3K; below 1,000 the plain integer. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  return abs < 1000 ? String(abs) : compactFormat.format(abs);
}

export const exact = (n: number): string => Math.abs(n).toLocaleString("en-US");

export const signOf = (n: number): "+" | typeof MINUS | "" => (n > 0 ? "+" : n < 0 ? MINUS : "");

/** A signed percent of `base`, one decimal; null when `base` is 0 or unknown. */
export function percent(delta: number | null, base: number | null): number | null {
  if (delta === null || base === null || base === 0) return null;
  return (delta / base) * 100;
}

export const percentText = (p: number): string => `${signOf(p)}${Math.abs(p).toFixed(1)}%`;

const utcDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const utcTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const utcWeekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

/** "Nov 7 14:00 UTC" */
export const utcStamp = (d: Date): string => `${utcDate.format(d)} ${utcTime.format(d)} UTC`;

/** "Nov 7" */
export const utcDay = (d: Date): string => utcDate.format(d);

/** "Sat Nov 7" */
export const utcDayWithWeekday = (d: Date): string =>
  `${utcWeekday.format(d)} ${utcDate.format(d)}`;

/** "14:00 UTC" */
export const utcClock = (d: Date): string => `${utcTime.format(d)} UTC`;

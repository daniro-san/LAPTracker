// What a draft's review shows beside a row (issue 299), pure: for Alliance Duel the points already saved
// for that member (and a note when the days and the week disagree, never fixed silently), for a check our
// own read and how far apart it is. Digits are grouped with the separator the server sent.
import type { DuelSaved } from "@/lib/private/import-view";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Day = (typeof DAYS)[number];
export type Words = Record<string, string>;

/** Digits grouped with the officer's language's separator (from the server: no Intl in the client). */
export const grouped = (n: number, sep: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

export const fillIn = (template: string | undefined, values: Record<string, string | number>) =>
  (template ?? "").replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** The saved points of one member for the target (a day, or "week"), and what disagrees with the new value. */
export function duelKnown(
  saved: DuelSaved,
  target: Day | "week",
  value: number | null,
  w: Words,
  sep: string,
): string[] {
  const before = saved[target];
  const days = DAYS.reduce((sum, d) => sum + (saved[d] ?? 0), 0);
  const week = saved.week;
  const lines: string[] = [];
  if (before !== undefined) lines.push(fillIn(w["import.was"], { v: grouped(before, sep) }));
  if (value === null) return lines;
  if (target === "week" && days > value) {
    lines.push(fillIn(w["import.duel.daysMore"], { sum: grouped(days, sep) }));
  }
  if (target !== "week" && week !== undefined && value > week) {
    lines.push(fillIn(w["import.duel.overWeek"], { v: grouped(week, sep) }));
  }
  return lines;
}

/** Our own read of the member beside the picture's value: "we read 9,100 · same" or "· 650 apart". */
export function checkKnown(ours: number | null, value: number | null, w: Words, sep: string) {
  if (ours === null) return [w["import.oursNone"] ?? ""];
  const read = fillIn(w["import.ours"], { v: grouped(ours, sep) });
  if (value === null) return [read];
  const apart = Math.abs(value - ours);
  return [
    read,
    apart === 0 ? (w["import.same"] ?? "") : fillIn(w["import.apart"], { d: grouped(apart, sep) }),
  ];
}

// What a draft's review shows beside a row (issue 299), pure: for Alliance Duel the points already saved
// for that member (and a note when the days and the week disagree, never fixed silently), for a check our
// own read and how far apart it is. Digits are grouped with the separator the server sent.
import { fill } from "@/lib/copy";
import type { DuelSaved } from "@/lib/private/import-view";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Day = (typeof DAYS)[number];
export type Words = Record<string, string>;

/** Digits grouped with the officer's language's separator (from the server: no Intl in the client). */
export const grouped = (n: number, sep: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

/** A value field's text with its digits grouped ("77,384,266"), for the line under the field; "" when empty. */
export const groupedValue = (text: string, sep: string) =>
  /^\d+$/.test(text) ? grouped(Number(text), sep) : "";

/** `fill` for a word that may be missing from the words sent to the client. */
export const fillIn = (template: string | undefined, values: Record<string, string | number>) =>
  fill(template ?? "", values);

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
  if (before !== undefined) lines.push(fillIn(w["shots.was"], { v: grouped(before, sep) }));
  if (value === null) return lines;
  if (target === "week" && days > value) {
    lines.push(fillIn(w["shots.duel.daysMore"], { sum: grouped(days, sep) }));
  }
  if (target !== "week" && week !== undefined && value > week) {
    lines.push(fillIn(w["shots.duel.overWeek"], { v: grouped(week, sep) }));
  }
  return lines;
}

/** A member fact as shown: AD Tech in %, squad might with grouped digits. */
export const factText = (field: string | undefined, v: number, sep: string) =>
  field === "adTech" ? `${v}%` : grouped(v, sep);

/**
 * A member update beside its row: "AD Tech: 55% → 60%", or "(nothing before)", and that AD Tech at 100 %
 * is complete and is not written again (owner, issue 299).
 */
export function factKnown(
  field: string | undefined,
  before: number | null | undefined,
  value: number | null,
  w: Words,
  sep: string,
): string[] {
  const label = w[`shots.field.${field}`] ?? "";
  if (field === "adTech" && before === 100) return [w["shots.adComplete"] ?? ""];
  if (value === null) return [];
  const now = factText(field, value, sep);
  return before === null || before === undefined
    ? [fillIn(w["shots.factNew"], { field: label, now })]
    : [fillIn(w["shots.factChange"], { field: label, was: factText(field, before, sep), now })];
}

/** The game data beside the picture's value: "Game data: 5,750 · picture is 4,000 higher", or "same". */
export function checkKnown(ours: number | null, value: number | null, w: Words, sep: string) {
  if (ours === null) return [w["shots.oursNone"] ?? ""];
  const read = fillIn(w["shots.ours"], { v: grouped(ours, sep) });
  if (value === null) return [read];
  if (value === ours) return [read, w["shots.same"] ?? ""];
  const key = value > ours ? "shots.higher" : "shots.lower";
  return [read, fillIn(w[key], { d: grouped(Math.abs(value - ours), sep) })];
}

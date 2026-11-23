// The member card's "Last 7 days" (issue 461, D127, D136): daily quest points, Alliance Help coins (out of
// 1,000) and donations on each of the 7 server days up to the newest end-of-day read, the average, and might
// since the first of those days. Quest points and donations have no known daily cap, so their bars are drawn
// against the alliance's best member-day in the same 7 days (D158): a steady low giver and a steady high
// giver no longer look alike. A day with no read of the member is null ("—"); a read that lists them with
// nothing sent is "none" (D127), written "none". The average is `dayAverage`, the one rule the card, Me and
// Insights share (owner, 2026-11-22, #663): a "none" day counts as 0 and the line names it; a day with no
// read never counts.
import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { fill, plural } from "../words";
import type { WorkspaceDictionary } from "./dictionary";
import { NONE } from "./fact-text";
import { DAY_MS, isoDay } from "./member-week";

export const DAY_METRICS = ["quests", "coins", "donations"] as const;
export type DayMetric = (typeof DAY_METRICS)[number];
const FIELD = { quests: "active", coins: "dailyHonor", donations: "dailyTech" } as const;
/** Alliance Help coins stop at 1,000 a day (D127): their bars are drawn against it. */
export const COINS_MAX = 1000;
export const LAST_DAYS = 7;

/** A day's value: a number, "none" (listed, nothing sent), or null (no read listing the member). */
export type DayCell = number | "none" | null;

export interface LastDays {
  /** The 7 server days, the oldest first, ending at the newest read's day. */
  days: string[];
  rows: Record<DayMetric, DayCell[]>;
  /** Might on the newest day with a might against the oldest one; null with fewer than two such days. */
  might: { from: string; change: number } | null;
  /**
   * The alliance's best member-day in these days (`allianceBest`), the scale of the quest points and
   * donations bars (D158). Set by the member card only; absent on a member's own page (D142), which draws against their own best day: an alliance figure there
   * would show other members' values.
   */
  best?: Record<"quests" | "donations", number>;
}

/** The member's last 7 days from the alliance's end-of-day reads; null before the first read. */
export function lastDays(reads: readonly RosterRead[], uid: number): LastDays | null {
  const newest = reads.at(-1);
  if (!newest) return null;
  const end = Date.parse(`${newest.day}T00:00:00Z`);
  const days = Array.from({ length: LAST_DAYS }, (_, i) =>
    isoDay(end - (LAST_DAYS - 1 - i) * DAY_MS),
  );
  const members: (RosterMember | undefined)[] = days.map((day) =>
    reads.find((r) => r.day === day)?.members.find((m) => m.uid === uid),
  );
  const row = (k: DayMetric): DayCell[] => members.map((m) => (m ? (m[FIELD[k]] ?? "none") : null));
  const mights = days.flatMap((day, i) => {
    const power = members[i]?.power;
    return power === null || power === undefined ? [] : [{ day, power }];
  });
  const [first, last] = [mights[0], mights.at(-1)];
  return {
    days,
    rows: { quests: row("quests"), coins: row("coins"), donations: row("donations") },
    might:
      first && last && first !== last
        ? { from: first.day, change: last.power - first.power }
        : null,
  };
}

/**
 * The alliance's best member-day for quest points and donations over `days` (D158): the scale of the member
 * card's bars. Read once per card, not inside `lastDays`, which Follow-up runs for every member.
 */
export function allianceBest(
  reads: readonly RosterRead[],
  days: readonly string[],
): Record<"quests" | "donations", number> {
  const members = reads.filter((r) => days.includes(r.day)).flatMap((r) => r.members);
  const best = (k: DayMetric) => Math.max(0, ...members.map((m) => m[FIELD[k]] ?? 0));
  return { quests: best("quests"), donations: best("donations") };
}

/** A member's average over the days a daily update lists them, with how many of those days were "none". */
export interface DayAverage {
  /** The mean, unrounded: a "none" day counts as 0. */
  value: number;
  days: number;
  none: number;
}

/**
 * The one average rule (owner, 2026-11-22, #663; D136 and D139 amended): over the days whose daily update
 * lists the member, a "none" day counting as 0; a day with no daily update (null) and a day still to come
 * are left out. Null when no day lists the member.
 */
export function dayAverage(cells: readonly (DayCell | "later")[]): DayAverage | null {
  const listed = cells.filter((c): c is number | "none" => c !== null && c !== "later");
  if (listed.length === 0) return null;
  const sum = listed.reduce<number>((a, c) => a + (c === "none" ? 0 : c), 0);
  const none = listed.filter((c) => c === "none").length;
  return { value: sum / listed.length, days: listed.length, none };
}

const form = (n: number, language: string) =>
  plural(n, { one: "one", other: "other" } as const, language);

/**
 * "Average 400 · 6 days, of which 2 none", so a lower average says why; "None on all 7 days" when every listed day
 * is "none", never "Average 0"; null with no listed day.
 */
export function averageLine(
  a: DayAverage | null,
  t: WorkspaceDictionary,
  show: (n: number) => string,
  language: string,
): string | null {
  if (!a) return null;
  if (a.none === a.days)
    return fill(t[`card.days.allNone.${form(a.days, language)}`], { n: a.days });
  const line = fill(t[`card.days.average.${form(a.days, language)}`], {
    v: show(Math.round(a.value)),
    n: a.days,
  });
  return a.none === 0 ? line : fill(t["card.days.withNone"], { line, k: a.none });
}

/** One day of one row as the card shows it: the bar's share of the row's scale, the number, its words. */
export interface DayBar {
  /** 0–1 against the row's scale; null when there is no number. */
  share: number | null;
  /** "555", "6.5K", "none", or "—" for no read. */
  value: string;
  none: boolean;
  /** "Tue, Nov 17: 555" for screen readers. */
  said: string;
}

export interface DaysRow {
  metric: DayMetric;
  label: string;
  /** "Average 400 · 6 days, of which 2 none" (`averageLine`); "—" when no day lists the member. */
  average: string;
  /** A member's own page (D142): the same row's average over their own last week. */
  last?: string;
  bars: DayBar[];
}

export interface DaysCard {
  head: string;
  /** Each day's short weekday and date, the oldest first. */
  days: { weekday: string; day: string }[];
  rows: DaysRow[];
  /** "Might +1.20M since Thu, Nov 12"; null when unknown. */
  might: string | null;
  /** The name of the marker drawn where a value is "—". */
  noData: string;
  /** What the bars are drawn against, with the alliance's best member-days; null on a member's own page. */
  scale: string | null;
}

export interface DaysFormats {
  compact: (n: number) => string;
  number: (n: number) => string;
  /** A server day as a short date with its weekday. */
  date: (day: string) => string;
  weekday: (day: string) => string;
  dayOfMonth: (day: string) => string;
  language: string;
}

function rowOf(metric: DayMetric, d: LastDays, t: WorkspaceDictionary, f: DaysFormats): DaysRow {
  const [cells, days] = [d.rows[metric], d.days];
  const numbers = cells.filter((c): c is number => typeof c === "number");
  const scale = metric === "coins" ? COINS_MAX : Math.max(1, d.best?.[metric] ?? 0, ...numbers);
  const show = metric === "donations" ? f.compact : f.number;
  const bars = cells.map((c, i): DayBar => {
    const value = typeof c === "number" ? show(c) : c === "none" ? t["members.don.nothing"] : NONE;
    const said = c === null ? t["members.don.none"] : value;
    return {
      share: typeof c === "number" ? Math.min(1, c / scale) : null,
      value,
      none: c !== null && typeof c !== "number",
      said: `${f.date(days[i] as string)}: ${said}`,
    };
  });
  const average = averageLine(dayAverage(cells), t, show, f.language) ?? NONE;
  return { metric, label: t[`card.days.${metric}`], average, bars };
}

/** The card's words for the last 7 days. */
export function daysCard(d: LastDays, t: WorkspaceDictionary, f: DaysFormats): DaysCard {
  const might = d.might
    ? fill(t[d.might.change === 0 ? "card.days.mightSame" : "card.days.might"], {
        delta: `${d.might.change > 0 ? "+" : "−"}${f.compact(Math.abs(d.might.change))}`,
        date: f.date(d.might.from),
      })
    : null;
  return {
    head: t["card.days.head"],
    days: d.days.map((day) => ({ weekday: f.weekday(day), day: f.dayOfMonth(day) })),
    rows: DAY_METRICS.map((m) => rowOf(m, d, t, f)),
    might,
    noData: t["nodata.mark"],
    scale: d.best
      ? fill(t["card.days.scale"], {
          quests: f.number(Math.max(1, d.best.quests)),
          donations: f.compact(Math.max(1, d.best.donations)),
        })
      : null,
  };
}

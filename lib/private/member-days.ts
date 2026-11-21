// The member card's "Last 7 days" (issue 461, D127, D136): daily quest points, Alliance Help coins (out of
// 1,000) and donations on each of the 7 server days up to the newest end-of-day read, the average over the
// days with a number, and might since the first of those days. A day with no read of the member is null
// ("—"); a read that lists them with nothing sent is "none" (D127), never 0 and never in an average.
import { fill } from "../copy";
import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
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
  /** "Average 555 a day · 6 days"; "—" when no day has a number. */
  average: string;
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
}

export interface DaysFormats {
  compact: (n: number) => string;
  number: (n: number) => string;
  /** A server day as a short date with its weekday. */
  date: (day: string) => string;
  weekday: (day: string) => string;
  dayOfMonth: (day: string) => string;
}

function rowOf(
  metric: DayMetric,
  cells: DayCell[],
  days: string[],
  t: WorkspaceDictionary,
  f: DaysFormats,
): DaysRow {
  const numbers = cells.filter((c): c is number => typeof c === "number");
  const scale = metric === "coins" ? COINS_MAX : Math.max(1, ...numbers);
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
  const average =
    numbers.length === 0
      ? NONE
      : fill(t[numbers.length === 1 ? "card.days.average.one" : "card.days.average.other"], {
          v: show(Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length)),
          n: numbers.length,
        });
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
    rows: DAY_METRICS.map((m) => rowOf(m, d.rows[m], d.days, t, f)),
    might,
    noData: t["nodata.mark"],
  };
}

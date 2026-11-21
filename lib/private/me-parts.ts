// A member's own page (issue 487, D142), pure: their week against their own last week, their might and
// kills over 30 days, their recovery since KvK, and the lines of where they are needed. People first (D75):
// only their own numbers, never another member's, a rank or an average of others; a day with no read is
// "no data" and never counts (D127); "none" is a read that lists them with nothing that day.
import { fill } from "../copy";
import type { OwnDay } from "../repo/me";
import { addDays, weekDays, weekdayIndex, mondayOf } from "./calendar-time";
import type { WorkspaceDictionary } from "./dictionary";
import { NONE } from "./fact-text";
import {
  daysCard,
  DAY_METRICS,
  type DayCell,
  type DayMetric,
  type DaysCard,
  type DaysFormats,
} from "./member-days";
import type { Mark, RollKind } from "./roll-call-rules";
import { callTitle, markWord } from "./roll-call-words";

const FIELD = { quests: "active", coins: "daily_honor", donations: "daily_tech" } as const;
/** The might and kills chart covers this many days up to the newest read. */
export const PROGRESS_DAYS = 30;

const numberOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A day's value: a number, "none" (listed, nothing sent), null (no read listing them) or "later". */
function cellOf(days: readonly OwnDay[], day: string, metric: DayMetric): DayCell | "later" {
  const newest = days.at(-1)?.day ?? "";
  if (day > newest) return "later";
  const d = days.find((r) => r.day === day);
  if (!d?.listed || !d.daily) return null;
  return numberOf(d.daily[FIELD[metric]]) ?? "none";
}

const averageOf = (cells: readonly (DayCell | "later")[]) => {
  const numbers = cells.filter((c): c is number => typeof c === "number");
  if (numbers.length === 0) return null;
  return { v: Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length), n: numbers.length };
};

/**
 * This game week (Monday to Sunday, server days, holding `today`) as the card's day bars, each row with
 * the same row's average over the member's own last week beside it. Null before any read.
 */
export function weekCard(
  days: readonly OwnDay[],
  today: string,
  t: WorkspaceDictionary,
  f: DaysFormats,
): DaysCard | null {
  if (days.length === 0) return null;
  const week = weekDays(mondayOf(today));
  const lastWeek = weekDays(addDays(mondayOf(today), -7));
  const cells = (m: DayMetric, list: string[]) => list.map((day) => cellOf(days, day, m));
  const rows = Object.fromEntries(
    DAY_METRICS.map((m) => [m, cells(m, week).map((c) => (c === "later" ? null : c))]),
  ) as Record<DayMetric, DayCell[]>;
  const card = daysCard({ days: week, rows, might: null }, t, f);
  return {
    ...card,
    head: t["me.week.head"],
    rows: card.rows.map((row) => {
      const later = cells(row.metric, week).map((c) => c === "later");
      const last = averageOf(cells(row.metric, lastWeek));
      const show = row.metric === "donations" ? f.compact : f.number;
      const line = last
        ? fill(t[last.n === 1 ? "card.days.average.one" : "card.days.average.other"], {
            v: show(last.v),
            n: last.n,
          })
        : null;
      return {
        ...row,
        average:
          row.average === NONE ? row.average : fill(t["me.week.this"], { line: row.average }),
        last: line ? fill(t["me.week.last"], { line }) : t["me.week.lastNone"],
        bars: row.bars.map((b, i) =>
          later[i]
            ? {
                ...b,
                value: "",
                said: `${f.date(week[i] as string)}: ${t["me.week.later"]}`,
              }
            : b,
        ),
      };
    }),
  };
}

export interface Series {
  label: string;
  /** "Might 85.8M · +1.2M since Thu, Oct 22". */
  line: string;
  points: { day: string; value: number }[];
}

/** Might or kills on each read of the last PROGRESS_DAYS days that lists the member; null under 2 reads. */
export function seriesOf(
  days: readonly OwnDay[],
  key: "power" | "kills",
  t: WorkspaceDictionary,
  f: Pick<DaysFormats, "compact" | "date">,
): Series | null {
  const newest = days.at(-1)?.day;
  if (!newest) return null;
  const from = addDays(newest, -(PROGRESS_DAYS - 1));
  const points = days.flatMap((d) => {
    const value = d[key];
    return d.listed && d.day >= from && value !== null ? [{ day: d.day, value }] : [];
  });
  const [first, last] = [points[0], points.at(-1)];
  if (!first || !last || first === last) return null;
  const label = t[key === "power" ? "me.might" : "me.kills"];
  const delta = last.value - first.value;
  const line = fill(t[delta === 0 ? "me.same" : "me.change"], {
    label,
    v: f.compact(last.value),
    delta: `${delta > 0 ? "+" : "−"}${f.compact(Math.abs(delta))}`,
    date: f.date(first.day),
  });
  return { label, line, points };
}

/**
 * "Back to 92% of your might before KvK (Sat, Nov 14)": the newest read's might against the might at the
 * event's Start, only when that read came after the event's day.
 */
export function recoveryLine(
  days: readonly OwnDay[],
  before: { day: string; power: number } | null,
  t: WorkspaceDictionary,
  date: (day: string) => string,
): string | null {
  const newest = days.findLast((d) => d.listed && d.power !== null);
  if (!before || before.power <= 0 || !newest?.power || newest.day <= before.day) return null;
  const pct = Math.round((newest.power / before.power) * 100);
  return fill(t[pct >= 100 ? "me.kvk.full" : "me.kvk.back"], { pct, date: date(before.day) });
}

export interface Needed {
  team: string | null;
  seats: { movedTo: string | null; planned: string; coach: boolean; second: string | null }[];
  marks: { kind: string; variant: string | null; day: string; part: string; mark: string | null }[];
}

/** The member's week in plain lines, the soonest first: Elixir team, caravan seats, roll call marks. */
export function neededLines(
  n: Needed,
  week: string,
  t: WorkspaceDictionary,
  date: (day: string) => string,
): string[] {
  const seats = n.seats.map((s) => {
    const day = s.movedTo ?? addDays(week, weekdayIndex(s.planned));
    const seat = s.coach ? "coach" : s.second === "vip" ? "vip" : "guardian";
    return { day, line: fill(t[`me.caravan.${seat}`], { day: date(day) }) };
  });
  const marks = n.marks.map((m) => {
    const kind = m.kind as RollKind;
    const mark = m.mark as Mark;
    const wall = m.part === "wall" && mark !== "assumed";
    // Squads off the wall says itself whole; "On the wall" is plain enough.
    const wallWord = mark === "yes" ? t["roll.prep.wall"] : t["roll.prep.wall.no"];
    return {
      day: m.day,
      line: fill(t["me.mark"], {
        title: callTitle({ kind, variant: m.variant, placed: null }, t),
        day: date(m.day),
        mark: wall ? wallWord : markWord(mark, kind, t),
      }),
    };
  });
  const team = n.team ? [fill(t["me.elixir"], { team: n.team })] : [];
  return [
    ...team,
    ...[...seats, ...marks].sort((a, b) => a.day.localeCompare(b.day)).map((x) => x.line),
  ];
}

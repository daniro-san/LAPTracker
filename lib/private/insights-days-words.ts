// A week's days on the Insights page (D158 rule 7 (b), chart to chart), pure: the next level of a week row
// of the week's pulse and of the membership flow, drawn in the chart's place. Each day comes from the same
// function as its week's figure (`pulseDays` beside `pulseOf`, `flowDays` beside the week's moves), so the
// days add up to the week; the sum line says so, and says which days have no daily update and why they do
// not count. The pulse's middle donation is a median, which days do not add up to: its line says that.
// One level further, a day: the pulse's who reached each measure (`reachedOn`, which `pulseOf` counts with;
// pattern (c), names only, thanks first) and the flow's came-from and went-to bars (counts only, D75).
import { fill } from "../words";
import { calendarDates } from "./calendar-words";
import { NONE } from "./fact-text";
import type { InsightsView } from "./insights";
import type { Formats } from "./insights-format";
import type { Pulse, PulseMeasure } from "./insights-rules";
import { setOf } from "./insights-sets";
import {
  dayPick,
  latestLine,
  placeRows,
  PULSE_METRICS,
  pulseValue,
  rosterSize,
  scaled,
  type BarRow,
  type DayBar,
  type DayPick,
} from "./insights-words";
import { gameWeek } from "./member-week";

/**
 * The level each chart shows, from the address; null for the chart itself. `pulse` and `flow`: the week a
 * chart opens to its days (its Monday); `pulseDay` and `flowDay`: a day of them; `kvk`: a KvK's day, open
 * to its recovery days, and `kvkDay` one of those days.
 */
export interface InsightsLevels {
  pulse: string | null;
  pulseDay: string | null;
  flow: string | null;
  flowDay: string | null;
  kvk: string | null;
  kvkDay: string | null;
}

export interface PulseDaysWords {
  /** "Week of Nov 9": the path's last step. */
  label: string;
  metrics: { label: string; days: DayBar[]; sum: string }[];
  /** "No daily update on Sun: left out.", or null. */
  noRead: string | null;
  /** The week's days with a daily update, each opening who reached each measure that day. */
  picks: DayPick[];
}

export interface FlowDaysWords {
  label: string;
  /** `drill`: a day with a join or a leave opens its came-from and went-to bars (its day, its moves). */
  days: {
    label: string;
    joined: BarRow;
    left: BarRow;
    drill: { key: string; count: number } | null;
  }[];
  sum: string;
  /** Why a day shows no change: no daily update then, or before the first one that can be compared. */
  notes: string[];
}

const weekLabel = (monday: string, f: Formats) =>
  fill(f.t["insights.pulse.week"], { date: calendarDates(f.language).dayMonth(monday) });

/** The sum line of one metric: the week's count, which its days add up to; for donations, why not. */
function pulseSum(week: Pulse, k: (typeof PULSE_METRICS)[number], label: string, f: Formats) {
  const { t } = f;
  if (k !== "tech") {
    const s = week[k];
    return s ? fill(t["drill.pulse.sum"], { week: label, n: s.n, of: s.of }) : NONE;
  }
  const [m, d] = [week.tech, week.donated];
  return m && d
    ? fill(t["drill.pulse.median"], {
        week: label,
        value: pulseValue(week, "tech", f.language).text,
        n: d.n,
        of: d.of,
      })
    : NONE;
}

/** The pulse week the address opens, day by day, each metric on the scale its week rows use. */
export function pulseDaysWords(v: InsightsView, f: Formats): PulseDaysWords | null {
  const level = v.pulseWeek;
  const week = v.pulse?.weeks.find((w) => w.monday === level?.monday);
  if (!level || !week) return null;
  const dates = calendarDates(f.language);
  const label = weekLabel(level.monday, f);
  const missing = level.days.filter((d) => d.pulse === null).map((d) => dates.weekday(d.day));
  return {
    label,
    metrics: PULSE_METRICS.map((k) => {
      const days = level.days.map((d) =>
        d.pulse && d.pulse !== "later" ? pulseValue(d.pulse, k, f.language) : null,
      );
      // Donations are drawn against the highest middle value among the week's days.
      const top = Math.max(0, ...days.map((x) => x?.x ?? 0));
      // Under each day's share, the count it is of, so the days can be added up by eye.
      const of = (p: Pulse | null | "later") => {
        const s = k === "tech" || !p || p === "later" ? null : p[k];
        return s ? { of: `${s.n}/${s.of}` } : {};
      };
      return {
        label: f.t[`insights.pulse.${k}`],
        days: level.days.map((d, i) => ({
          weekday: dates.weekday(d.day),
          value: d.pulse === "later" ? "" : (days[i]?.text ?? NONE),
          share: scaled(days[i]?.x ?? null, k, top),
          later: d.pulse === "later",
          ...of(d.pulse),
        })),
        sum: pulseSum(week, k, label, f),
      };
    }),
    noRead:
      missing.length > 0 ? fill(f.t["insights.pulse.noRead"], { days: missing.join(", ") }) : null,
    picks: level.days.flatMap((d) =>
      d.pulse && d.pulse !== "later" ? [dayPick(d.day, d.pulse.coins?.of ?? 0, f)] : [],
    ),
  };
}

/** The flow week the address opens, day by day: joined and left against the members, as its week row. */
export function flowDaysWords(
  v: InsightsView,
  monday: string | null,
  f: Formats,
): FlowDaysWords | null {
  const flow = v.flow;
  const week = flow?.weeks.find((w) => w.monday === monday);
  if (!flow || !week || week.joined.length + week.left.length === 0) return null;
  const { t } = f;
  const dates = calendarDates(f.language);
  const members = rosterSize(flow.tenure);
  const bar = (n: number | null, sign: string, label: string): BarRow => ({
    label,
    value: n === null ? NONE : n > 0 ? `${sign}${n}` : "0",
    share: n === null || members === 0 ? null : n / members,
  });
  const shown = week.days.filter((d) => d.moves !== "later");
  const noRead = shown.filter((d) => d.moves === null && d.day >= flow.from);
  const before = shown.some((d) => d.day < flow.from);
  return {
    label: weekLabel(week.monday, f),
    days: shown.map((d) => {
      const moves = d.moves === "later" ? null : d.moves;
      const moved = (moves?.joined.length ?? 0) + (moves?.left.length ?? 0);
      return {
        label: dates.short(d.day),
        joined: bar(moves?.joined.length ?? null, "+", t["insights.flow.joined"]),
        left: bar(moves?.left.length ?? null, "−", t["insights.flow.left"]),
        drill: moved > 0 ? { key: d.day, count: moved } : null,
      };
    }),
    sum: fill(t["drill.flow.sum"], {
      week: weekLabel(week.monday, f),
      joined: week.joined.length,
      left: week.left.length,
    }),
    notes: [
      ...(noRead.length > 0
        ? [
            fill(t["drill.flow.noRead"], {
              days: noRead.map((d) => dates.weekday(d.day)).join(", "),
            }),
          ]
        : []),
      ...(before ? [fill(t["drill.flow.before"], { date: dates.short(flow.since) })] : []),
    ],
  };
}

/** The week a day level sits in: its label, and its Monday's level (null: this week, the card itself). */
export interface DayWeek {
  label: string;
  monday: string | null;
}

/** A pulse day: who reached each measure, each row a count of names in place (pattern (c)). */
export interface PulseDayWords {
  /** "Thu, Nov 19": the path's last step. */
  label: string;
  week: DayWeek;
  rows: BarRow[];
  /** The day's middle donation, a value with no names behind it. */
  middle: string;
  sum: string;
  notes: string[];
}

/** A flow day: where its joiners came from and its leavers went, against the members (counts only). */
export interface FlowDayWords {
  label: string;
  week: DayWeek;
  joined: number;
  left: number;
  came: BarRow[];
  went: BarRow[];
  sum: string;
}

const MEASURES: PulseMeasure[] = ["quests", "coins", "donated"];
const MEASURE_NAMES = {
  quests: "insights.pulse.quests",
  coins: "insights.pulse.coins",
  donated: "drill.pulseDay.donated",
} as const;

/** The week `day` sits in, as its pulse or flow row names it; this week is the card itself. */
function dayWeek(day: string, thisWeek: string | undefined, f: Formats): DayWeek {
  const monday = gameWeek(day)[0] as string;
  return monday === thisWeek
    ? { label: f.t["insights.pulse.thisWeek"], monday: null }
    : { label: weekLabel(monday, f), monday };
}

/** The pulse day the address opens: who did each measure that day, in name order, nobody else (D75). */
export function pulseDayWords(v: InsightsView, f: Formats): PulseDayWords | null {
  const level = v.pulseDay;
  if (!level || !v.pulse) return null;
  const { t } = f;
  const label = calendarDates(f.language).short(level.day);
  const rows = MEASURES.map((k): BarRow => {
    const r = level.reached[k];
    const name = t[MEASURE_NAMES[k]];
    return {
      label: name,
      value: r.of > 0 ? fill(t["insights.pulse.questsOf"], { n: r.uids.length, of: r.of }) : NONE,
      share: r.of > 0 ? r.uids.length / r.of : null,
      set: setOf("pulse_reached", `${k}-${level.day}`, r.uids, v.people, {
        ...f,
        what: `${name} · ${label}`,
        onward: false,
      }),
    };
  });
  const unknown = level.reached.coins.of - level.reached.quests.of;
  return {
    label,
    week: dayWeek(level.day, v.pulse.weeks.at(-1)?.monday, f),
    rows,
    middle: `${t["insights.pulse.tech"]}: ${latestLine(level.pulse, "tech", f)}`,
    sum: fill(t["drill.pulseDay.sum"], { day: label }),
    notes: unknown > 0 ? [fill(t["drill.pulseDay.questsUnknown"], { n: unknown })] : [],
  };
}

/** The flow day the address opens: its joiners' and leavers' places, which add up to its counts. */
export function flowDayWords(v: InsightsView, f: Formats): FlowDayWords | null {
  const flow = v.flow;
  const day = flow?.day;
  if (!flow || !day) return null;
  const { t } = f;
  const members = rosterSize(flow.tenure);
  const label = calendarDates(f.language).short(day.day);
  return {
    label,
    week: dayWeek(day.day, flow.weeks.at(-1)?.monday, f),
    joined: day.joined,
    left: day.left,
    came: placeRows(day.cameFrom, members, v.labels, t),
    went: placeRows(day.wentTo, members, v.labels, t),
    sum: fill(t["drill.flowDay.sum"], { day: label, joined: day.joined, left: day.left }),
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const one = (x: string | string[] | undefined) => (typeof x === "string" && DAY.test(x) ? x : null);

type LevelQuery = Partial<Record<keyof InsightsLevels, string | string[]>>;

/** The levels the address asks for (`?pulse=<monday>&flowDay=<day>…`); anything else is the chart itself. */
export const levelsOf = (q: LevelQuery): InsightsLevels => ({
  pulse: one(q.pulse),
  pulseDay: one(q.pulseDay),
  flow: one(q.flow),
  flowDay: one(q.flowDay),
  kvk: one(q.kvk),
  kvkDay: one(q.kvkDay),
});

/** The Insights address with one chart's level changed and the others kept, landing on that chart's card. */
export function levelHref(
  base: string,
  levels: InsightsLevels,
  change: Partial<InsightsLevels>,
  card: string,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...levels, ...change })) if (v) q.set(k, v);
  const query = q.toString();
  return `${base}${query ? `?${query}` : ""}#${card}`;
}

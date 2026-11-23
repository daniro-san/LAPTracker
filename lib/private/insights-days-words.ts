// A week's days on the Insights page (D158 rule 7 (b), chart to chart), pure: the next level of a week row
// of the week's pulse and of the membership flow, drawn in the chart's place. Each day comes from the same
// function as its week's figure (`pulseDays` beside `pulseOf`, `flowDays` beside the week's moves), so the
// days add up to the week; the sum line says so, and says which days have no daily update and why they do
// not count. The pulse's middle donation is a median, which days do not add up to: its line says that.
import { fill } from "../words";
import { calendarDates } from "./calendar-words";
import { NONE } from "./fact-text";
import type { InsightsView } from "./insights";
import type { Formats } from "./insights-format";
import type { Pulse } from "./insights-rules";
import {
  PULSE_METRICS,
  pulseValue,
  rosterSize,
  scaled,
  type BarRow,
  type DayBar,
} from "./insights-words";

/** The week a chart opens to its days (its Monday, from the address), or null for the chart itself. */
export interface InsightsLevels {
  pulse: string | null;
  flow: string | null;
}

export interface PulseDaysWords {
  /** "Week of Nov 9": the path's last step. */
  label: string;
  metrics: { label: string; days: DayBar[]; sum: string }[];
  /** "No daily update on Sun: left out.", or null. */
  noRead: string | null;
}

export interface FlowDaysWords {
  label: string;
  days: { label: string; joined: BarRow; left: BarRow }[];
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
      return {
        label: dates.short(d.day),
        joined: bar(moves?.joined.length ?? null, "+", t["insights.flow.joined"]),
        left: bar(moves?.left.length ?? null, "−", t["insights.flow.left"]),
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
      ...(before ? [fill(t["drill.flow.before"], { date: dates.short(flow.from) })] : []),
    ],
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const one = (x: string | string[] | undefined) => (typeof x === "string" && DAY.test(x) ? x : null);

/** The levels the address asks for (`?pulse=<monday>&flow=<monday>`); anything else is the chart itself. */
export const levelsOf = (q: { pulse?: string | string[]; flow?: string | string[] }) => ({
  pulse: one(q.pulse),
  flow: one(q.flow),
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

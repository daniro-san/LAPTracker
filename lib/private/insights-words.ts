// The Insights page's words (issue 489), pure: each section's numbers as the rows its HTML bars draw (D68:
// labels and numbers in HTML beside every bar) and the lines that say what the section rests on. A missing
// number is "—" (NONE), drawn as the NoData mark; never 0.
import { compactLarge } from "../compact";
import { fill, isolate } from "../copy";
import type { AllianceLabel } from "../repo/alliances";
import { calendarDates } from "./calendar-words";
import type { WorkspaceDictionary, WorkspaceKey, WorkspaceLanguage } from "./dictionary";
import { NONE } from "./fact-text";
import type { InsightsView } from "./insights";
import {
  EFFORT_METRICS,
  EFFORT_MIN_READS,
  TENURE_DAYS,
  type Median,
  type Place,
  type Pulse,
  type Share,
} from "./insights-rules";
import { COINS_MAX } from "./member-days";

/** One bar: its label, the number beside it, its length (0–1, null: no bar) and a muted note. */
export interface BarRow {
  label: string;
  value: string;
  share: number | null;
  note?: string;
  /** The row to read first (this week). */
  current?: boolean;
}

/** One day of this week: the bar and the number under it; "later" days are blank. */
export interface DayBar {
  weekday: string;
  value: string;
  share: number | null;
  later: boolean;
}

export interface PulseMetricWords {
  label: string;
  latest: string;
  days: DayBar[];
  weeks: BarRow[];
}

export interface InsightsWords {
  pulse: { based: string[]; metrics: PulseMetricWords[] } | null;
  effort: {
    based: string[];
    groups: { label: string; rows: BarRow[] }[];
    quiet: { uid: number; name: string }[];
  } | null;
  flow: {
    based: string;
    weeks: { label: string; joined: BarRow; left: BarRow }[];
    came: BarRow[];
    went: BarRow[];
    tenure: BarRow[];
    newcomers: string[];
  } | null;
}

type Formats = { t: WorkspaceDictionary; language: WorkspaceLanguage };

function counted(t: WorkspaceDictionary, key: string, n: number, language: string, vars = {}) {
  const form = new Intl.PluralRules(language).select(n) === "one" ? "one" : "other";
  return fill(t[`${key}.${form}` as WorkspaceKey], { n, ...vars });
}

const whole = (n: number, language: string) =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(n);
const compact = (n: number, language: string) =>
  Math.abs(n) < 1000 ? whole(n, language) : compactLarge(n, language);
const percent = (x: number, language: string) =>
  new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 0 }).format(x);
const signedPercent = (x: number, language: string) =>
  new Intl.NumberFormat(language, {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(x);

type Metric = "quests" | "coins" | "tech";
const PULSE_METRICS: Metric[] = ["quests", "coins", "tech"];

/** A pulse value as a 0–1 length and its words; tech against the highest of the compared values. */
function pulseValue(p: Pulse, k: Metric, language: string): { x: number | null; text: string } {
  if (k === "tech") {
    const m = p.tech;
    return m ? { x: m.value, text: compact(m.value, language) } : { x: null, text: NONE };
  }
  const s = p[k];
  return s ? { x: s.n / s.of, text: percent(s.n / s.of, language) } : { x: null, text: NONE };
}

const scaled = (x: number | null, k: Metric, top: number) =>
  x === null ? null : k === "tech" ? (top > 0 ? x / top : 0) : x;

function latestLine(p: Pulse, k: Metric, f: Formats): string {
  const { t } = f;
  if (k === "tech") {
    const [m, d] = [p.tech as Median | null, p.donated];
    return m && d
      ? `${compact(m.value, f.language)}, ${fill(t["insights.pulse.techOf"], { n: d.n, of: d.of })}`
      : NONE;
  }
  const s = p[k] as Share | null;
  return s
    ? fill(t[k === "quests" ? "insights.pulse.questsOf" : "insights.pulse.coinsOf"], {
        n: s.n,
        of: s.of,
      })
    : NONE;
}

function pulseWords(v: NonNullable<InsightsView["pulse"]>, f: Formats): InsightsWords["pulse"] {
  const { t, language } = f;
  const dates = calendarDates(language);
  const read = v.days.filter((d) => d.pulse !== null && d.pulse !== "later");
  const missing = v.days.filter((d) => d.pulse === null);
  const latest = read.at(-1);
  const based = [
    counted(t, "insights.pulse.based", read.length, language, {
      days: read.map((d) => dates.weekday(d.day)).join(", "),
    }),
    ...(missing.length > 0
      ? [
          fill(t["insights.pulse.noRead"], {
            days: missing.map((d) => dates.weekday(d.day)).join(", "),
          }),
        ]
      : []),
  ];
  const metrics = PULSE_METRICS.map((k) => {
    const days = v.days.map((d) =>
      d.pulse && d.pulse !== "later" ? pulseValue(d.pulse, k, language) : null,
    );
    const weeks = v.weeks.map((w) => pulseValue(w, k, language));
    const top = Math.max(0, ...[...days, ...weeks].map((x) => x?.x ?? 0));
    return {
      label: t[`insights.pulse.${k}`],
      latest:
        latest && latest.pulse !== null && latest.pulse !== "later"
          ? fill(t["insights.pulse.lastRead"], {
              date: dates.short(latest.day),
              value: latestLine(latest.pulse, k, f),
            })
          : NONE,
      days: v.days.map((d, i) => ({
        weekday: dates.weekday(d.day),
        value: d.pulse === "later" ? "" : (days[i]?.text ?? NONE),
        share: scaled(days[i]?.x ?? null, k, top),
        later: d.pulse === "later",
      })),
      weeks: v.weeks.map((w, i) => ({
        label:
          i === v.weeks.length - 1
            ? t["insights.pulse.thisWeek"]
            : fill(t["insights.pulse.week"], { date: dates.dayMonth(w.monday) }),
        value: weeks[i]?.text ?? NONE,
        share: scaled(weeks[i]?.x ?? null, k, top),
        note:
          w.reads > 0
            ? counted(t, "insights.pulse.days", w.reads, language)
            : t["insights.pulse.noReadWeek"],
        current: i === v.weeks.length - 1,
      })),
    };
  });
  return { based, metrics };
}

function effortWords(e: NonNullable<InsightsView["effort"]>, f: Formats): InsightsWords["effort"] {
  const { t, language } = f;
  const dates = calendarDates(language);
  const left = (
    [
      ["insights.effort.fresh", e.leftOut.fresh],
      ["insights.effort.away", e.leftOut.away],
      ["insights.effort.noMight", e.leftOut.noMight],
    ] as const
  ).filter(([, n]) => n > 0);
  const based = [
    counted(t, "insights.effort.based", e.reads, language, {
      range:
        e.from === e.to
          ? dates.dayMonth(e.to)
          : `${dates.dayMonth(e.from)} – ${dates.dayMonth(e.to)}`,
      members: e.members,
    }),
    ...(e.reads < EFFORT_MIN_READS ? [fill(t["insights.effort.few"], { n: e.reads })] : []),
    ...(left.length > 0
      ? [
          fill(t["insights.effort.leftOut"], {
            list: left.map(([k, n]) => fill(t[k], { n })).join(", "),
          }),
        ]
      : []),
  ];
  const groups = EFFORT_METRICS.map((k) => {
    const top =
      k === "coins" ? COINS_MAX : Math.max(0, ...e.bands.map((b) => b.medians[k]?.value ?? 0));
    return {
      label: t[`insights.effort.${k}`],
      rows: e.bands.map((b) => {
        const m = b.medians[k];
        return {
          label: fill(t["insights.effort.band"], {
            low: compact(b.low, language),
            high: compact(b.high, language),
          }),
          // Coins stop at 1,000: the plain number, never "1.00K".
          value: m ? (k === "coins" ? whole(m.value, language) : compact(m.value, language)) : NONE,
          share: m && top > 0 ? Math.min(1, m.value / top) : null,
          note: fill(t["insights.effort.members"], { n: b.members }),
        };
      }),
    };
  });
  return { based, groups, quiet: e.quiet.map((q) => ({ uid: q.uid, name: q.name })) };
}

/** "[TAG] Name", each part when known; "Not known" for id 0. */
function placeLabel(p: Place, labels: Map<number, AllianceLabel>, t: WorkspaceDictionary) {
  if (p.unionId === 0) return t["insights.flow.unknown"];
  const label = labels.get(p.unionId);
  const tag = p.tag ?? label?.tag ?? null;
  const parts = [tag ? `[${tag}]` : null, label?.name ?? null].filter((x) => x !== null);
  return isolate(parts.length > 0 ? parts.join(" ") : String(p.unionId));
}

function placeRows(
  list: Place[],
  labels: Map<number, AllianceLabel>,
  t: WorkspaceDictionary,
): BarRow[] {
  const top = Math.max(1, ...list.map((p) => p.n));
  return list.map((p) => ({
    label: placeLabel(p, labels, t),
    value: String(p.n),
    share: p.n / top,
  }));
}

function flowWords(v: InsightsView, f: Formats): InsightsWords["flow"] {
  const flow = v.flow;
  if (!flow) return null;
  const { t, language } = f;
  const dates = calendarDates(language);
  const top = Math.max(1, ...flow.weeks.flatMap((w) => [w.joined, w.left]));
  const last = flow.weeks.length - 1;
  const tenure = flow.tenure;
  const members = tenure.under.reduce((a, b) => a + b, 0) + tenure.over + tenure.sinceStart;
  const tenureRow = (label: string, n: number): BarRow => ({
    label,
    value: String(n),
    share: members > 0 ? n / members : 0,
  });
  const nc = flow.newcomers;
  const newcomers =
    !nc || nc.n === 0
      ? [t["insights.newcomers.none"]]
      : [
          counted(t, "insights.newcomers.count", nc.n, language),
          nc.median
            ? fill(t["insights.newcomers.grew"], {
                grew: nc.grew,
                counted: nc.counted,
                median: signedPercent(nc.median.value, language),
              })
            : t["insights.newcomers.noMight"],
        ];
  return {
    based: counted(t, "insights.flow.based", flow.reads, language, {
      date: dates.short(flow.from),
    }),
    weeks: flow.weeks.map((w, i) => ({
      label:
        i === last
          ? t["insights.pulse.thisWeek"]
          : fill(t["insights.pulse.week"], { date: dates.dayMonth(w.monday) }),
      joined: {
        label: t["insights.flow.joined"],
        value: w.joined > 0 ? `+${w.joined}` : "0",
        share: w.joined / top,
      },
      left: {
        label: t["insights.flow.left"],
        value: w.left > 0 ? `−${w.left}` : "0",
        share: w.left / top,
      },
    })),
    came: placeRows(flow.cameFrom, v.labels, t),
    went: placeRows(flow.wentTo, v.labels, t),
    // A band that starts at or past the days our records cover cannot hold anyone yet: left out.
    tenure: [
      ...TENURE_DAYS.flatMap((_, i) =>
        (TENURE_DAYS[i - 1] ?? 0) < tenure.span
          ? [tenureRow(t[`insights.tenure.${i}` as WorkspaceKey], tenure.under[i] ?? 0)]
          : [],
      ),
      ...((TENURE_DAYS.at(-1) ?? 0) < tenure.span
        ? [tenureRow(t["insights.tenure.over"], tenure.over)]
        : []),
      tenureRow(
        fill(t["insights.tenure.start"], { date: dates.dayMonth(flow.firstRead) }),
        tenure.sinceStart,
      ),
    ],
    newcomers,
  };
}

/** Every section's words; a section is null before the alliance's first end-of-day read. */
export function insightsWords(
  v: InsightsView,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): InsightsWords {
  const f = { t, language };
  return {
    pulse: v.pulse ? pulseWords(v.pulse, f) : null,
    effort: v.effort ? effortWords(v.effort, f) : null,
    flow: flowWords(v, f),
  };
}

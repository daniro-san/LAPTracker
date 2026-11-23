// The Insights page's words (issue 489), pure: each section's numbers as the rows its HTML bars draw (D68:
// labels and numbers in HTML beside every bar) and the lines that say what the section rests on. A missing
// number is "—" (NONE), drawn as the NoData mark; never 0. A count that stands for a set of members carries
// that set (#678): its number is the length of the list the same function returned, and its names are in
// name order with nothing beside them (D75).
import { isolate } from "../copy";
import type { AllianceLabel } from "../repo/alliances";
import { fill, plural } from "../words";
import { calendarDates } from "./calendar-words";
import type { WorkspaceDictionary, WorkspaceKey, WorkspaceLanguage } from "./dictionary";
import { NONE } from "./fact-text";
import type { InsightsView } from "./insights";
import { effortWords } from "./insights-effort-words";
import { compact, percent, type Formats } from "./insights-format";
import {
  NEWCOMER_DAYS,
  TENURE_DAYS,
  type Median,
  type Place,
  type Pulse,
  type Share,
} from "./insights-rules";
import { setOf, type MemberSet } from "./insights-sets";

/** One bar: its label, the number beside it, its length (0–1, null: no bar) and a muted note. */
export interface BarRow {
  label: string;
  value: string;
  share: number | null;
  /** Where a threshold sits (100 % on KvK recovery), as a share of the bar's track (D158). */
  reference?: number;
  note?: string;
  /** The row to read first (this week). */
  current?: boolean;
  /** The members the row counts, opened by a tap (#678). */
  set?: MemberSet | null;
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
    /** "Left out: 3 new, 4 on a break": each kind with members, and who (#678). */
    leftOut: { label: string; set: MemberSet }[];
    /** "Who is in each range": one row per range, its members behind a tap (#678). */
    ranges: BarRow[];
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
    fill(
      plural(
        read.length,
        { one: t["insights.pulse.based.one"], other: t["insights.pulse.based.other"] },
        language,
      ),
      { n: read.length, days: read.map((d) => dates.weekday(d.day)).join(", ") },
    ),
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
            ? fill(
                plural(
                  w.reads,
                  { one: t["insights.pulse.days.one"], other: t["insights.pulse.days.other"] },
                  language,
                ),
                { n: w.reads },
              )
            : t["insights.pulse.noReadWeek"],
        current: i === v.weeks.length - 1,
      })),
    };
  });
  return { based, metrics };
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

/**
 * How long members have been with us, a row per band. A band that starts at or past the days our records
 * cover cannot hold anyone yet: left out. `from` is a band's fewest days with us: a band that can hold
 * newcomers (under NEWCOMER_DAYS) stays a count, as newcomers are "Aggregate only" (owner, 2026-11-20)
 * until the owner says otherwise (#678).
 */
function tenureRows(
  flow: NonNullable<InsightsView["flow"]>,
  people: InsightsView["people"],
  f: Formats,
): BarRow[] {
  const { t, language } = f;
  const tenure = flow.tenure;
  const members =
    tenure.under.reduce((a, b) => a + b.length, 0) + tenure.over.length + tenure.sinceStart.length;
  const row = (label: string, uids: number[], key: string, from: number): BarRow => ({
    label,
    value: String(uids.length),
    share: members > 0 ? uids.length / members : 0,
    set: from >= NEWCOMER_DAYS ? setOf("tenure", key, uids, people, language) : null,
  });
  const over = TENURE_DAYS.at(-1) ?? 0;
  return [
    ...TENURE_DAYS.flatMap((_, i) => {
      const from = TENURE_DAYS[i - 1] ?? 0;
      return from < tenure.span
        ? [
            row(
              t[`insights.tenure.${i}` as WorkspaceKey],
              tenure.under[i] ?? [],
              `tenure-${i}`,
              from,
            ),
          ]
        : [];
    }),
    ...(over < tenure.span
      ? [row(t["insights.tenure.over"], tenure.over, "tenure-over", over)]
      : []),
    // Here at our first daily update: never newcomers (they are first seen after it).
    row(
      fill(t["insights.tenure.start"], { date: calendarDates(language).dayMonth(flow.firstRead) }),
      tenure.sinceStart,
      "tenure-start",
      Infinity,
    ),
  ];
}

function flowWords(v: InsightsView, f: Formats): InsightsWords["flow"] {
  const flow = v.flow;
  if (!flow) return null;
  const { t, language } = f;
  const dates = calendarDates(language);
  const top = Math.max(1, ...flow.weeks.flatMap((w) => [w.joined.length, w.left.length]));
  const last = flow.weeks.length - 1;
  const nc = flow.newcomers;
  const newcomers =
    !nc || nc.uids.length === 0
      ? [t["insights.newcomers.none"]]
      : [
          fill(
            plural(
              nc.uids.length,
              {
                one: t["insights.newcomers.count.one"],
                other: t["insights.newcomers.count.other"],
              },
              language,
            ),
            { n: nc.uids.length },
          ),
          nc.median
            ? fill(t["insights.newcomers.grew"], {
                grew: nc.grew,
                counted: nc.counted,
                median: signedPercent(nc.median.value, language),
              })
            : t["insights.newcomers.noMight"],
        ];
  return {
    based: fill(
      plural(
        flow.reads,
        { one: t["insights.flow.based.one"], other: t["insights.flow.based.other"] },
        language,
      ),
      { n: flow.reads, date: dates.sentence(flow.from) },
    ),
    weeks: flow.weeks.map((w, i) => ({
      label:
        i === last
          ? t["insights.pulse.thisWeek"]
          : fill(t["insights.pulse.week"], { date: dates.dayMonth(w.monday) }),
      joined: {
        label: t["insights.flow.joined"],
        value: w.joined.length > 0 ? `+${w.joined.length}` : "0",
        share: w.joined.length / top,
        set: setOf("flow_week", `joined-${w.monday}`, w.joined, v.people, language),
      },
      left: {
        label: t["insights.flow.left"],
        value: w.left.length > 0 ? `−${w.left.length}` : "0",
        share: w.left.length / top,
        set: setOf("flow_week", `left-${w.monday}`, w.left, v.people, language),
      },
    })),
    came: placeRows(flow.cameFrom, v.labels, t),
    went: placeRows(flow.wentTo, v.labels, t),
    tenure: tenureRows(flow, v.people, f),
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
    effort: v.effort ? effortWords(v.effort, v.people, f) : null,
    flow: flowWords(v, f),
  };
}

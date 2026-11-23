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
  type PulseView,
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
  /**
   * The week whose days a tap opens in the chart's place (D158 rule 7 (b)): its Monday, and what the row
   * counts (daily updates, joins and leaves) for the drilldown's bucket.
   */
  drill?: { key: string; count: number };
}

/** One day of this week: the bar and the number under it; "later" days are blank. */
export interface DayBar {
  weekday: string;
  value: string;
  share: number | null;
  later: boolean;
  /** "11/11": the count a share is of, under it, where a week's days must add up (D158 rule 7 (b)). */
  of?: string;
}

/**
 * A day a chart opens to its next level (D158 rule 7): its weekday, the date said in full for screen
 * readers, its day (the address's key) and what it counts, for the drilldown's bucket. A row of 44 px
 * links under a 7-column grid, whose columns are narrower than a tap target at 360 px.
 */
export interface DayPick {
  weekday: string;
  date: string;
  key: string;
  count: number;
}

export const dayPick = (day: string, count: number, { language }: Formats): DayPick => {
  const dates = calendarDates(language);
  return { weekday: dates.weekday(day), date: dates.short(day), key: day, count };
};

/**
 * A pulse week's days that open their who lists: those with a daily update, each counting the members it
 * lists (the coin cap's whole). The card's this week and a week's level both use it.
 */
export const pulsePicks = (days: PulseView["days"], f: Formats): DayPick[] =>
  days.flatMap((d) =>
    d.pulse && d.pulse !== "later" ? [dayPick(d.day, d.pulse.coins?.of ?? 0, f)] : [],
  );

export interface PulseMetricWords {
  label: string;
  latest: string;
  days: DayBar[];
  weeks: BarRow[];
}

export interface InsightsWords {
  /** `picks`: this week's days with a daily update, each opening who reached each measure that day. */
  pulse: { based: string[]; metrics: PulseMetricWords[]; picks: DayPick[] } | null;
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
    weeks: {
      label: string;
      /** Why the week shows "—": none of its days can show a change. */
      note?: string;
      joined: BarRow;
      left: BarRow;
      /** The week's days link: its Monday, its bucket and its words ("Week of Nov 16, day by day ›"). */
      drill: { key: string; count: number; label: string } | null;
    }[];
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

export type Metric = "quests" | "coins" | "tech";
export const PULSE_METRICS: Metric[] = ["quests", "coins", "tech"];

/** A pulse value as a 0–1 length and its words; tech against the highest of the compared values. */
export function pulseValue(
  p: Pulse,
  k: Metric,
  language: string,
): { x: number | null; text: string } {
  if (k === "tech") {
    const m = p.tech;
    return m ? { x: m.value, text: compact(m.value, language) } : { x: null, text: NONE };
  }
  const s = p[k];
  return s ? { x: s.n / s.of, text: percent(s.n / s.of, language) } : { x: null, text: NONE };
}

export const scaled = (x: number | null, k: Metric, top: number) =>
  x === null ? null : k === "tech" ? (top > 0 ? x / top : 0) : x;

export function latestLine(p: Pulse, k: Metric, f: Formats): string {
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
        // An earlier week with a daily update opens its days; this week's are drawn above its rows.
        ...(i < v.weeks.length - 1 && w.reads > 0 && { drill: { key: w.monday, count: w.reads } }),
      })),
    };
  });
  return { based, metrics, picks: pulsePicks(v.days, f) };
}

/** "[TAG] Name", each part when known; "Not known" for id 0. */
function placeLabel(p: Place, labels: Map<number, AllianceLabel>, t: WorkspaceDictionary) {
  if (p.unionId === 0) return t["insights.flow.unknown"];
  const label = labels.get(p.unionId);
  const tag = p.tag ?? label?.tag ?? null;
  const parts = [tag ? `[${tag}]` : null, label?.name ?? null].filter((x) => x !== null);
  return isolate(parts.length > 0 ? parts.join(" ") : String(p.unionId));
}

/** The members in the newest daily update: the whole a flow count is drawn against (D158). */
export const rosterSize = (tenure: NonNullable<InsightsView["flow"]>["tenure"]) =>
  tenure.under.reduce((a, b) => a + b.length, 0) + tenure.over.length + tenure.sinceStart.length;

/** Where newcomers came from or leavers went, each drawn against the members, not the busiest place. */
export function placeRows(
  list: Place[],
  members: number,
  labels: Map<number, AllianceLabel>,
  t: WorkspaceDictionary,
): BarRow[] {
  return list.map((p) => ({
    label: placeLabel(p, labels, t),
    value: String(p.n),
    share: members > 0 ? p.n / members : null,
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
  const members = rosterSize(tenure);
  const row = (label: string, uids: number[], key: string, from: number): BarRow => ({
    label,
    value: String(uids.length),
    share: members > 0 ? uids.length / members : 0,
    set:
      from >= NEWCOMER_DAYS
        ? setOf("tenure", key, uids, people, {
            ...f,
            what: `${t["insights.tenure.head"]} · ${label}`,
          })
        : null,
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

/** A flow week's link to its days: its Monday, its joins and leaves, "Week of Nov 16, day by day ›". */
const daysLink = (monday: string, count: number, { t, language }: Formats) => ({
  key: monday,
  count,
  label: fill(t["drill.byDay"], {
    week: fill(t["insights.pulse.week"], { date: calendarDates(language).dayMonth(monday) }),
  }),
});

/** Newcomers' growth: how many joined in the last NEWCOMER_DAYS, and how many of them grew their might. */
function newcomerLines(nc: NonNullable<InsightsView["flow"]>["newcomers"], f: Formats): string[] {
  const { t, language } = f;
  return !nc || nc.uids.length === 0
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
}

function flowWords(v: InsightsView, f: Formats): InsightsWords["flow"] {
  const flow = v.flow;
  if (!flow) return null;
  const { t, language } = f;
  const dates = calendarDates(language);
  // Each week's joined and left are drawn against the members, so one newcomer is a short bar (D158).
  const members = rosterSize(flow.tenure);
  const of = (n: number) => (members > 0 ? n / members : null);
  const last = flow.weeks.length - 1;
  return {
    based: fill(
      plural(
        flow.reads,
        { one: t["insights.flow.based.one"], other: t["insights.flow.based.other"] },
        language,
      ),
      { n: flow.reads, date: dates.sentence(flow.since) },
    ),
    weeks: flow.weeks.map((w, i) => {
      const label =
        i === last
          ? t["insights.pulse.thisWeek"]
          : fill(t["insights.pulse.week"], { date: dates.dayMonth(w.monday) });
      const moved = w.joined.length + w.left.length;
      // A week none of whose days can show a change (no read, or before the first comparison) is no
      // data: "—" and no bar, never 0 (D75).
      if (!w.days.some((d) => d.moves !== null && d.moves !== "later"))
        return {
          label,
          note: t["insights.flow.noCompare"],
          drill: null,
          joined: { label: t["insights.flow.joined"], value: NONE, share: null, set: null },
          left: { label: t["insights.flow.left"], value: NONE, share: null, set: null },
        };
      return {
        label,
        // A week with a join or a leave opens its days (D158 rule 7 (b)).
        drill: moved > 0 ? daysLink(w.monday, moved, f) : null,
        joined: {
          label: t["insights.flow.joined"],
          value: w.joined.length > 0 ? `+${w.joined.length}` : "0",
          share: of(w.joined.length),
          set: setOf("flow_week", `joined-${w.monday}`, w.joined, v.people, {
            ...f,
            what: `${t["drill.joined"]} · ${label}`,
          }),
        },
        // Leavers are not on Members' list: each name opens the former-member card, with no onward link.
        left: {
          label: t["insights.flow.left"],
          value: w.left.length > 0 ? `−${w.left.length}` : "0",
          share: of(w.left.length),
          set: setOf("flow_week", `left-${w.monday}`, w.left, v.people, {
            ...f,
            what: `${t["drill.left"]} · ${label}`,
            onward: false,
          }),
        },
      };
    }),
    came: placeRows(flow.cameFrom, members, v.labels, t),
    went: placeRows(flow.wentTo, members, v.labels, t),
    tenure: tenureRows(flow, v.people, f),
    newcomers: newcomerLines(flow.newcomers, f),
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

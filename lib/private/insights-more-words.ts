// The words of the Insights page's KvK cost and recovery, squads seen and Raid Shield history sections
// (issue 489), pure: the rows their HTML bars draw (D68: label and number in HTML beside every bar) and the
// lines that say what each rests on. The only names are the help list and the per-member list, both in
// name order (D75); the Raid Shield history is counts only.
import { fill, plural } from "../words";
import { addDays } from "./calendar-time";
import { calendarDates } from "./calendar-words";
import type { WorkspaceKey } from "./dictionary";
import { NONE } from "./fact-text";
import { compact, percent, type Formats } from "./insights-format";
import type { KvkEvent, KvkView } from "./insights-kvk";
import { SHIELD_WEEKS, type PassShare, type ShieldWeek } from "./insights-shield";
import { FRESH_HOURS, SQUAD_COUNTS, type SquadsCoverage } from "./insights-squads";
import type { BarRow } from "./insights-words";

export interface KvkEventWords {
  label: string;
  /** One line for an older event's fold: "KvK Sat, Nov 7 · lost 13% · 50% back". */
  line: string;
  based: string[];
  might: BarRow[];
  /** The share of the loss back on each read from the day after; empty when nothing was lost. */
  days: BarRow[];
}

export interface KvkWords {
  /** The card's top lines: a KvK waiting for the daily read, then the newest event's summary or why none shows. */
  based: string[];
  events: KvkEventWords[];
  /** The newest event's members in name order, each with their loss and how far back. */
  people: { uid: number; name: string; line: string }[];
  help: { uid: number; name: string }[];
}

export interface SquadsWords {
  based: string;
  headline: string;
  counts: BarRow[];
  fresh: BarRow[];
  power: BarRow[];
}

export interface ShieldWords {
  headline: string;
  /** Each week, the newest first: no rows when neither check has a reading (D75: never 0 %). */
  weeks: { label: string; rows: BarRow[] }[];
}

const lossOf = (e: KvkEvent) => (e.before > 0 ? (e.before - e.after) / e.before : 0);
const backOf = (e: KvkEvent) =>
  e.before > e.after ? (e.now - e.after) / (e.before - e.after) : null;

/** "Counted: 30 members", then who was left out and why. */
function kvkBased(e: KvkEvent, { t, language }: Formats): string[] {
  const notCounted = [
    ...(e.others > 0
      ? [
          fill(
            plural(
              e.others,
              { one: t["insights.kvk.others.one"], other: t["insights.kvk.others.other"] },
              language,
            ),
            { n: e.others },
          ),
        ]
      : []),
    ...(e.left > 0
      ? [
          fill(
            plural(
              e.left,
              { one: t["insights.kvk.left.one"], other: t["insights.kvk.left.other"] },
              language,
            ),
            { n: e.left },
          ),
        ]
      : []),
  ];
  return [
    fill(
      plural(
        e.members,
        { one: t["insights.kvk.counted.one"], other: t["insights.kvk.counted.other"] },
        language,
      ),
      { n: e.members },
    ),
    ...(notCounted.length > 0
      ? [fill(t["insights.kvk.notCounted"], { list: notCounted.join(", ") })]
      : []),
  ];
}

function eventWords(e: KvkEvent, newest: string, f: Formats): KvkEventWords {
  const { t, language } = f;
  const dates = calendarDates(language);
  const top = Math.max(e.before, e.after, e.now);
  const row = (label: string, n: number, note?: string): BarRow => ({
    label,
    value: compact(n, language),
    share: top > 0 ? n / top : null,
    ...(note && { note }),
  });
  const lost = lossOf(e);
  const back = backOf(e);
  const date = dates.short(e.day);
  return {
    label: fill(t["insights.kvk.event"], { date }),
    line:
      back === null
        ? fill(t["insights.kvk.eventLineNoLoss"], { date })
        : fill(t["insights.kvk.eventLine"], {
            date,
            lost: percent(lost, language),
            back: percent(back, language),
          }),
    based: kvkBased(e, f),
    might: [
      row(t["insights.kvk.before"], e.before),
      row(
        t["insights.kvk.after"],
        e.after,
        lost > 0 ? fill(t["insights.kvk.lostNote"], { lost: percent(lost, language) }) : undefined,
      ),
      row(
        fill(t[e.nowDay === newest ? "insights.kvk.now" : "insights.kvk.by"], {
          date: dates.dayMonth(e.nowDay),
        }),
        e.now,
        back !== null
          ? fill(t["insights.kvk.backNote"], { back: percent(back, language) })
          : undefined,
      ),
    ],
    days: back === null ? [] : recoveryDays(e.days, f),
  };
}

/**
 * Each day's share of the loss back, drawn against 100 % with a tick there (D158): the scale is the larger of
 * 100 % and the highest day, so 112 % and 120 % draw apart, and a day that lost more stays below 0 (Bar draws
 * a hairline).
 */
function recoveryDays(days: KvkEvent["days"], f: Formats): BarRow[] {
  const dates = calendarDates(f.language);
  const scale = Math.max(1, ...days.map((d) => d.share ?? 0));
  return days.map((d) => ({
    label: dates.weekday(d.day),
    value: d.share === null ? NONE : percent(d.share, f.language),
    share: d.share === null ? null : d.share / scale,
    reference: 1 / scale,
  }));
}

/**
 * The KvK section's words. `time`: the daily read's server time (DAILY_ROSTER_AT). A KvK waiting for that
 * read leads; with no event shown and none waiting, one line says why.
 */
export function kvkWords(kvk: KvkView, newest: string, f: Formats, time: string): KvkWords {
  const { t, language } = f;
  const dates = calendarDates(language);
  const { waiting, readsFrom } = kvk;
  const first = kvk.events[0];
  const back = first ? backOf(first) : null;
  const based: string[] = [];
  if (waiting)
    based.push(
      waiting.today
        ? fill(t["insights.kvk.waitingToday"], { time })
        : fill(t["insights.kvk.waiting"], { date: dates.short(waiting.day), time }),
    );
  if (first) {
    const date = dates.short(first.day);
    based.push(
      back === null
        ? fill(t["insights.kvk.headlineNoLoss"], { date })
        : fill(t["insights.kvk.headline"], {
            date,
            lost: percent(lossOf(first), language),
            back: percent(back, language),
          }),
    );
  } else if (!waiting)
    based.push(
      readsFrom
        ? fill(t["insights.kvk.notInReads"], { date: dates.short(readsFrom), time })
        : t["insights.kvk.none"],
    );
  return {
    based,
    events: kvk.events.map((e) => eventWords(e, newest, f)),
    people: (first?.people ?? []).map((p) => ({
      uid: p.uid,
      name: p.name,
      line: fill(t[p.lost > 0 ? "insights.kvk.person" : "insights.kvk.personNoLoss"], {
        lost: percent(p.lost, language),
        back: percent(p.back, language),
      }),
    })),
    help: first?.help ?? [],
  };
}

/** The squads section's words. */
export function squadsWords(s: SquadsCoverage, f: Formats): SquadsWords {
  const { t, language } = f;
  const seen = s.members - s.none;
  const of = (n: number) => (s.members > 0 ? n / s.members : 0);
  const row = (label: string, n: number, share = of(n)): BarRow => ({
    label,
    value: String(n),
    share,
  });
  const top = Math.max(1, ...s.bands.map((b) => b.median));
  const fresh = s.fresh[0] ?? 0;
  return {
    based: fill(
      plural(
        s.members,
        { one: t["insights.squads.based.one"], other: t["insights.squads.based.other"] },
        language,
      ),
      { n: s.members },
    ),
    headline: fill(
      t[fresh > 0 ? "insights.squads.headline" : "insights.squads.headlineNoneFresh"],
      {
        seen,
        members: s.members,
        fresh,
      },
    ),
    counts: [
      ...SQUAD_COUNTS.map((_, i) =>
        row(t[`insights.squads.count.${i}` as WorkspaceKey], s.counts[i] ?? 0),
      ),
      row(t["insights.squads.none"], s.none),
    ],
    fresh: [
      ...[...FRESH_HOURS, null].map((_, i) =>
        row(t[`insights.squads.fresh.${i}` as WorkspaceKey], s.fresh[i] ?? 0),
      ),
      ...(s.noTime > 0 ? [row(t["insights.squads.noTime"], s.noTime)] : []),
    ],
    power: s.bands.map((b) => ({
      label: fill(t["insights.squads.band"], {
        low: compact(b.low, language),
        high: compact(b.high, language),
      }),
      value: compact(b.median, language),
      share: b.median / top,
      note: fill(t["insights.effort.members"], { n: b.n }),
    })),
  };
}

/**
 * The Raid Shield history's words: the newest week with a reading leads, a missing check is no reading, a
 * morning check still running is "under way" with no share, and a check that read fewer members than it
 * missed is a partial reading.
 */
export function shieldWords(weeks: ShieldWeek[], f: Formats): ShieldWords {
  const { t, language } = f;
  const dates = calendarDates(language);
  const share = (p: PassShare) => percent(p.seen / p.read, language);
  const row = (label: string, p: PassShare | null): BarRow => {
    if (!p) return { label, value: NONE, share: null, note: t["insights.shield.noReading"] };
    const missing = p.roster - p.read;
    return {
      label: !p.running && missing >= p.read ? `${label} · ${t["insights.shield.partial"]}` : label,
      value: p.running ? t["insights.shield.underWay"] : share(p),
      share: p.running ? null : p.seen / p.read,
      note: [
        fill(t["insights.shield.of"], { seen: p.seen, read: p.read }),
        ...(missing > 0 ? [fill(t["insights.shield.notRead"], { n: missing })] : []),
      ].join(" · "),
    };
  };
  // A week is dated by its raid, Saturday 00:00 ST: the morning check is Saturday's (issue 585).
  const raidDay = (friday: string) => dates.short(addDays(friday, 1));
  const last = weeks.find((w) => w.night || w.morning);
  const date = last ? raidDay(last.friday) : "";
  const night = last?.night ? share(last.night) : null;
  let headline = fill(t["insights.shield.none"], { n: SHIELD_WEEKS });
  if (last?.morning?.running)
    headline = night
      ? fill(t["insights.shield.headlineRunning"], { date, night })
      : fill(t["insights.shield.headlineRunningNoNight"], { date });
  else if (last?.morning)
    headline = night
      ? fill(t["insights.shield.headline"], { date, morning: share(last.morning), night })
      : fill(t["insights.shield.headlineMorning"], { date, morning: share(last.morning) });
  else if (night) headline = fill(t["insights.shield.headlineNight"], { date, night });
  return {
    headline,
    weeks: weeks.map((w) => ({
      label: raidDay(w.friday),
      rows:
        w.night || w.morning
          ? [row(t["insights.shield.night"], w.night), row(t["insights.shield.morning"], w.morning)]
          : [],
    })),
  };
}

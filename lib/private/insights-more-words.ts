// The words of the Insights page's KvK cost and recovery and squads seen sections (issue 489), pure: the
// rows their HTML bars draw (D68: label and number in HTML beside every bar) and the lines that say what
// each rests on. The only names are the help list and the per-member list, both in name order (D75).
import { fill } from "../copy";
import { calendarDates } from "./calendar-words";
import type { WorkspaceKey } from "./dictionary";
import { NONE } from "./fact-text";
import { compact, counted, percent, type Formats } from "./insights-format";
import type { KvkEvent } from "./insights-kvk";
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
  headline: string;
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

const lossOf = (e: KvkEvent) => (e.before > 0 ? (e.before - e.after) / e.before : 0);
const backOf = (e: KvkEvent) =>
  e.before > e.after ? (e.now - e.after) / (e.before - e.after) : null;

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
  const notCounted = [
    ...(e.others > 0 ? [counted(t, "insights.kvk.others", e.others, language)] : []),
    ...(e.left > 0 ? [counted(t, "insights.kvk.left", e.left, language)] : []),
  ];
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
    based: [
      counted(t, "insights.kvk.counted", e.members, language),
      ...(notCounted.length > 0
        ? [fill(t["insights.kvk.notCounted"], { list: notCounted.join(", ") })]
        : []),
    ],
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
    days:
      back === null
        ? []
        : e.days.map((d) => ({
            label: dates.weekday(d.day),
            value: d.share === null ? NONE : percent(d.share, language),
            share: d.share === null ? null : Math.max(0, Math.min(1, d.share)),
          })),
  };
}

/** The KvK section's words; null before any KvK with both reads inside the page's reads. */
export function kvkWords(events: KvkEvent[], newest: string, f: Formats): KvkWords | null {
  const first = events[0];
  if (!first) return null;
  const { t, language } = f;
  const back = backOf(first);
  const date = calendarDates(language).short(first.day);
  return {
    headline:
      back === null
        ? fill(t["insights.kvk.headlineNoLoss"], { date })
        : fill(t["insights.kvk.headline"], {
            date,
            lost: percent(lossOf(first), language),
            back: percent(back, language),
          }),
    events: events.map((e) => eventWords(e, newest, f)),
    people: first.people.map((p) => ({
      uid: p.uid,
      name: p.name,
      line: fill(t[p.lost > 0 ? "insights.kvk.person" : "insights.kvk.personNoLoss"], {
        lost: percent(p.lost, language),
        back: percent(p.back, language),
      }),
    })),
    help: first.help,
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
    based: counted(t, "insights.squads.based", s.members, language),
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

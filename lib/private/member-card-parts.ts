// Parts of the member card's words (issue 461, D136), apart from member-card.ts for its size: the last 7
// days' date formats, this week's Alliance Duel, what is still to ask, and every earlier value of a fact.
// Also the line a quiet day gives (D127).
import type { FactRow } from "../repo/member-facts";
import { fill, plural } from "../words";
import { calendarDates } from "./calendar-words";
import type { WorkspaceDictionary } from "./dictionary";
import type { DuelHistory } from "./duel-history";
import { FACT_FIELDS, type FactField, type FactValues, type MemberFacts } from "./fact-fields";
import { factText, NONE } from "./fact-text";
import type { CardFormats } from "./member-card";
import type { DaysFormats } from "./member-days";
import type { MemberRow } from "./members";
import { factsToAsk } from "./members-list";
import type { Formats } from "./members-sheet";

const WEEKDAYS = [
  "day.sun",
  "day.mon",
  "day.tue",
  "day.wed",
  "day.thu",
  "day.fri",
  "day.sat",
] as const;

/** The last 7 days' dates: "Tue, Nov 17" for screen readers, "Tue" and "17" over the bars. */
export const daysFormats = (t: WorkspaceDictionary, f: CardFormats): DaysFormats => ({
  compact: f.compact,
  number: f.number,
  date: (day) => f.date(day),
  weekday: (day) => t[WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? "day.mon"],
  dayOfMonth: (day) => String(Number(day.slice(8))),
  language: f.language,
});

const DUEL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** "12,401,468 · Mon 2.4M · Tue 3.1M": the week's points, then each day saved; "—" when none was. */
export function duelText(m: MemberRow, t: WorkspaceDictionary, f: CardFormats): string {
  const days = DUEL_DAYS.flatMap((d) => {
    const v = m.duel[d];
    return v === undefined
      ? []
      : [fill(t["shots.duel.dayValue"], { day: t[`day.${d}`], v: f.compact(v) })];
  });
  const week = m.duel.week;
  return [week === undefined ? NONE : f.number(week), ...days].join(" · ");
}

/** "Still to ask: time zone, languages" (Members' "Missing info"); null when every fact is recorded. */
export function toAskLine(facts: MemberFacts, t: WorkspaceDictionary): string | null {
  const ask = factsToAsk(facts);
  return ask.length === 0
    ? null
    : fill(t["followup.toAsk"], { list: ask.map((a) => t[`list.ask.${a}`]).join(", ") });
}

const isField = (field: string): field is FactField =>
  (FACT_FIELDS as readonly string[]).includes(field);

/** Every earlier value of each fact, newest first: "Main squad might: 18.1M · Tue, Nov 10". */
export function versionLines(
  history: readonly FactRow[],
  t: WorkspaceDictionary,
  f: CardFormats,
): string[] {
  const text = { language: f.language, now: f.now, day: (iso: string) => f.date(iso), words: t };
  const newest = new Map<string, number>();
  for (const r of history) newest.set(r.field, Math.max(newest.get(r.field) ?? 0, r.version));
  return history
    .filter((r) => r.version < (newest.get(r.field) ?? 0) && isField(r.field))
    .sort((a, b) => b.writtenAt.getTime() - a.writtenAt.getTime())
    .map((r) => {
      const field = r.field as FactField;
      return fill(t["card.history.version"], {
        field: t[`facts.${field}`],
        value: factText(field, r.value as FactValues[typeof field] | null, text),
        date: f.date(r.writtenAt),
      });
    });
}

/**
 * D127: no daily quests or no donations on a read that lists the member is a fact of that day, never
 * missing data: one line, both in one when both.
 */
export function quietDayLine(m: MemberRow, t: WorkspaceDictionary, f: Formats): string[] {
  const day = m.noQuestsOn ?? m.noDonationsOn;
  if (day === null) return [];
  const key =
    m.noQuestsOn && m.noDonationsOn
      ? "members.noQuestsOrDonations"
      : m.noQuestsOn
        ? "members.noQuests"
        : "members.noDonations";
  return [fill(t[key], { day: f.date(day) })];
}

/** The card's Alliance Duel by week (issue 467): one bar row per week, "—" for a week with no data. */
export interface DuelCard {
  head: string;
  /** Oldest first; `value` is null for a week with no saved points (never 0), and then `share` is null too. */
  rows: { label: string; value: string | null; share: number | null; partial: boolean }[];
  /** "Average 4.1M · 3 weeks with points"; null when no week has points for the member. */
  average: string | null;
  /** "Alliance average 310M a week · 4 weeks with data"; null when no week has data. */
  alliance: string | null;
  /** The name of the marker drawn where a value is "—". */
  noData: string;
  /** Why a "○" week has no number: plain information, never a fault (D75). */
  none: string;
  /** Said once instead of the rows when the member has no saved week at all. */
  empty: string;
}

/** The weeks as the desk shows them. Bars are drawn against the alliance's best member-week (D158). */
export function duelCard(h: DuelHistory, t: WorkspaceDictionary, f: CardFormats): DuelCard {
  const line = (key: "average" | "alliance", a: DuelHistory["average"]) =>
    a &&
    fill(
      t[`card.duel.${key}.${plural(a.weeks, { one: "one", other: "other" } as const, f.language)}`],
      { v: f.compact(Math.round(a.value)), n: a.weeks },
    );
  return {
    head: t["card.duel.head"],
    rows: h.weeks.map((w, i) => ({
      // The last week is the one still running: "so far", and in no average.
      label: fill(t[i === h.weeks.length - 1 ? "card.duel.weekSoFar" : "card.duel.week"], {
        date: calendarDates(f.language).dayMonth(w.week),
      }),
      partial: i === h.weeks.length - 1,
      value: w.points === null ? null : f.compact(w.points),
      // D158: drawn against the alliance's best member-week; a real 0 is a hairline, no data draws nothing.
      share: w.points === null ? null : h.best > 0 ? w.points / h.best : 0,
    })),
    average: line("average", h.average),
    alliance: line("alliance", h.alliance),
    noData: t["nodata.mark"],
    none: t["card.duel.none"],
    empty: t["card.duel.empty"],
  };
}

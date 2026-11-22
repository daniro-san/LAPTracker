// Parts of the member card's words (issue 461, D136), apart from member-card.ts for its size: the last 7
// days' date formats, this week's Alliance Duel, what is still to ask, and every earlier value of a fact.
// Also the line a quiet day gives (D127).
import type { FactRow } from "../repo/member-facts";
import { fill } from "../words";
import type { WorkspaceDictionary } from "./dictionary";
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

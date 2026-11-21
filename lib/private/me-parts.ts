// A member's own page (issue 487, D142), pure: their might and kills over 30 days, their recovery since KvK,
// and the lines of where they are needed. People first (D75): only their own numbers, never another
// member's, a rank or an average of others. Their daily quests, coins and donations are not shown: those
// fields leave the database only after requireWorkspace (CLAUDE.md, D71) until the owner rules otherwise.
import { fill } from "../copy";
import type { OwnDay } from "../repo/me";
import { addDays, weekdayIndex } from "./calendar-time";
import type { WorkspaceDictionary } from "./dictionary";
import type { DaysFormats } from "./member-days";
import type { Mark, RollKind } from "./roll-call-rules";
import { callTitle, markWord } from "./roll-call-words";

/** The might and kills chart covers this many days up to the newest read. */
export const PROGRESS_DAYS = 30;

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

// How the calendar lays out a week (issue 300), pure: each entry once per week of its plan, unless that week
// is cancelled, and weeks moved in and out. Outside lib/private so the tick's Raid prep fill (D137) can find
// the week's KvK entry; lib/private/calendar-model.ts re-exports it for the workspace.
import { addDays, mondayOf, weekdayIndex } from "./calendar-time";
import type { calendarEntries, calendarOccurrences } from "./schema";

export type EntryRow = typeof calendarEntries.$inferSelect;
export type OccurrenceRow = typeof calendarOccurrences.$inferSelect;

/** The first Monday an entry runs, and the last (null: weekly with no end). */
export const firstWeek = (e: Pick<EntryRow, "day">) => mondayOf(e.day);
const lastWeekOf = (e: Pick<EntryRow, "day" | "weekly" | "lastWeek">) =>
  e.weekly ? e.lastWeek : (e.lastWeek ?? firstWeek(e));

/** True when the entry's plan puts it in the week that starts on `week`. */
export function inPlan(e: Pick<EntryRow, "day" | "weekly" | "lastWeek">, week: string): boolean {
  const last = lastWeekOf(e);
  return firstWeek(e) <= week && (last === null || week <= last);
}

/** One entry in one week, where it falls: on its plan's day and time, or moved by its week's row. */
export interface Placed {
  entry: EntryRow;
  week: string;
  day: string;
  minute: number | null;
  moved: boolean;
  row: OccurrenceRow | null;
}

/** Each entry-and-week the days from `from` to `to` can hold: by plan, or moved in from another week. */
function candidates(entries: EntryRow[], rows: OccurrenceRow[], from: string, to: string) {
  const pairs = new Set<string>();
  for (let week = mondayOf(from); week <= to; week = addDays(week, 7)) {
    for (const e of entries) if (inPlan(e, week)) pairs.add(`${e.id}:${week}`);
  }
  for (const r of rows) {
    if (r.day !== null && r.day >= from && r.day <= to) pairs.add(`${r.entryId}:${r.week}`);
  }
  return pairs;
}

/** Where one entry falls in one week, or null when that week is not in its plan or is cancelled. */
function place(
  entry: EntryRow | undefined,
  week: string,
  row: OccurrenceRow | null,
): Placed | null {
  if (!entry || !inPlan(entry, week) || row?.cancelled) return null;
  if (row?.day != null) return { entry, week, day: row.day, minute: row.minute, moved: true, row };
  const day = addDays(week, weekdayIndex(entry.day));
  return { entry, week, day, minute: entry.minute, moved: false, row };
}

/**
 * The entries of the days from `from` to `to` (Monday to Sunday of whole weeks): each weekly entry once per
 * week of its plan, unless that week is cancelled; a week moved elsewhere leaves, and a week moved in from
 * another comes in. Sorted by day, then time (the week's theme first), then entry.
 */
export function layOut(
  entries: EntryRow[],
  rows: OccurrenceRow[],
  from: string,
  to: string,
): Placed[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const rowOf = new Map(rows.map((r) => [`${r.entryId}:${r.week}`, r]));
  const placed = [...candidates(entries, rows, from, to)]
    .map((pair) => {
      const [id, week] = pair.split(":") as [string, string];
      return place(byId.get(Number(id)), week, rowOf.get(pair) ?? null);
    })
    .filter((p): p is Placed => p !== null && p.day >= from && p.day <= to);
  return placed.sort(
    (a, b) =>
      a.day.localeCompare(b.day) || (a.minute ?? -1) - (b.minute ?? -1) || a.entry.id - b.entry.id,
  );
}

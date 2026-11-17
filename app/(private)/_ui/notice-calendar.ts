// A notice's calendar link (issue 345, D102), on the notice's page: the entries linked to it, and the
// entries of this week and the next four to link it to, each with its next date in server time (ST). Read
// and worded on the server; the link itself is the calendar entry's `notice` field, changed through the
// Calendar's own write with its version (issue 293).
import type { Db } from "@/lib/db";
import type { WorkspaceAccess } from "@/lib/private/access";
import { calendarDays, noticeEntries } from "@/lib/private/calendar";
import type { EntryRow } from "@/lib/private/calendar-model";
import { addDays, mondayOf } from "@/lib/private/calendar-time";
import { calendarDates, stOf, titleOf } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

/** An entry as the notice page lists it. */
export interface LinkEntry {
  entry: number;
  title: string;
  /** "Mon, Nov 23 · 18:00 ST": its next date in the five weeks, else its first. */
  when: string;
  /** The version of the entry's `notice` field, for the edit. */
  version: number;
  /** Linked to another notice: linking it here moves it. */
  other: boolean;
  href: string;
}

export interface NoticeCalendar {
  linked: LinkEntry[];
  /** Entries of this week and the next four, not linked here. */
  choices: LinkEntry[];
}

/** This week and the next four. */
const WEEKS = 5;

export async function noticeCalendar(
  db: Db,
  access: WorkspaceAccess,
  noticeId: number,
  today: string,
  words: { t: WorkspaceDictionary; language: WorkspaceLanguage },
): Promise<NoticeCalendar> {
  const from = mondayOf(today);
  const [placed, linkedRows] = await Promise.all([
    calendarDays(db, access, from, addDays(from, WEEKS * 7 - 1)),
    noticeEntries(db, access, noticeId),
  ]);
  const dates = calendarDates(words.language);
  // The next date of each entry from today on; the first in the five weeks for the theme of the week.
  const next = new Map<number, { day: string; minute: number | null }>();
  for (const p of placed) {
    if ((p.day >= today || p.entry.kind === "duel") && !next.has(p.entry.id))
      next.set(p.entry.id, p);
  }
  const entryOf = (e: EntryRow): LinkEntry => {
    const at = next.get(e.id) ?? { day: e.day, minute: e.minute };
    const time = at.minute === null ? "" : ` · ${stOf(e.kind, at.minute, words.t)}`;
    return {
      entry: e.id,
      title: titleOf(e, words.t),
      when: `${dates.short(at.day)}${time}`,
      version: e.edits.notice?.v ?? 0,
      other: e.noticeId !== null && e.noticeId !== noticeId,
      href: `/w/${access.slug}/calendar?week=${mondayOf(at.day)}#d-${at.day}`,
    };
  };
  const choices = placed
    .filter((p) => p.entry.noticeId !== noticeId && next.get(p.entry.id) === p)
    .map((p) => entryOf(p.entry));
  return { linked: linkedRows.map(entryOf), choices };
}

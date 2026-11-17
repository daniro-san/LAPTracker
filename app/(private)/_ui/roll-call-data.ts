// The Roll call pages' data in the officer's words, made on the server (issue 298): each occasion of the week
// as a card, each row of a roll call, and each member of an Elixir Scramble team with why they are
// suggested. Dates and numbers are formatted here, never in the browser.
import { fill } from "@/lib/copy";
import { hhmm, zonedInstant } from "@/lib/private/calendar-time";
import { calendarDates, stOf } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { RollWords } from "@/lib/private/dictionary.rollcall";
import type { AwayNote } from "@/lib/private/fact-fields";
import type { Occasion } from "@/lib/private/roll-call";
import { awakeAt, TEAM_MAX, type Mark, type RollKind } from "@/lib/private/roll-call-rules";
import type { CallRow, TeamRow, WeekItem } from "@/lib/private/roll-call-view";
import { callTitle, markWord, restLabel, tallyLine } from "@/lib/private/roll-call-words";

import type { SHEET_KEYS } from "./sheet-words";

export type RollSheetWords = RollWords &
  Pick<WorkspaceDictionary, (typeof SHEET_KEYS)[number] | "status.break">;

/** Only the roll call's own words and the sheet frame's, for client components. */
export const rollWords = (t: WorkspaceDictionary): RollSheetWords =>
  Object.fromEntries(
    Object.entries(t).filter(
      ([k]) => k.startsWith("roll.") || k.startsWith("sheet.") || k === "status.break",
    ),
  ) as RollSheetWords;

/** The address's query for an occasion. */
export const occasionQuery = (o: Occasion) =>
  "id" in o ? `id=${o.id}` : `entry=${o.entry}&week=${o.week}`;

interface Ctx {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  zone: string;
}

export interface RollCard {
  key: string;
  title: string;
  dayLabel: string;
  /** "12:00 ST" and its instant for "your time"; null when the occasion has no time. */
  st: string | null;
  at: number | null;
  day: string;
  /** Null for an Elixir Scramble team nobody is on yet: "Team A: 0/20" says it. */
  counts: string | null;
  /** "Team A: 6/20" for an Elixir Scramble team. */
  team: string | null;
  markHref: string;
  teamHref: string | null;
}

export function rollCard(item: WeekItem, slug: string, { t, language, zone }: Ctx): RollCard {
  const minute = item.placed?.minute ?? null;
  const query = occasionQuery(item.occasion);
  return {
    key: item.key,
    title: callTitle(item, t),
    dayLabel: calendarDates(language).long(item.day),
    st: minute === null ? null : stOf(item.placed?.entry.kind ?? "", minute, t),
    at: minute === null ? null : zonedInstant(item.day, minute, zone),
    day: item.day,
    counts: item.team === 0 ? null : tallyLine(item.tally, item.kind, t),
    team:
      item.team === null
        ? null
        : fill(t["roll.team.short"], { team: item.variant ?? "", n: item.team, max: TEAM_MAX }),
    markHref: `/w/${slug}/roll-call/mark?${query}`,
    teamHref: item.team === null || !item.placed ? null : `/w/${slug}/roll-call/team?${query}`,
  };
}

/** The words of one kind's marks and of its "the rest". */
export interface MarkWords {
  yes: string;
  no: string;
  assumed: string;
  rest: string;
  /** The word "the rest" writes. */
  restWord: string;
}

export const markWords = (kind: RollKind, rest: Mark, t: WorkspaceDictionary): MarkWords => ({
  yes: markWord("yes", kind, t),
  no: markWord("no", kind, t),
  assumed: markWord("assumed", kind, t),
  rest: restLabel(kind, t),
  restWord: markWord(rest, kind, t),
});

export interface MarkRowView {
  uid: number;
  name: string;
  mark: Mark | null;
  version: number;
  /** "until Sat, Nov 21", "On a break", or null when the member is asked. */
  away: string | null;
  note: AwayNote | null;
  noteVersion: number;
}

export function markRows(rows: CallRow[], { t, language }: Omit<Ctx, "zone">): MarkRowView[] {
  const dates = calendarDates(language);
  return rows.map((r) => ({
    uid: r.uid,
    name: r.name,
    mark: r.mark,
    version: r.version,
    away:
      r.away === null
        ? null
        : r.away.until
          ? fill(t["roll.awayUntil"], { date: dates.short(r.away.until) })
          : t["status.break"],
    note: r.note,
    noteVersion: r.noteVersion,
  }));
}

export interface TeamRowView {
  uid: number;
  name: string;
  picked: boolean;
  /** "On Team B" when the other team holds them that week. */
  other: string | null;
  /** "14:00 for them · daytime · Active this week · Main squad 48.2M". */
  why: string;
}

export function teamRows(
  rows: TeamRow[],
  t: WorkspaceDictionary,
  compact: (n: number) => string,
): TeamRowView[] {
  return rows.map((r) => {
    const awake = awakeAt(r.theirMinute);
    const time = r.theirMinute === null ? "" : hhmm(r.theirMinute);
    const clock =
      awake === null
        ? t["roll.team.noZone"]
        : fill(t[awake ? "roll.team.day" : "roll.team.night"], { time });
    const why = [
      clock,
      ...(r.activeThisWeek ? [t["roll.team.active"]] : []),
      ...(r.squad === null ? [] : [fill(t["roll.team.squad"], { v: compact(r.squad) })]),
    ].join(" · ");
    return {
      uid: r.uid,
      name: r.name,
      picked: r.picked,
      other: r.other === null ? null : fill(t["roll.team.inOther"], { team: r.other }),
      why,
    };
  });
}

/** The occasion's day and time line pieces for a page header. */
export function headerOf(
  o: { kind: RollKind; day: string; placed: WeekItem["placed"] },
  { t, language, zone }: Ctx,
) {
  const minute = o.placed?.minute ?? null;
  return {
    dayLabel: calendarDates(language).long(o.day),
    st: minute === null ? null : stOf(o.placed?.entry.kind ?? "", minute, t),
    at: minute === null ? null : zonedInstant(o.day, minute, zone),
  };
}

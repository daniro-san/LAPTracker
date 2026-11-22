// The Roll call pages' data in the officer's words, made on the server (issue 298): each occasion of the week
// as a card, each row of a roll call, and each member of an Elixir Scramble team with why they are
// suggested. Dates and numbers are formatted here, never in the browser.
import { fill } from "@/lib/copy";
import { addDays, hhmm, zonedInstant } from "@/lib/private/calendar-time";
import { calendarDates, stOf } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { RollWords } from "@/lib/private/dictionary.rollcall";
import type { AwayNote } from "@/lib/private/fact-fields";
import { fridayOf } from "@/lib/private/raid-prep";
import type { Occasion } from "@/lib/private/roll-call";
import {
  awakeAt,
  registrationOpen,
  TEAM_MAX,
  type Mark,
  type RollKind,
} from "@/lib/private/roll-call-rules";
import type { CallRow, TeamRow, WeekItem } from "@/lib/private/roll-call-view";
import {
  callTitle,
  markWord,
  restWords,
  tallyParts,
  type TallySet,
} from "@/lib/private/roll-call-words";

import type { GridFilter } from "./roll-call-grid";
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

/** "Registration closes Wednesday (ST)" until Wednesday of its game week, then "Registration closed". */
export const registrationText = (day: string, today: string, t: WorkspaceDictionary) =>
  t[registrationOpen(day, today) ? "roll.reg.open" : "roll.reg.closed"];

export interface RollCard {
  key: string;
  title: string;
  dayLabel: string;
  /** "12:00 ST" and its instant for "your time"; null when the occasion has no time. */
  st: string | null;
  at: number | null;
  day: string;
  /**
   * Each count on its own ("2 of 58 marked", "Shield up 1" …), with the marking page on its chip for those
   * a chip shows; null for a team nobody is on yet.
   */
  counts: RollCount[] | null;
  /** "Team A: 6/20" for an Elixir Scramble team. */
  team: string | null;
  /** An Elixir Scramble team's registration line. */
  registration: string | null;
  markHref: string;
  teamHref: string | null;
}

/** A card's count, and the marking page on the chip that shows exactly those members (null: none does). */
export interface RollCount {
  text: string;
  href: string | null;
}

/** The chip each set is (roll-call-grid.ts `matches`): ✓ holds Shield up and "no problem seen". */
const CHIP: Partial<Record<TallySet, GridFilter>> = {
  yes: "yes",
  assumed: "yes",
  no: "no",
  notSet: "todo",
};

/**
 * Drilldown (2026-11-22): "Not set", ✓ and ✗ open the marking page on their chip ("To mark", ✓, ✗), when
 * above zero; "n of m marked" and "Away" stay text. ✓'s two counts, side by side, are one link, as the ✓
 * chip shows both.
 */
function countsOf(parts: ReturnType<typeof tallyParts>, markHref: string): RollCount[] {
  const out: RollCount[] = [];
  for (const p of parts) {
    const chip = CHIP[p.set];
    const href = chip && p.n > 0 ? `${markHref}&filter=${chip}` : null;
    const last = out.at(-1);
    if (href && last?.href === href) last.text = `${last.text} · ${p.text}`;
    else out.push({ text: p.text, href });
  }
  return out;
}

/** A Raid prep card (a Raid Shield roll call) is dated by its raid, as its page is (issue 585). */
export function rollCard(item: WeekItem, slug: string, today: string, ctx: Ctx): RollCard {
  const { t } = ctx;
  const query = occasionQuery(item.occasion);
  const team = item.team === null ? null : teamLine(item, today, t);
  const markHref = `/w/${slug}/roll-call/mark?${query}`;
  return {
    key: item.key,
    title: callTitle(item, t),
    ...(item.kind === "shield"
      ? raidHead(fridayOf(item.day), { ...ctx, today })
      : { ...headerOf(item, ctx), day: item.day }),
    counts: item.team === 0 ? null : countsOf(tallyParts(item.tally, item.kind, t), markHref),
    team: team?.team ?? null,
    registration: team?.registration ?? null,
    markHref,
    teamHref: team && item.placed ? `/w/${slug}/roll-call/team?${query}` : null,
  };
}

/** An Elixir Scramble card's "Team A: 6/20" and its registration line. */
const teamLine = (item: WeekItem, today: string, t: WorkspaceDictionary) => ({
  team: fill(t["roll.team.short"], { team: item.variant ?? "", n: item.team ?? 0, max: TEAM_MAX }),
  registration: registrationText(item.day, today, t),
});

/** The words of one kind's marks and of its "the rest" (templates with {n}; null for plunders). */
export interface MarkWords {
  yes: string;
  no: string;
  assumed: string;
  rest: { button: string; done: string } | null;
}

export const markWords = (kind: RollKind, t: WorkspaceDictionary): MarkWords => ({
  yes: markWord("yes", kind, t),
  no: markWord("no", kind, t),
  assumed: markWord("assumed", kind, t),
  rest: restWords(kind, t),
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

/** Where a team row is listed: the team, then daytime, no time zone, night, and the other team. */

export type TeamGroup = "picked" | "day" | "noZone" | "night" | "other";

export interface TeamRowView {
  uid: number;
  name: string;
  group: TeamGroup;
  /** "On Team B" when the other team holds them that week. */
  other: string | null;
  /** One short line: "12:00 their time · within 08–23 · Active · Squad 48.2M"; under "No time zone recorded"
   * the clock part is left out. */
  why: string;
  /** "Away that day" for a picked member away on the team's day (issue 585), else null. */
  away: string | null;
}

const groupOf = (r: TeamRow): TeamGroup => {
  if (r.picked) return "picked";
  if (r.other !== null) return "other";
  const awake = awakeAt(r.theirMinute);
  return awake === null ? "noZone" : awake ? "day" : "night";
};

export function teamRows(
  rows: TeamRow[],
  t: WorkspaceDictionary,
  compact: (n: number) => string,
): TeamRowView[] {
  return rows.map((r) => {
    const awake = awakeAt(r.theirMinute);
    const time = r.theirMinute === null ? "" : hhmm(r.theirMinute);
    const why = [
      ...(awake === null ? [] : [fill(t[awake ? "roll.team.day" : "roll.team.night"], { time })]),
      ...(r.activeThisWeek ? [t["roll.team.active"]] : []),
      ...(r.squad === null ? [] : [fill(t["roll.team.squad"], { v: compact(r.squad) })]),
    ].join(" · ");
    return {
      uid: r.uid,
      name: r.name,
      group: groupOf(r),
      other: r.other === null ? null : fill(t["roll.team.inOther"], { team: r.other }),
      why,
      away: r.away ? t["roll.team.awayThatDay"] : null,
    };
  });
}

/**
 * Raid prep's day line names the raid it serves, not the day the roll call was added (issue 585, first
 * glance: "Wednesday, November 18" read as an old roll call): that week's KvK Saturday, the one its
 * Raid Shield check reads for, and the reset the raid starts at. A week whose KvK day has gone by says so.
 * `friday` is the roll call's `fridayOf` (lib/raid-prep-fill.ts), as Raid prep's own view reads it.
 */
export function raidHead(friday: string, { t, language, zone, today }: Ctx & { today: string }) {
  const kvk = addDays(friday, 1);
  const date = calendarDates(language).short(kvk);
  if (kvk < today)
    return { dayLabel: fill(t["roll.prep.raid.past"], { date }), st: null, at: null, day: kvk };
  return {
    dayLabel: fill(t["roll.prep.raid"], { date }),
    st: fill(t["calendar.st"], { time: hhmm(0) }),
    at: zonedInstant(kvk, 0, zone),
    day: kvk,
  };
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

// The Calendar tab's words, made on the server (issue 300): each entry of a week as data for the client
// list (title, server time, the instant for the viewer's own clock, tags, the values its edit form starts
// from), the week's days and the month overview. Dates and numbers are formatted here, never in the browser.
import { fill, isolate } from "@/lib/copy";
import { DUEL_DAYS, type Field, type Kind, type Placed } from "@/lib/private/calendar-model";
import { addDays, hhmm, mondayOf, weekdayIndex, zonedInstant } from "@/lib/private/calendar-time";
import { calendarDates, endOf, stOf, titleOf } from "@/lib/private/calendar-words";
import type { Suggestion } from "@/lib/private/caravan-suggest";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { CalendarKey, CalendarWords } from "@/lib/private/dictionary.calendar";

import type { NextItem } from "./home-digest";
import type { SHEET_KEYS } from "./sheet-words";

export interface Member {
  uid: number;
  name: string;
}
export type Seat = Member & { kind: "vip" | "guardian" };

/** What the edit form starts from, and the version of each field the officer is looking at. */
export interface FormValues {
  kind: Kind;
  variant: string | null;
  level: number | null;
  title: string;
  notes: string;
  link: string;
  forMembers: boolean;
  /** The linked notice's id (D102). */
  notice: number | null;
  weekly: boolean;
  /** Where this week's one is (moved or not), and where the plan puts it this week. */
  day: string;
  minute: number | null;
  plannedDay: string;
  plannedMinute: number | null;
  /** "Mon, Nov 23": the week's Monday, for "Only the week of …". */
  weekLabel: string;
  versions: Partial<Record<Field, number>>;
}

export interface AgendaItem {
  key: string;
  entry: number;
  week: string;
  day: string;
  /** "Monday, November 16". */
  dayLabel: string;
  title: string;
  /** "16:00 ST"; null for the week's Alliance Duel theme. */
  st: string | null;
  /** The instant it starts, for "your time" in the browser. */
  at: number | null;
  /** When it is surely over, for "Ended" (`endOf`). */
  end: number;
  roles: string | null;
  notes: string | null;
  link: string | null;
  /** The linked notice (D102), with its title. */
  notice: { id: number; title: string } | null;
  tags: string[];
  coach: Member | null;
  second: Seat | null;
  form: FormValues;
}

export interface CalendarCtx {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  zone: string;
  /** The KvK's End read, "16:15" (SNAPSHOT_AFTER), when a KvK is "Ended" (`endOf`). */
  endRead: string;
  /** The workspace's notices' titles by id, for an entry's linked notice (D102). */
  noticeTitles?: ReadonlyMap<number, string>;
}

/** The calendar's words and the sheet frame's (Close, Cancel, "Discard your changes?"). */
export type CalendarSheetWords = CalendarWords &
  Pick<WorkspaceDictionary, (typeof SHEET_KEYS)[number]>;

/** Only the calendar's own words and the sheet frame's, for client components. */
export const calendarWords = (t: WorkspaceDictionary): CalendarSheetWords =>
  Object.fromEntries(
    Object.entries(t).filter(([k]) => k.startsWith("calendar.") || k.startsWith("sheet.")),
  ) as CalendarSheetWords;

function rolesLine(p: Placed, t: WorkspaceDictionary): string | null {
  if (p.entry.kind !== "caravan") return null;
  const r = p.row;
  if (!r?.coachUid && !r?.secondKind) return null;
  const seat = (role: string, name: string | null | undefined) =>
    name
      ? fill(t["calendar.roles.who"], { role, name: isolate(name) })
      : fill(t["calendar.roles.open"], { role });
  const second = r.secondKind
    ? t[`calendar.role.${r.secondKind}` as CalendarKey]
    : t["calendar.role.second"];
  return `${seat(t["calendar.role.coach"], r.coachName)} · ${seat(second, r.secondName)}`;
}

function tagsOf(p: Placed, plannedDay: string, { t, language }: CalendarCtx): string[] {
  const dates = calendarDates(language);
  const planned = p.entry.minute === null ? "" : ` ${stOf(p.entry.kind, p.entry.minute, t)}`;
  return [
    ...(p.entry.weekly ? [t["calendar.weekly"]] : []),
    ...(p.moved
      ? [fill(t["calendar.moved"], { when: `${dates.short(plannedDay)}${planned}` })]
      : []),
    ...(p.entry.forMembers ? [t["calendar.forMembers"]] : []),
  ];
}

/** The caravan's two seats as picked this week. */
function seatsOf(r: Placed["row"]): { coach: Member | null; second: Seat | null } {
  const coach = r?.coachUid && r.coachName ? { uid: r.coachUid, name: r.coachName } : null;
  const second =
    r?.secondKind && r.secondUid && r.secondName
      ? { kind: r.secondKind as Seat["kind"], uid: r.secondUid, name: r.secondName }
      : null;
  return { coach, second };
}

function formOf(p: Placed, plannedDay: string, language: WorkspaceLanguage): FormValues {
  const e = p.entry;
  const edits = [...Object.entries(e.edits), ...Object.entries(p.row?.edits ?? {})];
  return {
    kind: e.kind as Kind,
    variant: e.variant,
    level: e.level,
    title: e.title ?? "",
    notes: e.notes ?? "",
    link: e.link ?? "",
    forMembers: e.forMembers,
    notice: e.noticeId,
    weekly: e.weekly,
    day: p.day,
    minute: p.minute,
    plannedDay,
    plannedMinute: e.minute,
    weekLabel: calendarDates(language).short(p.week),
    versions: Object.fromEntries(edits.map(([f, x]) => [f, x.v])),
  };
}

/** The linked notice with its title; null when none, or when its title was not read (never an empty link). */
function noticeOf(id: number | null, ctx: CalendarCtx): AgendaItem["notice"] {
  const title = id === null ? undefined : ctx.noticeTitles?.get(id);
  return id !== null && title ? { id, title } : null;
}

export function agendaItem(p: Placed, ctx: CalendarCtx): AgendaItem {
  const { t, language, zone } = ctx;
  const e = p.entry;
  const plannedDay = addDays(p.week, weekdayIndex(e.day));
  const minute = p.minute;
  return {
    key: `${e.id}:${p.week}`,
    entry: e.id,
    week: p.week,
    day: p.day,
    dayLabel: calendarDates(language).long(p.day),
    title: titleOf(e, t),
    st: minute === null ? null : stOf(e.kind, minute, t),
    at: minute === null ? null : zonedInstant(p.day, minute, zone),
    end: endOf(e.kind, p.day, minute, zone, ctx.endRead),
    roles: rolesLine(p, t),
    notes: e.notes,
    link: e.link,
    notice: noticeOf(e.noticeId, ctx),
    tags: tagsOf(p, plannedDay, ctx),
    ...seatsOf(p.row),
    form: formOf(p, plannedDay, language),
  };
}

/** The timed entries for the Home digest (the week's Alliance Duel theme has no time). */
export function nextItems(placed: Placed[], slug: string, ctx: CalendarCtx): NextItem[] {
  return placed.flatMap((p) => {
    if (p.entry.kind === "duel" || p.minute === null) return [];
    const item = agendaItem(p, ctx);
    return [
      {
        key: item.key,
        title: item.title,
        st: item.st as string,
        at: item.at as number,
        end: item.end,
        day: item.day,
        href: `/w/${slug}/calendar?week=${mondayOf(item.day)}#d-${item.day}`,
      },
    ];
  });
}

export interface AgendaDay {
  day: string;
  head: string;
  /** The game's Alliance Duel theme of that weekday, or null (Sunday). */
  duel: string | null;
  today: boolean;
  items: AgendaItem[];
}

/** The seven days of the week from `monday`, with their entries; the Alliance Duel theme apart. */
export function agendaWeek(placed: Placed[], monday: string, today: string, ctx: CalendarCtx) {
  const dates = calendarDates(ctx.language);
  const items = placed.map((p) => agendaItem(p, ctx));
  const days: AgendaDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return {
      day,
      head: dates.long(day),
      duel: DUEL_DAYS[i] ?? null,
      today: day === today,
      items: items.filter((x) => x.day === day && x.form.kind !== "duel"),
    };
  });
  return { days, theme: items.find((x) => x.form.kind === "duel" && x.week === monday) ?? null };
}

/** A month cell's label: what tells entries apart comes first, so a cut keeps the level or team. An entry
 * with no variant leaves it out (it printed "null", and screen readers read the label since issue 585). */
function cellLabel(e: Placed["entry"], t: WorkspaceDictionary): string {
  const lead = e.variant ? `${e.variant} · ` : "";
  if (e.kind === "cheese") return `${lead}Lv.${e.level} Cheese Trap`;
  if (e.kind === "undead") return `Lv.${e.level} Undead Siege`;
  if (e.kind === "elixir") return `${lead}Elixir Scramble`;
  return titleOf(e, t);
}

export interface MonthCell {
  day: string;
  date: number;
  inMonth: boolean;
  today: boolean;
  labels: string[];
  more: number;
  said: string;
  href: string;
}

/** The month that holds `monday`, as six Monday-to-Sunday rows, each day with up to three entries. */
export function monthCells(
  placed: Placed[],
  monday: string,
  today: string,
  slug: string,
  ctx: CalendarCtx,
): { title: string; cells: MonthCell[] } {
  const { t, language } = ctx;
  const first = `${monday.slice(0, 8)}01`;
  const start = mondayOf(first);
  const dates = calendarDates(language);
  const rules = new Intl.PluralRules(language);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start, i);
    const on = placed.filter((p) => p.day === day && p.entry.kind !== "duel");
    const labels = on.map(
      (p) => `${p.minute === null ? "" : `${hhmm(p.minute)} `}${cellLabel(p.entry, t)}`,
    );
    const count = fill(
      t[`calendar.month.count.${rules.select(on.length) === "one" ? "one" : "other"}`],
      { n: on.length },
    );
    return {
      day,
      date: Number(day.slice(8)),
      inMonth: day.slice(0, 7) === monday.slice(0, 7),
      today: day === today,
      labels: labels.slice(0, 3),
      more: Math.max(0, labels.length - 3),
      said: `${dates.long(day)}: ${count}`,
      href: `/w/${slug}/calendar?week=${mondayOf(day)}#d-${day}`,
    };
  });
  const month = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${first}T00:00:00Z`));
  // Only the first letter: "Novembro de 2026", never "Novembro De 2026".
  const title = fill(t["calendar.month.title"], {
    month: month.charAt(0).toLocaleUpperCase(language) + month.slice(1),
  });
  return { title, cells };
}

/** A suggested member for a caravan seat, with its reason in the officer's words. */
export interface SuggestedMember extends Member {
  why: string;
}

/** "Did daily quests this week · last role 12 days ago", or the role part alone (D75: nothing about inactivity). */
export function suggestionWords(
  list: readonly Suggestion[],
  { t, language }: Pick<CalendarCtx, "t" | "language">,
): SuggestedMember[] {
  const rules = new Intl.PluralRules(language);
  return list.map((s) => {
    const role =
      s.lastRoleDays === null
        ? t["calendar.suggest.never"]
        : fill(
            t[`calendar.suggest.last.${rules.select(s.lastRoleDays) === "one" ? "one" : "other"}`],
            {
              n: s.lastRoleDays,
            },
          );
    const why = s.activeThisWeek
      ? `${t["calendar.suggest.active"]} · ${role}`
      : role.charAt(0).toLocaleUpperCase(language) + role.slice(1);
    return { uid: s.uid, name: s.name, why };
  });
}

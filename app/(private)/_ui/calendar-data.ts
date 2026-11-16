// The Calendar tab's words, made on the server (issue 300): each entry of a week as data for the client
// list (title, server time, the instant for the viewer's own clock, tags, the values its edit form starts
// from), the week's days and the month overview. Dates and numbers are formatted here, never in the browser.
import { fill } from "@/lib/copy";
import type { Field, Kind, Placed } from "@/lib/private/calendar-model";
import { addDays, hhmm, mondayOf, weekdayIndex, zonedInstant } from "@/lib/private/calendar-time";
import { calendarDates, stOf, titleOf } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { CalendarKey, CalendarWords } from "@/lib/private/dictionary.calendar";

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
  roles: string | null;
  notes: string | null;
  link: string | null;
  tags: string[];
  coach: Member | null;
  second: Seat | null;
  form: FormValues;
}

export interface CalendarCtx {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  zone: string;
}

/** Only the calendar's own words, for client components. */
export const calendarWords = (t: WorkspaceDictionary): CalendarWords =>
  Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith("calendar."))) as CalendarWords;

function rolesLine(p: Placed, t: WorkspaceDictionary): string | null {
  if (p.entry.kind !== "caravan") return null;
  const r = p.row;
  if (!r?.coachUid && !r?.secondKind) return t["calendar.roles.none"];
  const seat = (role: string, name: string | null | undefined) =>
    name ? fill(t["calendar.roles.who"], { role, name }) : fill(t["calendar.roles.open"], { role });
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
    weekly: e.weekly,
    day: p.day,
    minute: p.minute,
    plannedDay,
    plannedMinute: e.minute,
    weekLabel: calendarDates(language).short(p.week),
    versions: Object.fromEntries(edits.map(([f, x]) => [f, x.v])),
  };
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
    roles: rolesLine(p, t),
    notes: e.notes,
    link: e.link,
    tags: tagsOf(p, plannedDay, ctx),
    ...seatsOf(p.row),
    form: formOf(p, plannedDay, language),
  };
}

export interface AgendaDay {
  day: string;
  head: string;
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
      today: day === today,
      items: items.filter((x) => x.day === day && x.form.kind !== "duel"),
    };
  });
  return { days, theme: items.find((x) => x.form.kind === "duel" && x.week === monday) ?? null };
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
      (p) => `${p.minute === null ? "" : `${hhmm(p.minute)} `}${titleOf(p.entry, t)}`,
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
  const title = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${first}T00:00:00Z`));
  return { title, cells };
}

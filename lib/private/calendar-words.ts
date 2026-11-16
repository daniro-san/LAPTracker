// The calendar's words, made on the server in the officer's language (issue 300): an entry's title, a
// server day and time, and the sentence a refused edit (409) shows. Dates never end a sentence, so PT and
// FR never print "nov..". Numbers and dates stay out of client components (no Node/Chrome Intl drift).
import { fill } from "../copy";
import type { Conflict } from "./calendar";
import type { EntryRow } from "./calendar-model";
import { ELIXIR_MINUTES } from "./calendar-model";
import { hhmm, weekDays } from "./calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import type { CalendarKey } from "./dictionary.calendar";

/** How the calendar writes a server day ("Mon, Nov 16") and a long one for a day's heading. */
export function calendarDates(language: WorkspaceLanguage) {
  const short = new Intl.DateTimeFormat(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const long = new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const weekday = new Intl.DateTimeFormat(language, { weekday: "short", timeZone: "UTC" });
  const dayMonth = new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const at = (day: string) => new Date(`${day}T00:00:00Z`);
  return {
    short: (day: string) => short.format(at(day)),
    long: (day: string) => long.format(at(day)),
    weekday: (day: string) => weekday.format(at(day)),
    /** "Nov 16", kept on one line (no-break spaces). */
    dayMonth: (day: string) => dayMonth.format(at(day)).replace(/ /g, "\u00a0"),
  };
}

/** The entry's name as the game writes it: "Cheese Trap I · Lv.7", "Elixir Scramble · Team A". */
export function titleOf(
  e: Pick<EntryRow, "kind" | "variant" | "level" | "title">,
  t: WorkspaceDictionary,
): string {
  switch (e.kind) {
    case "cheese":
      return fill(t["calendar.title.cheese"], { n: e.variant ?? "", level: e.level ?? "" });
    case "undead":
      return fill(t["calendar.title.undead"], { level: e.level ?? "" });
    case "elixir":
      return fill(t["calendar.title.elixir"], { team: e.variant ?? "" });
    case "other":
      return e.title ?? "";
    case "duel":
      return fill(t["calendar.theme"], { theme: e.title ?? "" });
    default:
      return t[`calendar.kind.${e.kind}` as CalendarKey];
  }
}

/** "16:00 ST", or the Elixir Scramble window "18:00–18:30 ST". */
export function stOf(kind: string, minute: number, t: WorkspaceDictionary): string {
  return kind === "elixir"
    ? fill(t["calendar.stRange"], { from: hhmm(minute), to: hhmm(minute + ELIXIR_MINUTES) })
    : fill(t["calendar.st"], { time: hhmm(minute) });
}

const UNITS = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
] as const;

/** "12 seconds ago", "há 3 minutos", "il y a 2 heures". */
export function agoText(at: string | null, now: Date, language: WorkspaceLanguage): string {
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - Date.parse(at ?? now.toISOString())) / 1000),
  );
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const unit = UNITS.find(([, size]) => seconds >= size);
  return unit
    ? rtf.format(-Math.floor(seconds / unit[1]), unit[0])
    : rtf.format(-seconds, "second");
}

const EMPTY: Partial<Record<Conflict["field"], CalendarKey>> = {
  when: "calendar.value.planned",
  coach: "calendar.value.nobody",
  second: "calendar.value.nobody",
};

/** An object value (a day and time, or a picked member) in words. */
function objectText(
  field: Conflict["field"],
  v: Record<string, unknown>,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): string {
  const dates = calendarDates(language);
  const st = () => fill(t["calendar.st"], { time: hhmm(Number(v.minute)) });
  if (field === "slot")
    return `${dates.weekday(weekDays("2026-11-16")[Number(v.weekday)] ?? "")} ${st()}`;
  if (field === "when") return `${dates.short(String(v.day))} ${st()}`;
  const role = field === "coach" ? "coach" : v.kind === "vip" ? "vip" : "guardian";
  return fill(t["calendar.roles.who"], {
    role: t[`calendar.role.${role}`],
    name: String(v.name ?? ""),
  });
}

/** A field's newer value in words, for the 409 sentence. */
function valueText(c: Conflict, t: WorkspaceDictionary, language: WorkspaceLanguage): string {
  const v = c.value as Record<string, unknown> | string | number | boolean | null;
  if (v === null || v === "") return t[EMPTY[c.field] ?? "calendar.value.empty"];
  if (typeof v === "boolean") return t[v ? "calendar.value.on" : "calendar.value.off"];
  if (typeof v === "object") return objectText(c.field, v, t, language);
  return c.field === "level" ? `Lv.${v}` : String(v).slice(0, 80);
}

/** "Ana changed the level to “Lv.8” 12 seconds ago." */
export function conflictSaid(
  c: Conflict,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  now: Date,
): string {
  return fill(t["calendar.conflict.line"], {
    name: c.by ?? t["calendar.conflict.someone"],
    field: t[`calendar.field.${c.field}`],
    value: valueText(c, t, language),
    ago: agoText(c.at, now, language),
  });
}

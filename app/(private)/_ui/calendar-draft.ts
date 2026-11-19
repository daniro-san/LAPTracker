// The add and edit form's draft (issue 300): what an officer is typing, what is wrong with it, and what is
// sent: a new entry, or only the fields that changed, each with the version the officer saw. The server
// checks it all again (lib/private/calendar-model.ts); this is for words next to the field.
import { ELIXIR_WINDOWS, LEVEL_MAX, type Kind } from "@/lib/private/calendar-kinds";
import { hhmm, parseTime, weekdayIndex } from "@/lib/private/calendar-time";
import { mightIn } from "@/lib/private/onboarding-parse";

import type { FormValues } from "./calendar-data";

export interface Draft {
  kind: Kind;
  variant: string;
  level: string;
  /** Undead Siege: the enemy might as typed, in millions ("11.5"), D121. */
  enemyMight: string;
  title: string;
  notes: string;
  link: string;
  forMembers: boolean;
  /** The linked notice's id, "" for none (D102). */
  notice: string;
  weekly: boolean;
  day: string;
  time: string;
  /** For a weekly entry's day and time: only this week, or every week. */
  scope: "one" | "all";
}

const VARIANT: Partial<Record<Kind, string>> = { cheese: "I", elixir: "A" };
const HAS_LEVEL: readonly Kind[] = ["cheese", "undead"];
const HAS_TITLE: readonly Kind[] = ["other", "duel"];

export function draftOf(form: FormValues | null, day: string): Draft {
  if (!form) {
    return {
      kind: "caravan",
      variant: "",
      level: "",
      enemyMight: "",
      title: "",
      notes: "",
      link: "",
      forMembers: false,
      notice: "",
      weekly: false,
      day,
      time: "",
      scope: "one",
    };
  }
  return {
    ...form,
    variant: form.variant ?? "",
    level: form.level === null ? "" : String(form.level),
    enemyMight: form.enemyMight === null ? "" : String(form.enemyMight / 1e6),
    notice: form.notice === null ? "" : String(form.notice),
    time: form.minute === null ? "" : hhmm(form.minute),
    scope: "one",
  };
}

/** A new kind starts from its own defaults: Cheese Trap I, Team A at 18:00. */
export function withKind(d: Draft, kind: Kind): Draft {
  const time = kind === "elixir" ? hhmm(ELIXIR_WINDOWS[1]) : d.kind === "elixir" ? "" : d.time;
  return {
    ...d,
    kind,
    variant: VARIANT[kind] ?? "",
    time,
    weekly: kind === "duel" ? false : d.weekly,
  };
}

const isLink = (s: string) => /^https?:\/\/\S+$/i.test(s) && URL.canParse(s);

/** The enemy might typed, in full; null when the field is empty or cannot be read. */
const enemyMightOf = (d: Draft) => (d.enemyMight.trim() === "" ? null : mightIn(d.enemyMight));
const mightBad = (d: Draft) =>
  d.kind === "undead" && d.enemyMight.trim() !== "" && !enemyMightOf(d);

/** What keeps the draft from being saved, per field. */
export function problems(d: Draft): {
  time?: true;
  title?: true;
  level?: true;
  link?: true;
  enemyMight?: true;
} {
  const level = Number(d.level);
  return {
    ...(mightBad(d) && { enemyMight: true }),
    ...(d.kind !== "duel" && parseTime(d.time) === null && { time: true }),
    ...(HAS_TITLE.includes(d.kind) && d.title.trim() === "" && { title: true }),
    ...(HAS_LEVEL.includes(d.kind) &&
      !(Number.isInteger(level) && level >= 1 && level <= LEVEL_MAX) && { level: true }),
    ...(d.link.trim() !== "" && !isLink(d.link.trim()) && { link: true }),
  };
}

const text = (s: string) => s.trim() || null;

/** The body of "create". */
export function newEntryOf(d: Draft): Record<string, unknown> {
  const base = {
    kind: d.kind,
    day: d.day,
    notes: text(d.notes),
    link: text(d.link),
    forMembers: d.forMembers,
    notice: d.notice ? Number(d.notice) : null,
  };
  if (d.kind === "duel") return { ...base, title: d.title.trim() };
  return {
    ...base,
    minute: parseTime(d.time),
    weekly: d.weekly,
    ...(VARIANT[d.kind] && { variant: d.variant }),
    ...(HAS_LEVEL.includes(d.kind) && { level: Number(d.level) }),
    ...(d.kind === "undead" && { enemyMight: enemyMightOf(d) }),
    ...(d.kind === "other" && { title: d.title.trim() }),
  };
}

export interface Change {
  field: string;
  value: unknown;
  version: number;
}

/** [field, new value, value it started from] for the fields this kind has besides its day and time. */
function plainFields(d: Draft, f: FormValues): [string, unknown, unknown][] {
  return [
    ...(VARIANT[f.kind]
      ? [["variant", d.variant, f.variant ?? ""] as [string, unknown, unknown]]
      : []),
    ...(HAS_LEVEL.includes(f.kind)
      ? [["level", Number(d.level), f.level] as [string, unknown, unknown]]
      : []),
    ...(f.kind === "undead"
      ? [["enemyMight", enemyMightOf(d), f.enemyMight] as [string, unknown, unknown]]
      : []),
    ...(HAS_TITLE.includes(f.kind)
      ? [["title", d.title.trim(), f.title] as [string, unknown, unknown]]
      : []),
    ["notes", text(d.notes), text(f.notes)],
    ["link", text(d.link), text(f.link)],
    ["forMembers", d.forMembers, f.forMembers],
    ["notice", d.notice ? Number(d.notice) : null, f.notice],
  ];
}

/** A changed day or time: this week's move, or with "every week" the plan's (and this week back on it). */
function timeFields(d: Draft, f: FormValues): [string, unknown][] {
  const minute = parseTime(d.time);
  if (f.kind === "duel" || (d.day === f.day && minute === f.minute)) return [];
  if (!f.weekly || d.scope === "one") return [["when", { day: d.day, minute }]];
  const moved = f.day !== f.plannedDay || f.minute !== f.plannedMinute;
  return [
    ["slot", { weekday: weekdayIndex(d.day), minute }],
    ...(moved ? [["when", null] as [string, unknown]] : []),
  ];
}

/** The changed fields of an edit, each with the version the officer started from. */
export function changesOf(d: Draft, f: FormValues): Change[] {
  const changed = [...plainFields(d, f).filter(([, now, was]) => now !== was), ...timeFields(d, f)];
  return changed.map(([field, value]) => ({
    field,
    value,
    version: f.versions[field as keyof FormValues["versions"]] ?? 0,
  }));
}

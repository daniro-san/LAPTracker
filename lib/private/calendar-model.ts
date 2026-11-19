// The calendar's model (issue 300), pure: the kinds of entry the alliance plans (owner, 2026-11-16: the
// game's Event tab list is not seeded), what a new entry and an edit may carry, and how a week is laid out
// from the entries and their per-week rows. Validation here is the system boundary for officers' input.
import { z } from "zod";

import type { calendarEntries, calendarOccurrences } from "../schema";
import { ELIXIR_WINDOWS, LEVEL_MAX } from "./calendar-kinds";
import { addDays, isDay, mondayOf, weekdayIndex } from "./calendar-time";

export {
  DUEL_DAYS,
  ELIXIR_MINUTES,
  ELIXIR_WINDOWS,
  KINDS,
  LEVEL_MAX,
  type Kind,
} from "./calendar-kinds";
export const TITLE_MAX = 80;
export const NOTES_MAX = 1000;

export type EntryRow = typeof calendarEntries.$inferSelect;
export type OccurrenceRow = typeof calendarOccurrences.$inferSelect;

const day = z.string().refine(isDay);
const minute = z.number().int().min(0).max(1439);
const elixirMinute = minute.refine((m) => (ELIXIR_WINDOWS as readonly number[]).includes(m));
const level = z.number().int().min(1).max(LEVEL_MAX);
const title = z.string().trim().min(1).max(TITLE_MAX);
const notes = z.string().trim().max(NOTES_MAX).nullable();
/** Only a web address: an officer's link is rendered as a link, so no other scheme gets in. */
const link = z
  .string()
  .trim()
  .max(500)
  .refine((s) => /^https?:\/\/[^\s]+$/i.test(s) && URL.canParse(s))
  .nullable();
const uid = z.number().int().positive();
/** The notice that goes with the entry (D102); the workspace's own, checked on write. */
const notice = z.number().int().positive().nullable();
/** An Undead Siege's enemy might (D121): the game's number in full, 11.5M as 11500000; null for none. */
const enemyMight = z.number().int().positive().max(1e11).nullable();

const shared = {
  day,
  notes: notes.default(null),
  link: link.default(null),
  forMembers: z.boolean().default(false),
  notice: notice.default(null),
};
const timed = { ...shared, minute, weekly: z.boolean().default(false) };

/** A new entry, by kind. The Alliance Duel theme belongs to a week: no time, no repeat. */
export const newEntry = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("caravan"), ...timed }).strict(),
  z.object({ kind: z.literal("cheese"), variant: z.enum(["I", "II"]), level, ...timed }).strict(),
  z
    .object({ kind: z.literal("undead"), level, enemyMight: enemyMight.default(null), ...timed })
    .strict(),
  z
    .object({
      kind: z.literal("elixir"),
      variant: z.enum(["A", "B"]),
      ...timed,
      minute: elixirMinute,
    })
    .strict(),
  z.object({ kind: z.literal("kvk"), ...timed }).strict(),
  z.object({ kind: z.literal("duel"), title, ...shared }).strict(),
  z.object({ kind: z.literal("other"), title, ...timed }).strict(),
]);
export type NewEntry = z.infer<typeof newEntry>;

const version = z.number().int().min(0);
const change = <F extends string, V extends z.ZodType>(field: F, value: V) =>
  z.object({ field: z.literal(field), value, version }).strict();

/**
 * One field of an edit, with the version the officer was looking at. `slot` is a weekly entry's day of
 * the week (0 = Monday) and time for every week; `when` moves one week (null: back to the plan). The
 * caravan's `second` seat is one kind and one member, so a VIP and a Guardian can never both be set.
 */
export const fieldChange = z.discriminatedUnion("field", [
  change("slot", z.object({ weekday: z.number().int().min(0).max(6), minute }).strict()),
  change("level", level),
  change("enemyMight", enemyMight),
  change("variant", z.enum(["I", "II", "A", "B"])),
  change("title", title),
  change("notes", notes),
  change("link", link),
  change("forMembers", z.boolean()),
  change("notice", notice),
  change("when", z.object({ day, minute }).strict().nullable()),
  change("coach", z.object({ uid }).strict().nullable()),
  change(
    "second",
    z
      .object({ kind: z.enum(["vip", "guardian"]), uid })
      .strict()
      .nullable(),
  ),
]);
export type FieldChange = z.infer<typeof fieldChange>;
export type Field = FieldChange["field"];

/** Fields that live on one week's row; the rest live on the entry, for every week. */
export const WEEK_FIELDS: readonly Field[] = ["when", "coach", "second"];

const VARIANTS: Partial<Record<string, readonly string[]>> = {
  cheese: ["I", "II"],
  elixir: ["A", "B"],
};
const timeFits = (kind: string, minute: number) =>
  kind !== "elixir" || (ELIXIR_WINDOWS as readonly number[]).includes(minute);
type Fits = (e: Pick<EntryRow, "kind" | "weekly">, value: never) => boolean;
const FITS: Record<Field, Fits> = {
  slot: (e, v: { minute: number }) => e.weekly && timeFits(e.kind, v.minute),
  when: (e, v: { minute: number } | null) =>
    e.kind !== "duel" && (v === null || timeFits(e.kind, v.minute)),
  level: (e) => e.kind === "cheese" || e.kind === "undead",
  enemyMight: (e) => e.kind === "undead",
  variant: (e, v: string) => (VARIANTS[e.kind] ?? []).includes(v),
  title: (e) => e.kind === "other" || e.kind === "duel",
  coach: (e) => e.kind === "caravan",
  second: (e) => e.kind === "caravan",
  notes: () => true,
  link: () => true,
  forMembers: () => true,
  notice: () => true,
};

/** True when the change belongs to this kind of entry: a level only for Cheese Trap and Undead Siege, an
 * Elixir Scramble time only in one of its windows, picks only for the Alliance Caravan, and so on. */
export const fits = (entry: Pick<EntryRow, "kind" | "weekly">, c: FieldChange) =>
  FITS[c.field](entry, c.value as never);

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

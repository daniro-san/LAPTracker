// The calendar's model (issue 300), pure: the kinds of entry the alliance plans (owner, 2026-11-16: the
// game's Event tab list is not seeded), what a new entry and an edit may carry, and how a week is laid out
// from the entries and their per-week rows. Validation here is the system boundary for officers' input.
import { z } from "zod";

import type { EntryRow } from "../calendar-layout";
import { ELIXIR_WINDOWS, LEVEL_MAX } from "./calendar-kinds";
import { isDay } from "./calendar-time";

// The week's layout is pure and shared with the tick's Raid prep fill (D137): lib/calendar-layout.ts.
export {
  firstWeek,
  inPlan,
  layOut,
  type EntryRow,
  type OccurrenceRow,
  type Placed,
} from "../calendar-layout";
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
  z.object({ kind: z.literal("undead"), level, ...timed }).strict(),
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

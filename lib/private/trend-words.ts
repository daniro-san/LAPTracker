// The member card's trend words (D109; weekly baseline D114), made on the server in the officer's language:
// the muted line under main squad and AD Tech ("+600K this week", "+400K since Nov 10", "Complete") and
// "Updated Nov 17". Split from member-card.ts for its size.
import { fill } from "../copy";
import type { WorkspaceDictionary } from "./dictionary";
import { AD_COMPLETE } from "./fact-fields";
import type { TrendField, Version } from "./fact-trend";
import type { CardFormats } from "./member-card";

/** Each trend field's version before the newest, from the history (D109). */
export type Previous = Partial<Record<TrendField, Version | null>>;
/**
 * Each trend field's value saved before its newest version's game week began (`cardBase`, D114): the card
 * then says "+600K this week", or on a Monday "+600K last week", the same comparison as the thanks.
 */
export type WeekBase = Partial<Record<TrendField, { base: Version; last: boolean } | null>>;

/** What a trend field's newest value is compared with: the version before, and the week's baseline. */
export interface Compared {
  before: Version | null | undefined;
  week: { base: Version; last: boolean } | null | undefined;
}

/** Which words the change takes: against a week's start, or since the version before. */
type Since = "Since" | "ThisWeek" | "LastWeek";
const sinceOf = (week: Compared["week"]): Since =>
  !week ? "Since" : week.last ? "LastWeek" : "ThisWeek";
const SQUAD_KEY = {
  Since: "facts.since",
  ThisWeek: "facts.thisWeek",
  LastWeek: "facts.lastWeek",
} as const;

/**
 * A short date with no weekday, in server time, that never wraps: "Nov 10", "10 nov." (D109). The day
 * and month are joined with a no-break space.
 */
export function shortDate(at: Date, f: Pick<CardFormats, "language" | "zone">): string {
  const parts = new Intl.DateTimeFormat(f.language, {
    day: "numeric",
    month: "short",
    timeZone: f.zone,
  }).formatToParts(at);
  const of = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const [day, month] = [of("day"), of("month")];
  return f.language === "en" ? `${month}\u00a0${day}` : `${day}\u00a0${month}`;
}

/** AD Tech's change in points: "+5 points this week", "+1 point since Nov 10". */
function pointsText(
  change: number,
  date: string,
  since: Since,
  t: WorkspaceDictionary,
  f: CardFormats,
): string {
  const points = Math.abs(change);
  const form = new Intl.PluralRules(f.language).select(points) === "one" ? "one" : "other";
  const n = new Intl.NumberFormat(f.language, { maximumFractionDigits: 1 }).format(points);
  return fill(t[`facts.points${since}.${form}`], { change: `${change > 0 ? "+" : "−"}${n}`, date });
}

/**
 * The muted line under main squad or AD Tech: "+600K this week" (on a Monday, "+600K last week") against
 * the value before the newest version's game week (D114), else "+400K since Nov 10", "+5 points since Nov 10"
 * against the version before; "Complete" for AD Tech at 100 %. Nothing when there is no earlier value or
 * it is the same (D75: no data, no claim).
 */
function changeOf(
  field: TrendField,
  now: number,
  compared: Compared,
  t: WorkspaceDictionary,
  f: CardFormats,
): string | undefined {
  const week = compared.week ?? null;
  const before = week?.base ?? compared.before ?? null;
  const was = before?.value ?? now;
  if (!before || was === now) return undefined;
  const date = shortDate(before.at, f);
  const since = sinceOf(week);
  if (field === "adTech") return pointsText(now - was, date, since, t, f);
  const change = `${now > was ? "+" : "−"}${f.compact(Math.abs(now - was))}`;
  return fill(t[SQUAD_KEY[since]], { change, date });
}

/** Main squad's or AD Tech's change line and "Updated …" (D109). */
export function trendOf(
  field: TrendField,
  value: number,
  savedAt: string | undefined,
  compared: Compared,
  t: WorkspaceDictionary,
  f: CardFormats,
): { change?: string; updated?: string } {
  const complete = field === "adTech" && value === AD_COMPLETE;
  const change = complete ? t["facts.adComplete"] : changeOf(field, value, compared, t, f);
  return {
    ...(change && { change }),
    ...(savedAt && {
      updated: fill(t["facts.updated"], { date: shortDate(new Date(savedAt), f) }),
    }),
  };
}

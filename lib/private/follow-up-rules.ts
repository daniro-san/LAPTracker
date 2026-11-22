// The Follow-up tab's rules (issue 340, D104), pure: who is on the week's list, what takes them off it, and
// a follow-up as one line of the member card's history. The list reuses the Members rules as they are
// (D75, D98): the reasons are the Members tab's (offline proxy, might unchanged per D70, the held KvK
// reason), shown under Check in or under Needs help (`needsAWord`), and the facts still to ask are
// Members' "Missing info" (`factsToAsk`). No donation reason, no ranking: the list is by name. D140 adds
// one tip of Follow-up's own: Alliance Help coins below 1,000 on most days with data (`coinsTip`).
import { fill, isolate } from "../copy";
import { mondayOf, zonedInstant } from "./calendar-time";
import type { WorkspaceDictionary } from "./dictionary";
import { COINS_MAX, type DayCell } from "./member-days";
import type { MemberRow } from "./members";
import { factsToAsk, needsAWord, whoOf, type AskFact } from "./members-list";

/** What an officer can record about a member on the list. */
export const FOLLOW_UP_ACTIONS = ["talked", "break", "help", "fine"] as const;
export type FollowUpAction = (typeof FOLLOW_UP_ACTIONS)[number];

export interface WorkItem {
  member: MemberRow;
  /** A reason to look, as the Members tab shows it (under Check in, or under Needs help). */
  checkIn: boolean;
  /** An officer's Needs help mark stands, not paused by a break (#585 S2): on the list by itself. */
  help: boolean;
  /** A new member's facts not recorded yet (Members' "Missing info"). */
  toAsk: AskFact[];
  /** Alliance Help coins below 1,000 on most days (D140): a tip to share, never a fault. */
  tip: boolean;
}

/** D140 (owner, issue 460): the tip shows when coins were below 1,000 on at least 5 days with data. */
export const COINS_TIP_DAYS = 5;

/**
 * The coins tip from a member's last 7 days of Alliance Help coins (`lastDays`): at least COINS_TIP_DAYS
 * days below 1,000. "none" (a read that lists the member with no coins, D127) is below 1,000; a day with
 * no read is not counted at all, so missing data never brings the tip (D75).
 */
export const coinsTip = (cells: readonly DayCell[]) =>
  cells.filter((c) => c === "none" || (typeof c === "number" && c < COINS_MAX)).length >=
  COINS_TIP_DAYS;

/**
 * The members to look at this week, minus those an officer followed up this week (`resolved`), by name:
 * - an officer's Needs help mark, while it stands and no break runs (#585 S2): back every Monday until an
 *   officer clears it, whatever the reasons;
 * - a reason to look while not on a break: Check in, or Needs help (an officer's Needs help keeps the
 *   reasons, D80);
 * - new with a fact still missing (a member on a break is not asked, D75);
 * - in `tips` (the coins tip, D140), not on a break.
 */
export function worklist(
  members: readonly MemberRow[],
  resolved: ReadonlySet<number>,
  tips: ReadonlySet<number> = new Set(),
): WorkItem[] {
  return members
    .flatMap((member) => {
      if (resolved.has(member.uid)) return [];
      const who = whoOf(member);
      const checkIn = member.reasons.length > 0 && needsAWord(who);
      const toAsk = who.includes("new") && !who.includes("break") ? factsToAsk(member.facts) : [];
      const tip = tips.has(member.uid) && !who.includes("break");
      const help = who.includes("help") && !who.includes("break");
      return help || checkIn || toAsk.length > 0 || tip
        ? [{ member, checkIn, help, toAsk, tip }]
        : [];
    })
    .sort((a, b) => a.member.name.localeCompare(b.member.name));
}

/**
 * When the game week that holds server day `today` began: Monday 00:00 server time (`zone`, SERVER_TZ).
 * Anything recorded since resolves the member for the week.
 */
export const weekStart = (today: string, zone: string) =>
  new Date(zonedInstant(mondayOf(today), 0, zone));

/**
 * One member's records that still count, oldest first (`rows` oldest first): Undo appends "withdrawn",
 * which cancels the newest record still counting before it, so the log stays append-only.
 */
export function liveRecords<T extends { action: string }>(rows: readonly T[]): T[] {
  const live: T[] = [];
  for (const row of rows) {
    if (row.action === "withdrawn") live.pop();
    else live.push(row);
  }
  return live;
}

/** The members with a record still counting among `rows` (oldest first, any members). */
export function resolvedBy(rows: readonly { uid: number; action: string }[]): Set<number> {
  const byUid = new Map<number, { action: string }[]>();
  for (const row of rows) byUid.set(row.uid, [...(byUid.get(row.uid) ?? []), row]);
  return new Set([...byUid].filter(([, own]) => liveRecords(own).length > 0).map(([uid]) => uid));
}

/**
 * "Noted this week" (#585): for each member with a record still counting among `rows` (the week's, oldest
 * first), that member's newest one, newest first. The same records that take a member off the list
 * (`resolvedBy`), so a member is either to look at, noted, or neither.
 */
export function notedThisWeek<T extends { uid: number; action: string; at: Date }>(
  rows: readonly T[],
): T[] {
  const byUid = new Map<number, T[]>();
  for (const row of rows) byUid.set(row.uid, [...(byUid.get(row.uid) ?? []), row]);
  return [...byUid.values()]
    .flatMap((own) => liveRecords(own).slice(-1))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * Last week's context for a member back on the list (#585 S2): per member, the newest record still counting
 * among `rows` (oldest first, from last Monday) that was written before `monday`. `liveRecords` runs over the
 * whole window first, so a withdrawn this week cancels the record it undid, even across Monday.
 */
export function lastWeekOf<T extends { uid: number; action: string; at: Date }>(
  rows: readonly T[],
  monday: Date,
): Map<number, T> {
  const byUid = new Map<number, T[]>();
  for (const row of rows) byUid.set(row.uid, [...(byUid.get(row.uid) ?? []), row]);
  const last = new Map<number, T>();
  for (const [uid, own] of byUid) {
    const newest = liveRecords(own)
      .filter((r) => r.at < monday)
      .at(-1);
    if (newest) last.set(uid, newest);
  }
  return last;
}

/** Since when a Needs help mark stands, who added it and their note (#585 S2). */
export interface HelpMark {
  at: Date;
  by: string | null;
  note: string | null;
}

/**
 * The standing Needs help mark from a member's `status` versions (oldest first) and Follow-up records
 * (oldest first, withdrawn ones included). The mark is the trailing run of `help` versions: the newest
 * record still counting that wrote a version in that run gives who, when and the note (an Undo that puts
 * an earlier `help` back writes a new version with no record of its own); else the run's first version,
 * with no note (a mark set in Edit info). Null when the newest status is not Needs help.
 */
export function helpMark(
  versions: readonly { version: number; value: unknown; at: Date; by: string | null }[],
  records: readonly {
    action: string;
    factVersion: number | null;
    note: string | null;
    at: Date;
    by: string | null;
  }[],
): HelpMark | null {
  let first = versions.length;
  while (first > 0 && versions[first - 1]?.value === "help") first--;
  const start = versions[first];
  if (!start) return null;
  const record = liveRecords(records)
    .filter((r) => r.action === "help" && r.factVersion !== null && r.factVersion >= start.version)
    .at(-1);
  return record
    ? { at: record.at, by: record.by, note: record.note }
    : { at: start.at, by: start.by, note: null };
}

/**
 * Follow-up's two numbers in one line for Home and Members (#585): "Follow-up: 12 to look at · 4 noted
 * this week"; null when both are 0 (the pages then say everyone looks fine).
 */
export function weekCountLine(
  counts: { toLook: number; noted: number },
  t: WorkspaceDictionary,
  language: string,
): string | null {
  if (counts.toLook === 0 && counts.noted === 0) return null;
  const head =
    counts.toLook === 0
      ? t["followup.week.nobody"]
      : fill(t["followup.week.toLook"], { n: counts.toLook });
  if (counts.noted === 0) return head;
  const form = new Intl.PluralRules(language).select(counts.noted) === "one" ? "one" : "other";
  return `${head} · ${fill(t[`followup.week.noted.${form}`], { n: counts.noted })}`;
}

export interface HistoryRow {
  action: FollowUpAction;
  note: string | null;
  until: string | null;
  at: Date;
  by: string | null;
}

/**
 * A "Noted this week" row's line (#585), the officer and the day first: "Tomas · Thu, Nov 19: Talked to
 * them", "Lucien · Thu, Nov 19: On a break until Wed, Nov 25" (the last day away, so it does not read as
 * the list's "back on Monday"); "Thu, Nov 19: All fine" when the officer is not known. The note is not in it.
 */
export function notedLine(
  row: HistoryRow,
  t: WorkspaceDictionary,
  date: (at: Date) => string,
  day: (iso: string) => string,
): string {
  const what =
    row.action === "break" && row.until
      ? fill(t["followup.noted.break"], { date: day(row.until) })
      : t[`followup.action.${row.action}`];
  const at = date(row.at);
  return row.by
    ? fill(t["followup.noted.by"], { who: isolate(row.by), date: at, what })
    : fill(t["followup.noted.at"], { date: at, what });
}

/** An officer's note in quotes, on a line of its own, so it reads apart from the computed reasons. */
const quoted = (note: string | null, t: WorkspaceDictionary) =>
  note ? [fill(t["followup.quote"], { note })] : [];

/**
 * A standing Needs help mark (#585 S2): "Since Thu, Nov 19 · added by Tomas" ("Since Thu, Nov 19" when the
 * officer is not known), then their note in quotes. The same lines on Follow-up's row and the card.
 */
export function markLines(
  mark: HelpMark,
  t: WorkspaceDictionary,
  date: (at: Date) => string,
): string[] {
  const head = mark.by
    ? fill(t["followup.mark.by"], { date: date(mark.at), who: isolate(mark.by) })
    : fill(t["followup.mark.at"], { date: date(mark.at) });
  return [head, ...quoted(mark.note, t)];
}

/** Last week's record as context (#585 S2): "Last week: Tomas · Thu, Nov 12: Talked to them", its note. */
export function lastWeekLines(
  row: HistoryRow,
  t: WorkspaceDictionary,
  date: (at: Date) => string,
  day: (iso: string) => string,
): string[] {
  return [fill(t["followup.last"], { line: notedLine(row, t, date, day) }), ...quoted(row.note, t)];
}

/**
 * "Talked 16 Nov: back after exams · Ana", "On a break 16 Nov – 20 Nov · Ana". `date` gives a write's
 * date, `day` a server day, both in the officer's language.
 */
export function historyLine(
  row: HistoryRow,
  t: WorkspaceDictionary,
  date: (at: Date) => string,
  day: (iso: string) => string,
): string {
  const head = fill(t[`followup.line.${row.action}`], {
    date: date(row.at),
    until: row.until ? day(row.until) : "—",
  });
  return [row.note ? `${head}: ${row.note}` : head, ...(row.by ? [isolate(row.by)] : [])].join(
    " · ",
  );
}

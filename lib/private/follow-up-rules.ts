// The Follow-up tab's rules (issue 340, D104), pure: who is on the week's list, what takes them off it, and
// a follow-up as one line of the member card's history. The list reuses the Members rules as they are
// (D75, D98): the reasons are the Members tab's (offline proxy, might unchanged per D70, the held KvK
// reason), shown under Check in or under Needs help (`needsAWord`), and the facts still to ask are
// Members' "Missing info" (`factsToAsk`). No donation reason, no ranking: the list is by name.
import { fill, isolate } from "../copy";
import { mondayOf, zonedInstant } from "./calendar-time";
import type { WorkspaceDictionary } from "./dictionary";
import type { MemberRow } from "./members";
import { factsToAsk, needsAWord, whoOf, type AskFact } from "./members-list";

/** What an officer can record about a member on the list. */
export const FOLLOW_UP_ACTIONS = ["talked", "break", "help", "fine"] as const;
export type FollowUpAction = (typeof FOLLOW_UP_ACTIONS)[number];

export interface WorkItem {
  member: MemberRow;
  /** A reason to look, as the Members tab shows it (under Check in, or under Needs help). */
  checkIn: boolean;
  /** A new member's facts not recorded yet (Members' "Missing info"). */
  toAsk: AskFact[];
}

/**
 * The members to look at this week, minus those an officer followed up this week (`resolved`), by name:
 * - a reason to look while not on a break: Check in, or Needs help whose signal still holds (an officer's
 *   Needs help keeps the reasons, D80, so the member comes back each week while the signal holds);
 * - new with a fact still missing (a member on a break is not asked, D75).
 */
export function worklist(members: readonly MemberRow[], resolved: ReadonlySet<number>): WorkItem[] {
  return members
    .flatMap((member) => {
      if (resolved.has(member.uid)) return [];
      const who = whoOf(member);
      const checkIn = member.reasons.length > 0 && needsAWord(who);
      const toAsk = who.includes("new") && !who.includes("break") ? factsToAsk(member.facts) : [];
      return checkIn || toAsk.length > 0 ? [{ member, checkIn, toAsk }] : [];
    })
    .sort((a, b) => a.member.name.localeCompare(b.member.name));
}

/**
 * When the game week that holds server day `today` began: Monday 00:00 server time (`zone`, SERVER_TZ).
 * Anything recorded since resolves the member for the week.
 */
export const weekStart = (today: string, zone: string) =>
  new Date(zonedInstant(mondayOf(today), 0, zone));

export interface HistoryRow {
  action: FollowUpAction;
  note: string | null;
  until: string | null;
  at: Date;
  by: string | null;
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

// The Follow-up tab's rules (issue 340, D104), pure: who is on the week's list, what takes them off it, and
// a follow-up as one line of the member card's history. The list reuses the Members rules as they are
// (D75, D98): "Check in" is `whoOf`'s, so its reasons are the Members tab's (offline proxy, might unchanged
// per D70, the held KvK reason), and the onboarding facts still to ask are `factsToAsk`'s. No donation
// reason, no ranking: the list is by name.
import { fill, isolate } from "../copy";
import { mondayOf } from "./calendar-time";
import type { WorkspaceDictionary } from "./dictionary";
import type { MemberRow } from "./members";
import { factsToAsk, whoOf, type AskFact } from "./members-list";

/** What an officer can record about a member on the list. */
export const FOLLOW_UP_ACTIONS = ["talked", "break", "help", "fine"] as const;
export type FollowUpAction = (typeof FOLLOW_UP_ACTIONS)[number];

/** The onboarding facts a new member is asked for (issue 340): main squad might, AD Tech %, time zone. */
export const ONBOARDING_FACTS: readonly AskFact[] = ["squadMight", "adTech", "timeZone"];

export interface WorkItem {
  member: MemberRow;
  /** A "Check in" reason, as the Members tab shows it. */
  checkIn: boolean;
  /** A new member's onboarding facts not recorded yet. */
  toAsk: AskFact[];
}

/**
 * The members to look at this week: Check in, or new with an onboarding fact still missing (a member on a
 * break is not asked, D75), minus those an officer followed up this week (`resolved`). By name.
 */
export function worklist(members: readonly MemberRow[], resolved: ReadonlySet<number>): WorkItem[] {
  return members
    .flatMap((member) => {
      if (resolved.has(member.uid)) return [];
      const who = whoOf(member);
      const checkIn = who.includes("checkin");
      const toAsk =
        who.includes("new") && !who.includes("break")
          ? factsToAsk(member.facts).filter((f) => ONBOARDING_FACTS.includes(f))
          : [];
      return checkIn || toAsk.length > 0 ? [{ member, checkIn, toAsk }] : [];
    })
    .sort((a, b) => a.member.name.localeCompare(b.member.name));
}

/**
 * The members an officer followed up in the game week (Monday to Sunday, server days) that holds
 * `today`: anything recorded resolves the item for the week. `dayOf` gives a write's server day.
 */
export function resolvedIn(
  rows: readonly { uid: number; at: Date }[],
  today: string,
  dayOf: (at: Date) => string,
): Set<number> {
  const monday = mondayOf(today);
  return new Set(rows.filter((r) => mondayOf(dayOf(r.at)) === monday).map((r) => r.uid));
}

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

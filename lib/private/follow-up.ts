// The Follow-up tab (issue 340, D104): the week's list of members to look at, the thefts still open, and
// what officers record about a member. A record is append-only (member_follow_ups) with the officer and
// the time; On a break and Needs help also go through the member facts (D80) with the version the officer
// saw, so another officer's newer value is refused (409) and never overwritten. Anything recorded takes
// the member off this week's list; a member also leaves it by themselves once the signal clears. Undo
// appends "withdrawn", which cancels the newest record and puts its fact back when nobody changed it
// since. Members of the workspace's own alliance only (D71). Nothing here is logged: notes are what
// officers typed. D140: each item also carries the coins tip and the language its ready message is in.
import type { Db } from "../db";
import { factVersion } from "../repo/member-facts";
import {
  factWriter,
  followedUpSince,
  followUpRequested,
  helpMarkRows,
  insertMemberFollowUp,
  listMemberFollowUps,
  notedSince,
  type MemberFollowUp,
  type WeekRecord,
} from "../repo/member-follow-ups";
import { gameLanguages } from "../repo/player-reads";
import type { RosterRead } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import { dayIn } from "./calendar-time";
import type { WorkspaceLanguage } from "./dictionary";
import type { FactSource } from "./fact-fields";
import { featureOn } from "./features";
import { kvkEvents, kvkHelp, recordsSince } from "./follow-up-kvk";
import {
  coinsTip,
  helpMark,
  kvkOpen,
  lastWeekOf,
  notedThisWeek,
  liveRecords,
  resolvedBy,
  sinceMonday,
  weekStart,
  worklist,
  type FollowUpAction,
  type HelpMark,
  type WorkItem,
} from "./follow-up-rules";
import type { AfterKvk } from "./insights-kvk";
import { lastDays } from "./member-days";
import { isMember, saveFacts, type FactChange } from "./member-facts";
import { DAY_MS, gameWeek } from "./member-week";
import { membersView, type MemberRow, type MembersView } from "./members";
import { messageLanguage } from "./ready-message";
import type { AttackerGroup } from "./theft-groups";
import { theftsView } from "./thefts";

export interface FollowUpView {
  /** Before the alliance's first end-of-day read: nothing is computed, so nobody has a reason (D80). */
  early: boolean;
  /** The game week that holds today, Monday to Sunday (server days). */
  week: string[];
  items: FollowUpItem[];
  /** The members noted this week (#585): each one's newest record still counting, newest first. */
  noted: NotedItem[];
  /** The KvK whose heavy hits are offered help (#585 S5): its server day; null outside its week. */
  kvkDay: string | null;
  /** The time zones the members have, most used first, for the facts editor's picker. */
  zones: string[];
  /** Attackers in the thefts log whose follow-up is Open or Open again (D97). */
  thefts: AttackerGroup[];
}

/** How far back a member's game language is read: the squads read runs every day (D132). */
export const LANGUAGE_DAYS = 14;

/**
 * A member on the list and the language of their ready message (null when no language is known), their
 * standing Needs help mark (#585 S2) and last week's newest record as context, unless it is the record
 * the mark already names.
 */
export type FollowUpItem = WorkItem & {
  language: WorkspaceLanguage | null;
  mark: HelpMark | null;
  lastWeek: WeekRecord | null;
};

/** A member noted this week and the record that took them off the list. */
export interface NotedItem {
  member: MemberRow;
  record: WeekRecord;
}

type Counted = { uid: number; action: string; at: Date };

/**
 * The members with the coins tip (D140) in the last 7 server days of `reads`, less those still settling in
 * (first seen under OFFLINE_GRACE_DAYS ago, D127). The window is 7 calendar days: a day with no read
 * stays in it and counts as no data, never as a day below 1,000.
 */
export function tipsOf(members: readonly MemberRow[], reads: readonly RosterRead[]): Set<number> {
  return new Set(
    members
      .filter((m) => !m.settling && coinsTip(lastDays(reads, m.uid)?.rows.coins ?? []))
      .map((m) => m.uid),
  );
}

/**
 * The week's list and who was noted, from the members view, the records from the earlier of Monday and the
 * KvK's End read (oldest first), and the KvK: one rule for Follow-up, Home and Members (#585). This week's
 * records make the list and Noted; the KvK's help list leaves out anyone written about since its End read
 * (`kvkOpen`). The coins tip reads the rosters the view already has.
 */
function weekLists<T extends Counted>(
  view: MembersView,
  rows: readonly T[],
  monday: Date,
  kvk: AfterKvk | null,
) {
  const week = rows.filter((r) => r.at >= monday);
  const open = kvk ? kvkOpen(kvk.help, rows, monday, kvk.afterAt) : new Set<number>();
  const items = worklist(view.members, resolvedBy(week), tipsOf(view.members, view.reads), open);
  // Current members only: a member who left, or a former member (D107), is not in the view.
  const byUid = new Map(view.members.map((m) => [m.uid, m]));
  const noted = notedThisWeek(week).flatMap((record) => {
    const member = byUid.get(record.uid);
    return member ? [{ member, record }] : [];
  });
  return { items, noted };
}

/** Follow-up's two numbers: the members to look at this week, and the members noted. */
export type WeekCounts = { toLook: number; noted: number };

/**
 * Follow-up's two numbers for Home and Members (#585), by the same rule, week and members view as the
 * Follow-up page. Null, with nothing read, while the Follow-up tab is off (D126) and before the alliance's
 * first daily update (the pages then say nothing about check-ins). Reads uid, action and time only, from
 * the earlier of Monday and the oldest day of a KvK still offered help, beside that KvK's read (#585 S5).
 */
export async function followUpCounts(
  db: Db,
  access: WorkspaceAccess,
  view: MembersView,
  now: Date,
  zone: string,
): Promise<WeekCounts | null> {
  if (!featureOn(access, "follow_up") || view.early) return null;
  const [rows, events] = await Promise.all([
    followedUpSince(db, access.workspaceId, recordsSince(now, zone)),
    kvkEvents(db, access, now, zone),
  ]);
  const kvk = kvkHelp(events, view, now, zone);
  const { items, noted } = weekLists(view, rows, sinceMonday(now, zone), kvk);
  return { toLook: items.length, noted: noted.length };
}

/** The standing Needs help mark of each of `uids` that has one (#585 S2): Follow-up's rows and the card. */
export async function helpMarksOf(
  db: Db,
  workspaceId: number,
  uids: readonly number[],
): Promise<Map<number, HelpMark>> {
  const { versions, records } = await helpMarkRows(db, workspaceId, uids);
  return new Map(
    uids.flatMap((uid) => {
      const own = <T extends { uid: number }>(rows: T[]) => rows.filter((r) => r.uid === uid);
      const mark = helpMark(own(versions), own(records));
      return mark ? [[uid, mark] as const] : [];
    }),
  );
}

/** Last week's record, unless it is the one that wrote the standing Needs help mark the row names. */
const contextOf = (record: WeekRecord | undefined, mark: HelpMark | null) =>
  !record || (record.action === "help" && mark?.at.getTime() === record.at.getTime())
    ? null
    : record;

/** The week's list as of `now`; `zone` is the server's (SERVER_TZ). */
export async function followUpView(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
  zone: string,
): Promise<FollowUpView> {
  const today = dayIn(zone, now.getTime());
  const monday = sinceMonday(now, zone);
  // From last Monday (#585 S2): this week's records make the list, last week's only its context.
  const lastMonday = weekStart(dayIn(zone, monday.getTime() - DAY_MS), zone);
  const [members, window, thefts, events] = await Promise.all([
    membersView(db, access, now, zone),
    notedSince(db, access.workspaceId, lastMonday),
    theftsView(db, access, { now, zone }),
    kvkEvents(db, access, now, zone),
  ]);
  // Last Monday is before the oldest KvK still offered help, so the window holds every row Home counts.
  const kvk = kvkHelp(events, members, now, zone);
  const { items, noted } = weekLists(members, window, monday, kvk);
  const lastWeek = lastWeekOf(window, monday);
  // Only the members on the list, and only recent reads (#521).
  const since = new Date(now.getTime() - LANGUAGE_DAYS * DAY_MS);
  const uids = items.map((i) => i.member.uid);
  const helped = items.filter((i) => i.help).map((i) => i.member.uid);
  const [game, marks] = await Promise.all([
    gameLanguages(db, access.unionId, uids, since),
    helpMarksOf(db, access.workspaceId, helped),
  ]);
  return {
    early: members.early,
    week: gameWeek(today),
    // The officers' recorded languages first, then the game's (D137's order).
    items: items.map((i) => {
      const mark = marks.get(i.member.uid) ?? null;
      return {
        ...i,
        language: messageLanguage([
          ...(i.member.facts.languages?.value ?? []),
          game.get(i.member.uid) ?? null,
        ]),
        mark,
        lastWeek: contextOf(lastWeek.get(i.member.uid), mark),
      };
    }),
    noted,
    kvkDay: kvk?.day ?? null,
    zones: members.zones,
    // Every attacker not yet resolved, whatever step they are at (D104, amended 2026-11-19).
    thefts: thefts.groups
      .flatMap((g) => g.attackers)
      .filter((a) => a.followUp.state !== "resolved"),
  };
}

type Live = MemberFollowUp & { action: FollowUpAction };

/** A member's records still counting (undone ones left out), newest first, for their card. */
export async function followUpsOf(db: Db, access: WorkspaceAccess, uid: number): Promise<Live[]> {
  const rows = await listMemberFollowUps(db, access.workspaceId, uid);
  return (liveRecords(rows) as Live[]).reverse();
}

export interface FollowUpInput {
  uid: number;
  action: FollowUpAction;
  note: string;
  /** On a break: the last server day away. */
  until: string | null;
  /** The version of the fact the action writes (away or status) the officer saw; 0 when none. */
  version: number;
  /** Made once per open sheet or tap (D100): a retry stores nothing new. */
  requestId: string;
}

export type FollowUpResult =
  | { ok: true }
  | { ok: false; code: "not_member" | "bad_until" | "not_found" }
  | {
      ok: false;
      code: "stale";
      field: "away" | "status";
      value: unknown;
      version: number;
      source: FactSource;
      /** The officer who saved the newer value; null when not known. */
      by: string | null;
    };

/** The member fact a status action writes: an away note from today to `until`, or Needs help. */
function factOf(
  input: FollowUpInput,
  today: string,
  note: string | null,
): Extract<FactChange, { field: "away" | "status" }> | null {
  const base = { version: input.version, source: "officer" as const };
  if (input.action === "break") {
    return {
      ...base,
      field: "away",
      value: { text: note ?? "", from: today, until: input.until },
    };
  }
  return input.action === "help" ? { ...base, field: "status", value: "help" } : null;
}

const FIELD_OF = { break: "away", help: "status" } as const;

type Stale = Extract<FollowUpResult, { code: "stale" }>;

/** Writes the status fact: the version written, or the newer value another officer saved (with who). */
async function writeFact(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  change: Extract<FactChange, { field: "away" | "status" }>,
  clock: { now: Date; zone: string },
): Promise<{ ok: true; version: number | null } | Stale> {
  const [result] = (await saveFacts(db, access, uid, [change], clock.now, clock.zone)) ?? [];
  if (result?.status !== "conflict") return { ok: true, version: result?.version ?? null };
  const { value, version, source } = result;
  const by = await factWriter(db, access.workspaceId, uid, change.field, version);
  return { ok: false, code: "stale", field: change.field, value, version, source, by };
}

/** Why a record is refused before anything is written: a past last day, or not a current member. */
async function refusal(
  db: Db,
  access: WorkspaceAccess,
  input: FollowUpInput,
  today: string,
): Promise<FollowUpResult | null> {
  if (input.action === "break" && (input.until === null || input.until < today)) {
    return { ok: false, code: "bad_until" };
  }
  // Current members only: saveFacts also takes former (D107) and pending (D106) members, the list never.
  return (await isMember(db, access, input.uid)) ? null : { ok: false, code: "not_member" };
}

export async function recordFollowUp(
  db: Db,
  access: WorkspaceAccess,
  input: FollowUpInput,
  clock: { now: Date; zone: string },
): Promise<FollowUpResult> {
  // INVARIANT follow-up.request-once: a retry after a lost answer finds the first record (D100).
  if (await followUpRequested(db, access.workspaceId, input.requestId)) return { ok: true };
  const today = dayIn(clock.zone, clock.now.getTime());
  const refused = await refusal(db, access, input, today);
  if (refused) return refused;
  const note = input.note.trim() || null;
  const change = factOf(input, today, note);
  const written = change ? await writeFact(db, access, input.uid, change, clock) : null;
  if (written && !written.ok) return written;
  await insertMemberFollowUp(db, {
    workspaceId: access.workspaceId,
    uid: input.uid,
    action: input.action,
    note,
    until: input.action === "break" ? input.until : null,
    factVersion: written?.version ?? null,
    writtenBy: access.user.id,
    writtenAt: clock.now,
    requestId: input.requestId,
  });
  return { ok: true };
}

/**
 * Undo (D104 amendment): when `target` is still the member's newest record counting, appends "withdrawn"
 * so the member is back on the list. A break or Needs help it wrote is put back to the value before, as a
 * new version, unless another officer changed that fact since (then the fact stays as they left it).
 */
export async function undoFollowUp(
  db: Db,
  access: WorkspaceAccess,
  input: { uid: number; target: string; requestId: string },
  clock: { now: Date; zone: string },
): Promise<FollowUpResult> {
  if (await followUpRequested(db, access.workspaceId, input.requestId)) return { ok: true };
  const live = liveRecords(await listMemberFollowUps(db, access.workspaceId, input.uid));
  const last = live.at(-1);
  if (!last || last.requestId !== input.target) return { ok: false, code: "not_found" };
  if (last.factVersion !== null && (last.action === "break" || last.action === "help")) {
    const where = [db, access.workspaceId, input.uid, FIELD_OF[last.action]] as const;
    const newest = await factVersion(...where, "newest");
    if (newest?.version === last.factVersion) {
      const before =
        last.factVersion > 1 ? await factVersion(...where, last.factVersion - 1) : null;
      const back = {
        field: FIELD_OF[last.action],
        version: last.factVersion,
        value: before?.value ?? null,
        source: "officer",
      } as FactChange;
      await saveFacts(db, access, input.uid, [back], clock.now, clock.zone);
    }
  }
  await insertMemberFollowUp(db, {
    workspaceId: access.workspaceId,
    uid: input.uid,
    action: "withdrawn",
    writtenBy: access.user.id,
    writtenAt: clock.now,
    requestId: input.requestId,
  });
  return { ok: true };
}

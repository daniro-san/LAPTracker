// The Follow-up tab (issue 340, D104): the week's list of members to look at, the thefts still open, and
// what officers record about a member. A record is append-only (member_follow_ups) with the officer and
// the time; On a break and Needs help also go through the member facts (D80) with the version the officer
// saw, so another officer's newer value is refused (409) and never overwritten. Anything recorded takes
// the member off this week's list; a member also leaves it by themselves once the signal clears. Members
// of the workspace's own alliance only (D71). Nothing here is logged: notes are what officers typed.
import type { Db } from "../db";
import {
  followUpRequested,
  insertMemberFollowUp,
  listMemberFollowUps,
} from "../repo/member-follow-ups";
import type { WorkspaceAccess } from "./access";
import { dayIn } from "./calendar-time";
import type { FactSource } from "./fact-fields";
import { resolvedIn, worklist, type FollowUpAction, type WorkItem } from "./follow-up-rules";
import { isMember, saveFacts, type FactChange } from "./member-facts";
import { gameWeek } from "./member-week";
import { membersView } from "./members";
import type { AttackerGroup } from "./theft-groups";
import { theftsView } from "./thefts";

export interface FollowUpView {
  /** Before the alliance's first end-of-day read: nothing is computed, so nobody has a reason (D80). */
  early: boolean;
  /** The game week that holds today, Monday to Sunday (server days). */
  week: string[];
  items: WorkItem[];
  /** Attackers in the thefts log whose follow-up is Open or Open again (D97). */
  thefts: AttackerGroup[];
}

/** The week's list as of `now`; `zone` is the server's (SERVER_TZ). */
export async function followUpView(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
  zone: string,
): Promise<FollowUpView> {
  const [members, rows, thefts] = await Promise.all([
    membersView(db, access, now, zone),
    listMemberFollowUps(db, access.workspaceId),
    theftsView(db, access, { now, zone }),
  ]);
  const today = dayIn(zone, now.getTime());
  const resolved = resolvedIn(rows, today, (at) => dayIn(zone, at.getTime()));
  return {
    early: members.early,
    week: gameWeek(today),
    items: worklist(members.members, resolved),
    thefts: thefts.groups.flatMap((g) => g.attackers).filter((a) => a.followUp.state === "open"),
  };
}

/** A member's follow-ups, newest first, for their card. */
export const followUpsOf = (db: Db, access: WorkspaceAccess, uid: number) =>
  listMemberFollowUps(db, access.workspaceId, uid);

export interface FollowUpInput {
  uid: number;
  action: FollowUpAction;
  note: string;
  /** On a break: the last server day away. */
  until: string | null;
  /** The version of the fact the action writes (away or status) the officer saw; 0 when none. */
  version: number;
  /** Made once per open sheet (D100): a retry stores nothing new. */
  requestId: string;
}

export type FollowUpResult =
  | { ok: true }
  | { ok: false; code: "not_member" | "bad_until" }
  | {
      ok: false;
      code: "stale";
      field: "away" | "status";
      value: unknown;
      version: number;
      source: FactSource;
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

export async function recordFollowUp(
  db: Db,
  access: WorkspaceAccess,
  input: FollowUpInput,
  clock: { now: Date; zone: string },
): Promise<FollowUpResult> {
  // INVARIANT follow-up.request-once: a retry after a lost answer finds the first record (D100).
  if (await followUpRequested(db, access.workspaceId, input.requestId)) return { ok: true };
  const today = dayIn(clock.zone, clock.now.getTime());
  if (input.action === "break" && (input.until === null || input.until < today)) {
    return { ok: false, code: "bad_until" };
  }
  // Current members only: saveFacts also takes former (D107) and pending (D106) members, the list never.
  if (!(await isMember(db, access, input.uid))) return { ok: false, code: "not_member" };
  const note = input.note.trim() || null;
  const change = factOf(input, today, note);
  if (change) {
    const [result] =
      (await saveFacts(db, access, input.uid, [change], clock.now, clock.zone)) ?? [];
    if (result?.status === "conflict") {
      const { value, version, source } = result;
      return { ok: false, code: "stale", field: change.field, value, version, source };
    }
  }
  await insertMemberFollowUp(db, {
    workspaceId: access.workspaceId,
    uid: input.uid,
    action: input.action,
    note,
    until: input.action === "break" ? input.until : null,
    writtenBy: access.user.id,
    writtenAt: clock.now,
    requestId: input.requestId,
  });
  return { ok: true };
}

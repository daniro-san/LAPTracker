// The Follow-up tab (issue 340, D104): the week's list of members to look at, the thefts still open, and
// what officers record about a member. A record is append-only (member_follow_ups) with the officer and
// the time; On a break and Needs help also go through the member facts (D80) with the version the officer
// saw, so another officer's newer value is refused (409) and never overwritten. Anything recorded takes
// the member off this week's list; a member also leaves it by themselves once the signal clears. Undo
// appends "withdrawn", which cancels the newest record and puts its fact back when nobody changed it
// since. Members of the workspace's own alliance only (D71). Nothing here is logged: notes are what
// officers typed.
import type { Db } from "../db";
import { factVersion } from "../repo/member-facts";
import {
  factWriter,
  followedUpSince,
  followUpRequested,
  insertMemberFollowUp,
  listMemberFollowUps,
  type MemberFollowUp,
} from "../repo/member-follow-ups";
import type { WorkspaceAccess } from "./access";
import { dayIn } from "./calendar-time";
import type { FactSource } from "./fact-fields";
import {
  liveRecords,
  resolvedBy,
  weekStart,
  worklist,
  type FollowUpAction,
  type WorkItem,
} from "./follow-up-rules";
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
  const today = dayIn(zone, now.getTime());
  const [members, rows, thefts] = await Promise.all([
    membersView(db, access, now, zone),
    followedUpSince(db, access.workspaceId, weekStart(today, zone)),
    theftsView(db, access, { now, zone }),
  ]);
  return {
    early: members.early,
    week: gameWeek(today),
    items: worklist(members.members, resolvedBy(rows)),
    thefts: thefts.groups.flatMap((g) => g.attackers).filter((a) => a.followUp.state === "open"),
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

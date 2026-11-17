// Roll call writes (issue 298, D103), each inside one workspace (D71). An occasion is a Calendar entry's
// week (KvK, Undead Siege, an Elixir Scramble team) or a roll call added by hand; a Calendar one gets its
// row on the first write, so reading a page never writes. A mark names the version the officer saw: when
// another officer marked that member since, it is refused with the newer mark (409), unless both said the
// same. "The rest" fills only members with no mark, and its undo clears only what it wrote and nobody
// changed since. Only members of the workspace's own alliance are marked or picked.
import type { Db } from "../db";
import {
  addToTeam,
  findAdded,
  findCall,
  insertCall,
  insertMarks,
  lockCall,
  newestMark,
  newestMarks,
  otherTeams,
  removeFromTeam,
  teamsOf,
  type MarkRow,
  type RollCallRow,
} from "../repo/roll-call";
import { anyRoster } from "../repo/workspace-any-roster";
import type { WorkspaceAccess } from "./access";
import { calendarDays } from "./calendar";
import type { Placed } from "./calendar-model";
import { addDays, isDay, mondayOf } from "./calendar-time";
import { awayOn } from "./fact-fields";
import { factsOf } from "./member-facts";
import {
  FROM_CALENDAR,
  REST,
  tapMark,
  TEAM_MAX,
  type Mark,
  type RollKind,
} from "./roll-call-rules";

/** A Calendar entry's week (`week` is the plan's Monday), or a roll call by its id. */
export type Occasion = { id: number } | { entry: number; week: string };

export interface Opened {
  call: RollCallRow | null;
  kind: RollKind;
  /** An Elixir Scramble's team. */
  variant: string | null;
  day: string;
  week: string;
  /** The Calendar entry that week; null for a roll call added by hand or whose entry was deleted. */
  placed: Placed | null;
}

async function placedOf(db: Db, access: WorkspaceAccess, entry: number, week: string) {
  const days = await calendarDays(db, access, week, addDays(week, 6));
  return days.find((p) => p.entry.id === entry && p.week === week) ?? null;
}

const fromCall = (call: RollCallRow, placed: Placed | null): Opened => ({
  call,
  kind: call.kind as RollKind,
  variant: call.variant,
  day: placed?.day ?? call.day,
  week: call.week,
  placed,
});

/** The occasion, or null when it is not one of this workspace's. */
export async function openOccasion(
  db: Db,
  access: WorkspaceAccess,
  occasion: Occasion,
): Promise<Opened | null> {
  if ("id" in occasion) {
    const call = await findCall(db, access.workspaceId, occasion);
    if (!call) return null;
    const placed =
      call.entryId === null ? null : await placedOf(db, access, call.entryId, call.week);
    return fromCall(call, placed);
  }
  const { entry, week } = occasion;
  if (!isDay(week) || mondayOf(week) !== week) return null;
  const [placed, call] = await Promise.all([
    placedOf(db, access, entry, week),
    findCall(db, access.workspaceId, { entryId: entry, week }),
  ]);
  const kind = placed && FROM_CALENDAR[placed.entry.kind];
  if (!placed || !kind) return call && fromCall(call, null);
  return { call, kind, variant: placed.entry.variant, day: placed.day, week, placed };
}

/** The roll call's row; a Calendar occasion's is made on its first write. */
async function ensureCall(db: Db, access: WorkspaceAccess, o: Opened): Promise<RollCallRow> {
  if (o.call) return o.call;
  const entryId = o.placed?.entry.id ?? 0;
  await insertCall(db, {
    workspaceId: access.workspaceId,
    kind: o.kind,
    variant: o.variant,
    day: o.day,
    week: o.week,
    entryId,
    createdBy: access.user.id,
  });
  const call = await findCall(db, access.workspaceId, { entryId, week: o.week });
  if (!call) throw new Error("roll_call_lost");
  return call;
}

/** The alliance's newest roster (D71: its own members only), uid, name and rank. */
export async function rosterOf(db: Db, access: WorkspaceAccess) {
  return ((await anyRoster(db, access.unionId))?.members ?? []).map((m) => ({
    uid: m.uid,
    name: m.name,
    rankCode: m.rankCode,
  }));
}

/** Who the roll call asks about: an Elixir Scramble team's members, else the whole roster. */
async function askedUids(db: Db, access: WorkspaceAccess, o: Opened): Promise<Set<number>> {
  if (o.kind !== "elixir") return new Set((await rosterOf(db, access)).map((m) => m.uid));
  return new Set(o.call ? (await teamsOf(db, [o.call.id])).map((m) => m.uid) : []);
}

type Missing = { ok: false; code: "not_found" | "not_member" | "invalid" };
export type MarkResult =
  | { ok: true; version: number }
  | Missing
  | { ok: false; code: "stale"; kind: RollKind; newest: MarkRow | null };

/** One member's mark (✓, ✗ or cleared), based on the version the officer saw. */
export async function markOne(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; uid: number; mark: Mark | null; version: number },
  now: Date,
): Promise<MarkResult> {
  if (!tapMark(input.mark)) return { ok: false, code: "invalid" };
  const o = await openOccasion(db, access, input.occasion);
  if (!o) return { ok: false, code: "not_found" };
  if (!(await askedUids(db, access, o)).has(input.uid)) return { ok: false, code: "not_member" };
  const call = await ensureCall(db, access, o);
  // INVARIANT roll-call.version-once: the unique (roll call, uid, version) lets one of two writes based
  // on the same version in; the other reads the winner and is refused unless it said the same.
  for (;;) {
    const newest = await newestMark(db, call.id, input.uid);
    const at = newest?.version ?? 0;
    if (at !== input.version) {
      return (newest?.mark ?? null) === input.mark
        ? { ok: true, version: at }
        : { ok: false, code: "stale", kind: o.kind, newest };
    }
    const row = { rollCallId: call.id, uid: input.uid, version: at + 1, mark: input.mark };
    const [done] = await insertMarks(db, [{ ...row, writtenBy: access.user.id, writtenAt: now }]);
    if (done) return { ok: true, version: done.version };
  }
}

export type Written = { ok: true; mark: Mark | null; written: { uid: number; version: number }[] };

/**
 * "The rest": every member in `uids` the roll call asks about, not away that day and with no mark, gets the
 * kind's rest mark (REST). A member someone marked meanwhile keeps that mark.
 */
export async function markRest(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; uids: number[] },
  now: Date,
): Promise<Written | Missing> {
  const o = await openOccasion(db, access, input.occasion);
  if (!o) return { ok: false, code: "not_found" };
  const [asked, facts] = await Promise.all([askedUids(db, access, o), factsOf(db, access)]);
  const call = await ensureCall(db, access, o);
  const marks = new Map((await newestMarks(db, [call.id])).map((m) => [m.uid, m]));
  const mark = REST[o.kind];
  const rows = [...new Set(input.uids)]
    .filter((uid) => asked.has(uid) && awayOn(facts.get(uid), o.day) === null)
    .filter((uid) => (marks.get(uid)?.mark ?? null) === null)
    .map((uid) => ({
      rollCallId: call.id,
      uid,
      version: (marks.get(uid)?.version ?? 0) + 1,
      mark,
      writtenBy: access.user.id,
      writtenAt: now,
    }));
  return { ok: true, mark, written: await insertMarks(db, rows) };
}

/** Undo of "the rest": clears each mark still at the version it wrote; a member changed since is kept. */
export async function undoMarks(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; items: { uid: number; version: number }[] },
  now: Date,
): Promise<Written | Missing> {
  const o = await openOccasion(db, access, input.occasion);
  if (!o?.call) return { ok: false, code: "not_found" };
  const callId = o.call.id;
  const marks = new Map((await newestMarks(db, [callId])).map((m) => [m.uid, m.version]));
  const rows = input.items
    .filter((i) => marks.get(i.uid) === i.version)
    .map((i) => ({
      rollCallId: callId,
      uid: i.uid,
      version: i.version + 1,
      mark: null,
      writtenBy: access.user.id,
      writtenAt: now,
    }));
  return { ok: true, mark: null, written: await insertMarks(db, rows) };
}

/** A roll call added by hand (KvK shield, Undead Siege, plunders): one per kind and day. */
export async function addCall(
  db: Db,
  access: WorkspaceAccess,
  input: { kind: RollKind; day: string },
  /** Made once per open add sheet (D100): a retry with it answers the first roll call's id. */
  requestId: string,
): Promise<{ ok: true; id: number }> {
  const ws = access.workspaceId;
  const found =
    (await findCall(db, ws, { requestId })) ?? (await findAdded(db, ws, input.kind, input.day));
  if (found) return { ok: true, id: found.id };
  const id =
    (await insertCall(db, {
      workspaceId: ws,
      kind: input.kind,
      day: input.day,
      week: mondayOf(input.day),
      requestId,
      createdBy: access.user.id,
    })) ?? (await findCall(db, ws, { requestId }))?.id;
  if (id === undefined) throw new Error("roll_call_request_lost");
  return { ok: true, id };
}

export type TeamResult =
  | { ok: true; added: number[]; count: number }
  | { ok: false; code: "not_found" | "not_member" | "full" | "other_team" };

/**
 * Picks members for an Elixir Scramble team, in order, or takes one off (`on` false). A pick stops at
 * TEAM_MAX; a member on the other team that week is refused. One change at a time per team (row lock).
 */
export async function setTeam(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; uids: number[]; on: boolean },
  now: Date,
): Promise<TeamResult> {
  const o = await openOccasion(db, access, input.occasion);
  if (!o?.placed || o.kind !== "elixir") return { ok: false, code: "not_found" };
  const roster = new Map((await rosterOf(db, access)).map((m) => [m.uid, m.name]));
  if (input.on && input.uids.some((uid) => !roster.has(uid))) {
    return { ok: false, code: "not_member" };
  }
  const call = await ensureCall(db, access, o);
  return db.transaction(async (tx) => {
    await lockCall(tx, call.id);
    const team = new Set((await teamsOf(tx, [call.id])).map((m) => m.uid));
    if (!input.on) {
      for (const uid of input.uids) await removeFromTeam(tx, call.id, uid);
      return {
        ok: true,
        added: [],
        count: [...team].filter((u) => !input.uids.includes(u)).length,
      };
    }
    const elsewhere = new Set((await otherTeams(tx, call)).map((m) => m.uid));
    const fresh = input.uids.filter((uid) => !team.has(uid));
    const free = fresh.filter((uid) => !elsewhere.has(uid));
    if (fresh.length > 0 && free.length === 0) return { ok: false, code: "other_team" };
    if (free.length > 0 && team.size >= TEAM_MAX) return { ok: false, code: "full" };
    const added = free.slice(0, TEAM_MAX - team.size);
    await addToTeam(
      tx,
      added.map((uid) => ({
        rollCallId: call.id,
        uid,
        name: roster.get(uid) ?? "",
        addedBy: access.user.id,
        addedAt: now,
      })),
    );
    return { ok: true, added, count: team.size + added.length };
  });
}

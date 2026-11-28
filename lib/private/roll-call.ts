// Roll call writes (issue 298, D103), each inside one workspace (D71). An occasion is a Calendar entry's
// week (KvK, Undead Siege, Cheese Trap, an Elixir Scramble team) or a roll call added by hand; a Calendar one gets its
// row on the first write, so reading a page never writes. A mark names the version the officer saw: when
// another officer marked that member since, it is refused with the newer mark (409), unless both said the
// same. "The rest" fills only members with no mark, and its undo clears only what it wrote and nobody
// changed since. Only members of the workspace's own alliance are marked or picked.
import type { Db } from "../db";
import {
  callsOfWeeks,
  findAdded,
  findCall,
  insertCall,
  insertMarks,
  newestMark,
  newestMarks,
  saveResult,
  teamHas,
  teamsOf,
  type MarkPart,
  type MarkRow,
  type RollCallRow,
} from "../repo/roll-call";
import { placeFree, setCallArchived } from "../repo/roll-call-deletes";
import { softDelete, undoDelete } from "../repo/trash";
import { anyRoster } from "../repo/workspace-any-roster";
import { rollCalls } from "../schema";
import type { WorkspaceAccess } from "./access";
import { calendarDays } from "./calendar";
import type { Placed } from "./calendar-model";
import { addDays, isDay, mondayOf } from "./calendar-time";
import { awayOn } from "./fact-fields";
import { factsOf, isMember } from "./member-facts";
import {
  FROM_CALENDAR,
  isElixirMark,
  REST,
  tapMark,
  type ADDED_KINDS,
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

export async function placedOf(db: Db, access: WorkspaceAccess, entry: number, week: string) {
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
  // Only an Elixir Scramble keeps its team as the variant; a Cheese Trap's I or II stays in its title.
  const variant = kind === "elixir" ? placed.entry.variant : null;
  return { call, kind, variant, day: placed.day, week, placed };
}

/** The roll call's row; a Calendar occasion's is made on its first write. */
export async function ensureCall(db: Db, access: WorkspaceAccess, o: Opened): Promise<RollCallRow> {
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

/** Whether the roll call asks about `uid`: its Elixir Scramble team, or the alliance's roster. */
async function asks(db: Db, o: Opened, inRoster: boolean, uid: number): Promise<boolean> {
  if (o.kind !== "elixir") return inRoster;
  return o.call !== null && (await teamHas(db, o.call.id, uid));
}

/** The occasion a mark goes to, or why it cannot be marked. */
async function openForMark(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; uid: number; mark: Mark | null; score?: number | null | undefined },
  part: MarkPart,
): Promise<{ ok: true; o: Opened } | Missing> {
  if (!tapMark(input.mark)) return { ok: false, code: "invalid" };
  const [o, inRoster] = await Promise.all([
    openOccasion(db, access, input.occasion),
    isMember(db, access, input.uid),
  ]);
  if (!o) return { ok: false, code: "not_found" };
  if (part === "wall" && o.kind !== "shield") return { ok: false, code: "invalid" };
  // Issue 468: Registered, 09:00 only, Sub and Excused, and a score, are an Elixir Scramble's only.
  if ((isElixirMark(input.mark) || input.score != null) && o.kind !== "elixir")
    return { ok: false, code: "invalid" };
  if (input.score != null && input.mark !== "yes") return { ok: false, code: "invalid" };
  if (!(await asks(db, o, inRoster, input.uid))) return { ok: false, code: "not_member" };
  return { ok: true, o };
}

/**
 * One member's mark (✓, ✗ or cleared), based on the version the officer saw. `part` `wall` is Raid prep's
 * second mark, squads off the wall (D137): only on a Raid prep (`shield`) roll call.
 */
export async function markOne(
  db: Db,
  access: WorkspaceAccess,
  input: {
    occasion: Occasion;
    uid: number;
    mark: Mark | null;
    version: number;
    part?: MarkPart | undefined;
    /** An Elixir Scramble Joined mark's optional score (issue 468). */
    score?: number | null | undefined;
  },
  now: Date,
): Promise<MarkResult> {
  const part = input.part ?? "main";
  const opened = await openForMark(db, access, input, part);
  if (!opened.ok) return opened;
  const { o } = opened;
  const call = await ensureCall(db, access, o);
  // INVARIANT roll-call.version-once: the unique (roll call, uid, part, version) lets one of two writes
  // based on the same version in; the other reads the winner and is refused unless it said the same.
  for (;;) {
    const newest = await newestMark(db, call.id, input.uid, part);
    const at = newest?.version ?? 0;
    if (at !== input.version) {
      return (newest?.mark ?? null) === input.mark
        ? { ok: true, version: at }
        : { ok: false, code: "stale", kind: o.kind, newest };
    }
    const row = {
      rollCallId: call.id,
      uid: input.uid,
      part,
      version: at + 1,
      mark: input.mark,
      score: input.score ?? null,
    };
    const [done] = await insertMarks(db, [{ ...row, writtenBy: access.user.id, writtenAt: now }]);
    if (done) return { ok: true, version: done.version };
  }
}

export type Written = { ok: true; mark: Mark | null; written: { uid: number; version: number }[] };

/**
 * "The rest": every member in `uids` the roll call asks about, not away that day and with no mark, gets the
 * kind's rest mark (REST). A member someone marked meanwhile keeps that mark. Plunders have none.
 */
export async function markRest(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; uids: number[] },
  clock: { now: Date; zone: string },
): Promise<Written | Missing> {
  const o = await openOccasion(db, access, input.occasion);
  if (!o) return { ok: false, code: "not_found" };
  const mark = REST[o.kind];
  if (mark === null) return { ok: false, code: "invalid" };
  const [asked, facts] = await Promise.all([askedUids(db, access, o), factsOf(db, access)]);
  const call = await ensureCall(db, access, o);
  const marks = new Map((await newestMarks(db, [call.id])).map((m) => [m.uid, m]));
  const rows = [...new Set(input.uids)]
    .filter((uid) => asked.has(uid) && awayOn(facts.get(uid), o.day, clock.zone) === null)
    .filter((uid) => (marks.get(uid)?.mark ?? null) === null)
    .map((uid) => ({
      rollCallId: call.id,
      uid,
      version: (marks.get(uid)?.version ?? 0) + 1,
      mark,
      writtenBy: access.user.id,
      writtenAt: clock.now,
      // An assumption, not an officer's own mark (issue 468): the follow-up never reads it.
      byRest: true,
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

/**
 * A roll call added by hand (Raid Shield, Undead Siege, Cheese Trap): one per kind and day, held by a unique
 * index on the hand-added rows; an add that loses to another officer's opens theirs.
 */
export async function addCall(
  db: Db,
  access: WorkspaceAccess,
  input: { kind: (typeof ADDED_KINDS)[number]; day: string },
  /** Made once per open add sheet (D100): a retry with it answers the first roll call's id. */
  requestId: string,
): Promise<{ ok: true; id: number }> {
  const ws = access.workspaceId;
  // D137 (2026-11-21): one Raid prep a week, so an add opens the one the tracker's fill already made.
  const sameWeek = async () =>
    input.kind === "shield"
      ? ((await callsOfWeeks(db, ws, [mondayOf(input.day)])).find((c) => c.kind === "shield") ??
        null)
      : null;
  const existing = async () =>
    (await findCall(db, ws, { requestId })) ??
    (await findAdded(db, ws, input.kind, input.day)) ??
    (await sameWeek());
  const found = await existing();
  if (found) return { ok: true, id: found.id };
  const id =
    (await insertCall(db, {
      workspaceId: ws,
      kind: input.kind,
      day: input.day,
      week: mondayOf(input.day),
      requestId,
      createdBy: access.user.id,
    })) ?? (await existing())?.id;
  if (id === undefined) throw new Error("roll_call_request_lost");
  return { ok: true, id };
}

/** How long the server takes back an officer's own delete (D120); the page offers Undo for less. */
export { UNDO_MS } from "../repo/trash";

/**
 * Deletes a roll call of the workspace (D120), or undoes the officer's own delete made under the same
 * request id in the last UNDO_MS, unless a new roll call took its place. "not_found": no such roll call to
 * delete, or nothing of this officer's to undo.
 */
export async function deleteCall(
  db: Db,
  access: WorkspaceAccess,
  input: { id: number; requestId: string; undo?: true | undefined },
  now: Date,
): Promise<"ok" | "not_found"> {
  const c = { workspaceId: access.workspaceId, id: input.id, userId: access.user.id, now };
  const change = { ...c, requestId: input.requestId };
  const done = input.undo
    ? await undoDelete(db, rollCalls, change, placeFree)
    : await softDelete(db, rollCalls, change);
  return done ? "ok" : "not_found";
}

/** Archives (`on`) or unarchives a roll call of the workspace (D120); "not_found" when there is none. */
export async function archiveCall(
  db: Db,
  access: WorkspaceAccess,
  input: { id: number; on: boolean },
  now: Date,
): Promise<"ok" | "not_found"> {
  const c = { workspaceId: access.workspaceId, id: input.id, userId: access.user.id, now };
  return (await setCallArchived(db, { ...c, on: input.on })) ? "ok" : "not_found";
}

/**
 * An Elixir Scramble team's result for its week (issue 468): the opponent and both scores, each optional;
 * Won or Lost is read from the two scores. The newest write replaces the last.
 */
export async function setResult(
  db: Db,
  access: WorkspaceAccess,
  input: {
    occasion: Occasion;
    opponent: string | null;
    ourScore: number | null;
    theirScore: number | null;
  },
  now: Date,
): Promise<{ ok: true } | Missing> {
  const o = await openOccasion(db, access, input.occasion);
  if (o?.kind !== "elixir") return { ok: false, code: "not_found" };
  const call = await ensureCall(db, access, o);
  const { opponent, ourScore, theirScore } = input;
  await saveResult(db, {
    rollCallId: call.id,
    opponent: opponent || null,
    ourScore,
    theirScore,
    writtenBy: access.user.id,
    writtenAt: now,
  });
  return { ok: true };
}

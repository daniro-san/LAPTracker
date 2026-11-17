// New members added by hand before the roster lists them (D106). A pending member's facts are ordinary
// member facts under the uid `-id`, written through `saveFacts`, so there is one facts pipeline. When a
// roster read after the pending member was added lists exactly one member with the same name key (the
// sheet import's comparison form, or a remembered alias) who has no facts yet, the facts move to that
// member with their versions and times, the name is remembered as an alias and the pending member is
// marked matched. No match or several: it stays, "To match" (`toMatch`), and an officer links it by hand
// or deletes it. Delete dismisses it and keeps its facts and points; adding the name again reopens it
// (2026-11-17). A fuzzy match never merges.
import type { Db } from "../db";
import { newestRoster } from "../repo/import";
import { aliasesOf, saveAliases } from "../repo/member-facts";
import {
  claimPending,
  dismissedPendings,
  dismissPending,
  findPending,
  insertPending,
  moveDuelPoints,
  moveFacts,
  openPendings,
  reopenDismissed,
  uidsWithFacts,
} from "../repo/pending-members";
import { anyRoster } from "../repo/workspace-any-roster";
import { nameKey } from "../screenshot/name-key";
import type { WorkspaceAccess } from "./access";
import { SaveRefused } from "./import-kinds";
import { isMember, saveFacts, type ChangeResult, type FactChange } from "./member-facts";

/** A pending member's uid in member_facts: game uids are positive. */
export const pendingUid = (id: number) => -id;

export interface Pending {
  uid: number;
  name: string;
  createdAt: Date;
}

/** The workspace's open pending members, oldest first. */
export async function pendingMembers(db: Db, access: WorkspaceAccess): Promise<Pending[]> {
  return (await openPendings(db, access.workspaceId)).map((p) => ({
    uid: pendingUid(p.id),
    name: p.name,
    createdAt: p.createdAt,
  }));
}

/** The open pending members a roster read at `rosterAt` came after, still with no single match. */
export const toMatch = (pending: readonly Pending[], rosterAt: Date | null): Pending[] =>
  rosterAt === null ? [] : pending.filter((p) => p.createdAt <= rosterAt);

/** The pending members an officer deleted, kept with their facts (2026-11-17), newest first. */
export async function dismissedMembers(
  db: Db,
  access: WorkspaceAccess,
): Promise<(Pending & { dismissedAt: Date })[]> {
  return (await dismissedPendings(db, access.workspaceId)).map((p) => ({
    uid: pendingUid(p.id),
    name: p.name,
    createdAt: p.createdAt,
    dismissedAt: p.dismissedAt,
  }));
}

/**
 * The open pending member with this name's key, else the dismissed one reopened, else a new one; null for
 * a name with no key.
 * With a request id (the add sheet, D100), a repeat returns the first add's member as `repeat`.
 */
export async function openPending(
  db: Db,
  access: WorkspaceAccess,
  name: string,
  now: Date,
  requestId: string | null = null,
): Promise<{ uid: number; repeat: boolean } | null> {
  const key = nameKey(name);
  if (key === "") return null;
  const ws = access.workspaceId;
  const before = requestId ? await findPending(db, ws, { requestId }) : null;
  if (before) return { uid: pendingUid(before.id), repeat: true };
  const row = { workspaceId: ws, name: name.trim(), nameKey: key, requestId, createdAt: now };
  const id =
    (await findPending(db, ws, { nameKey: key }))?.id ??
    (await reopenDismissed(db, ws, key, { name: row.name, requestId, now })) ??
    (await insertPending(db, { ...row, createdBy: access.user.id })) ??
    // Another officer sent the same request, or added the same name, at the same moment: reuse theirs.
    (await theirs(db, ws, requestId, key));
  return id === undefined ? null : { uid: pendingUid(id), repeat: false };
}

/** After a lost insert: the pending member of the same request, else the open one with the same key. */
async function theirs(db: Db, ws: number, requestId: string | null, key: string) {
  const same = requestId ? await findPending(db, ws, { requestId }) : null;
  return (same ?? (await findPending(db, ws, { nameKey: key })))?.id;
}

/** "Add a new member": the pending member and its first facts; a repeated request saves nothing again. */
export async function addPending(
  db: Db,
  access: WorkspaceAccess,
  input: { requestId: string; name: string; changes: readonly FactChange[] },
  clock: { now: Date; zone: string },
): Promise<{ uid: number; results: ChangeResult[] } | null> {
  const opened = await openPending(db, access, input.name, clock.now, input.requestId);
  if (!opened) return null;
  if (opened.repeat || input.changes.length === 0) return { uid: opened.uid, results: [] };
  const results = await saveFacts(db, access, opened.uid, input.changes, clock.now, clock.zone);
  return { uid: opened.uid, results: results ?? [] };
}

type SavedRow = {
  uid?: number | undefined;
  newName?: string | undefined;
  field?: string | undefined;
};

/**
 * A screenshot save's rows each name a member of the newest roster, a pending member, or a new member's
 * name with a key (D106), and each (member, fact) once.
 */
export async function rowsFit(
  db: Db,
  access: WorkspaceAccess,
  rows: readonly SavedRow[],
): Promise<boolean> {
  const [roster, pending] = await Promise.all([
    newestRoster(db, access.unionId),
    openPendings(db, access.workspaceId),
  ]);
  const members = new Set([...roster.map((m) => m.uid), ...pending.map((p) => pendingUid(p.id))]);
  const who = (r: SavedRow) =>
    r.newName === undefined ? String(r.uid) : `new:${nameKey(r.newName)}`;
  const known = (r: SavedRow) =>
    r.newName === undefined ? r.uid !== undefined && members.has(r.uid) : nameKey(r.newName) !== "";
  const keys = rows.map((r) => `${who(r)}:${r.field ?? ""}`);
  return rows.every(known) && new Set(keys).size === keys.length;
}

/**
 * A screenshot save's rows with each "New member: <name>" row given its pending member's uid, made or
 * reused by name key. It runs inside the save's transaction; two rows that turn out to be the same
 * member and fact refuse the save.
 */
export async function withNewMembers<R extends SavedRow>(
  db: Db,
  access: WorkspaceAccess,
  rows: readonly R[],
  now: Date,
): Promise<(Omit<R, "uid" | "newName"> & { uid: number })[]> {
  const out: (Omit<R, "uid" | "newName"> & { uid: number })[] = [];
  for (const { newName, uid, ...rest } of rows) {
    const id = newName === undefined ? uid : (await openPending(db, access, newName, now))?.uid;
    if (id === undefined) throw new SaveRefused("bad_rows");
    out.push({ ...rest, uid: id });
  }
  if (new Set(out.map((r) => `${r.uid}:${r.field ?? ""}`)).size !== out.length)
    throw new SaveRefused("bad_rows");
  return out;
}

/** Moves a pending member onto `uid` in one transaction; false when it was matched or deleted already. */
async function merge(
  db: Db,
  access: WorkspaceAccess,
  id: number,
  uid: number,
  by: { userId: number | null; now: Date },
): Promise<boolean> {
  const ws = access.workspaceId;
  return db.transaction(async (tx) => {
    const claimed = await claimPending(tx, ws, id, uid, by.now);
    if (!claimed) return false;
    await moveFacts(tx, ws, pendingUid(id), uid);
    await moveDuelPoints(tx, ws, pendingUid(id), uid);
    await saveAliases(tx, ws, [{ nameKey: claimed.nameKey, uid }], by.userId, by.now);
    return true;
  });
}

/** "Link to a member": an officer's pick, a member of the newest roster; their facts come after its own. */
export async function linkPending(
  db: Db,
  access: WorkspaceAccess,
  pendingId: number,
  uid: number,
  now: Date,
): Promise<"ok" | "not_found" | "not_member"> {
  if (!(await isMember(db, access, uid))) return "not_member";
  const merged = await merge(db, access, pendingId, uid, { userId: access.user.id, now });
  return merged ? "ok" : "not_found";
}

/** Deletes an open pending member from the list: it is dismissed, its facts and points are kept. */
export const removePending = (db: Db, access: WorkspaceAccess, pendingId: number, now: Date) =>
  dismissPending(db, access.workspaceId, pendingId, now);

/**
 * Matches each pending member added before the newest roster to the one member of that roster with the
 * same name key (or the uid its key is remembered for) and no facts yet; returns how many moved. Runs
 * when the Members tab is read, since the end-of-day read itself is outside the workspace (D71's fence).
 */
export async function reconcilePending(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
): Promise<number> {
  const ws = access.workspaceId;
  const pending = await openPendings(db, ws);
  if (pending.length === 0) return 0;
  const roster = await anyRoster(db, access.unionId);
  const due = roster ? pending.filter((p) => p.createdAt <= roster.at) : [];
  if (!roster || due.length === 0) return 0;
  const [aliases, known] = await Promise.all([
    aliasesOf(db, ws),
    uidsWithFacts(
      db,
      ws,
      roster.members.map((m) => m.uid),
    ),
  ]);
  let moved = 0;
  for (const p of due) {
    const alias = aliases.get(p.nameKey);
    const fits = roster.members.filter(
      (m) => !known.has(m.uid) && (nameKey(m.name) === p.nameKey || alias === m.uid),
    );
    const only = fits.length === 1 ? (fits[0]?.uid ?? null) : null;
    if (only === null || !(await merge(db, access, p.id, only, { userId: null, now }))) continue;
    known.add(only);
    moved += 1;
  }
  return moved;
}

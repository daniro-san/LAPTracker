// The thefts log (issue 321, D97): Secret Operations thefts from the workspace's members by other players,
// grouped by the attacker's alliance and by attacker, with "to follow up" per attacker. The
// attackers are looked up in the public read model of the tracked alliances' rosters (names and tags only);
// the victims in the workspace's own alliance (D71: union_id = access.unionId). Nothing here is logged.
import { ALLIANCES, SERVER } from "../../config/alliances";
import type { Db } from "../db";
import { leaderNames } from "../queries/leadership";
import { serverPlayers } from "../queries/server-players";
import {
  attackerServers,
  followUpRequested,
  hasAttacker,
  insertFollowUp,
  insertRequestedTheft,
  latestFollowUpId,
  listFollowUps,
  listThefts,
  noTwin,
  setAttackerServer,
  theftRequested,
} from "../repo/thefts";
import { softDelete, undoDelete } from "../repo/trash";
import { latestRoster } from "../repo/workspace-rosters";
import { serverDay, serverInstant } from "../schedule";
import { thefts } from "../schema-thefts";
import { nameKey } from "../screenshot/name-key";
import type { WorkspaceAccess } from "./access";
import { gameWeek, nextDay } from "./member-week";
import {
  attackerKeyOf,
  groupThefts,
  type AllianceGroup,
  type FollowUpState,
  type TheftEntry,
  type TheftKind,
} from "./theft-groups";

/** `now`, and the server's zone (SERVER_TZ): a report's times and the game week are server time. */
export interface Clock {
  now: Date;
  zone: string;
}

/** A player of another tracked alliance, as the attacker search offers it. */
export interface AttackerOption {
  uid: number;
  name: string;
  tag: string;
}

const MAX_OPTIONS = 8;
const NAME_MAX = 32;

/** A typed theft's attacker name: trimmed, 1 to NAME_MAX characters, with letters or digits; else null. */
export function cleanAttackerName(raw: string): string | null {
  const name = raw.trim();
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX && nameKey(name) !== "" ? name : null;
}

const cleanNote = (raw: string) => raw.trim() || null;

/** A real calendar day "YYYY-MM-DD" (no 02-30, no month 13). */
export function isRealDay(day: string): boolean {
  const at = new Date(`${day}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(at.getTime()) &&
    at.toISOString().startsWith(day)
  );
}

/**
 * Players of the server's tracked alliances, other than the workspace's own, whose name key holds the
 * query's (a leading "[TAG]" is ignored): the exact name first, then names that start with it.
 */
export async function findAttackers(
  db: Db,
  access: WorkspaceAccess,
  query: string,
): Promise<AttackerOption[]> {
  const key = nameKey(query.replace(/^\s*\[[^\]]*\]/, ""));
  if (key === "") return [];
  const order = (k: string) => (k === key ? 0 : k.startsWith(key) ? 1 : 2);
  return (await serverPlayers(db))
    .filter((p) => p.unionId !== access.unionId)
    .map((p) => ({ p, k: nameKey(p.name) }))
    .filter(({ k }) => k.includes(key))
    .sort((a, b) => order(a.k) - order(b.k))
    .slice(0, MAX_OPTIONS)
    .map(({ p }) => ({ uid: p.uid, name: p.name, tag: p.tag }));
}

/** Whom to contact about an alliance of our server that we track: its public page and its leader. */
export interface Contact {
  unionId: number;
  name: string;
  /** The R5 of the alliance's newest public read with ranks (of the last 4 events), and that read's time. */
  leader: { name: string; at: Date } | null;
}

export interface TheftsView {
  /** `contact` only for a tracked alliance with an attacker on our server. */
  groups: (AllianceGroup & { contact: Contact | null })[];
  /** The workspace's own alliance tag, for the warning message. */
  ownTag: string;
  /** The game week now is in (Monday 00:00 to the next Monday, server time). */
  week: { from: Date; to: Date };
  /** The alliance's newest roster, for the victim picker. */
  roster: { uid: number; name: string }[];
}

export async function theftsView(
  db: Db,
  access: WorkspaceAccess,
  clock: Clock,
): Promise<TheftsView> {
  const cfg = { SERVER_TZ: clock.zone };
  const days = gameWeek(serverDay(clock.now, cfg));
  const week = {
    from: serverInstant(days[0] as string, "00:00", cfg),
    to: serverInstant(nextDay(days[6] as string), "00:00", cfg),
  };
  const [rows, changes, roster, servers] = await Promise.all([
    listThefts(db, access.workspaceId),
    listFollowUps(db, access.workspaceId),
    latestRoster(db, access.unionId),
    attackerServers(db, access.workspaceId),
  ]);
  const entries: TheftEntry[] = rows.map((r) => ({
    id: r.id,
    at: r.at,
    attackerKey: r.attackerKey,
    attackerName: r.attackerName,
    attackerTag: r.attackerTag,
    rosterExact: r.rosterExact,
    kind: r.kind,
    victimUid: r.victimUid,
    victimName: r.victimName,
    source: r.source,
    items: r.items,
    note: r.note,
  }));
  const groups = groupThefts(entries, changes, week, servers);
  // A tracked alliance (never our own) is one to contact when one of its attackers is on our server and
  // carries its tag exactly: tags are case-sensitive and not unique (config/alliances.ts).
  const trackedOf = (g: AllianceGroup) =>
    ALLIANCES.find(
      (t) =>
        t.unionId !== access.unionId &&
        g.attackers.some((a) => a.server === SERVER && a.tag === t.tag),
    );
  const leaders = await leaderNames(
    db,
    groups.flatMap((g) => trackedOf(g)?.unionId ?? []),
  );
  return {
    groups: groups.map((g) => {
      const t = trackedOf(g);
      const leader = t ? (leaders.get(t.unionId) ?? null) : null;
      return { ...g, contact: t ? { unionId: t.unionId, name: t.name, leader } : null };
    }),
    ownTag: ALLIANCES.find((a) => a.unionId === access.unionId)?.tag ?? "",
    week,
    roster: roster.map((m) => ({ uid: m.uid, name: m.name })),
  };
}

/** An entry an officer types (issue 321): the report's server date and time, as the game shows them. */
export interface TypedTheft {
  attacker: { uid: number } | { name: string; tag: string };
  victimUid: number | null;
  day: string;
  time: string;
  kind: TheftKind;
  note: string;
  /** Made once per open add sheet (D100): a retry with it adds nothing new. */
  requestId: string;
}

export type TypedRefusal = "unknown_player" | "bad_name" | "not_in_alliance" | "bad_time";

/** The attacker as stored: a tracked player of another alliance by uid, or the name and tag typed. */
async function attackerOf(db: Db, access: WorkspaceAccess, attacker: TypedTheft["attacker"]) {
  if ("uid" in attacker) {
    const player = (await serverPlayers(db)).find(
      (p) => p.uid === attacker.uid && p.unionId !== access.unionId,
    );
    return player ? { uid: player.uid, name: player.name, tag: player.tag } : "unknown_player";
  }
  const name = cleanAttackerName(attacker.name);
  return name ? { uid: null, name, tag: attacker.tag.trim() } : "bad_name";
}

/** The typed day and time as an instant; null for a day that does not exist or a time still to come. */
function typedInstant(input: TypedTheft, clock: Clock): Date | null {
  const at = isRealDay(input.day)
    ? serverInstant(input.day, input.time, { SERVER_TZ: clock.zone })
    : null;
  // A minute's grace for a clock set a little ahead; a later time is a typing slip.
  return at && at.getTime() <= clock.now.getTime() + 60_000 ? at : null;
}

export async function addTheft(
  db: Db,
  access: WorkspaceAccess,
  input: TypedTheft,
  clock: Clock,
): Promise<"ok" | TypedRefusal> {
  const at = typedInstant(input, clock);
  if (!at) return "bad_time";
  // INVARIANT thefts.request-once: a retry after a lost answer finds the first add (D100); a second send
  // that arrives at the same moment loses on the unique index and gets the same "ok".
  if (await theftRequested(db, access.workspaceId, input.requestId)) return "ok";
  const [attacker, roster] = await Promise.all([
    attackerOf(db, access, input.attacker),
    input.victimUid === null ? [] : latestRoster(db, access.unionId),
  ]);
  if (typeof attacker === "string") return attacker;
  const victim = input.victimUid === null ? null : roster.find((m) => m.uid === input.victimUid);
  if (victim === undefined) return "not_in_alliance";
  // Stored now, or by the send that won the unique index: either way the theft is there once.
  await insertRequestedTheft(db, {
    workspaceId: access.workspaceId,
    at,
    attackerKey: attackerKeyOf(attacker.uid, attacker.name),
    attackerUid: attacker.uid,
    attackerName: attacker.name,
    attackerTag: attacker.tag,
    // An officer picked the player from a tracked roster: on our server (D97, amended 2026-11-19).
    rosterExact: attacker.uid !== null,
    kind: input.kind,
    victimUid: victim?.uid ?? null,
    victimName: victim?.name ?? null,
    source: "typed",
    note: cleanNote(input.note),
    createdBy: access.user.id,
    createdAt: clock.now,
    requestId: input.requestId,
  });
  return "ok";
}

/**
 * Deletes one entry of the workspace's log (D123), or with `undo` takes the officer's own delete made under
 * the same request id back within UNDO_MS. "not_found": no such entry, or nothing of this officer's to undo.
 */
export async function removeTheft(
  db: Db,
  access: WorkspaceAccess,
  input: { id: number; requestId: string; undo?: true | undefined },
  now: Date,
): Promise<"ok" | "not_found"> {
  const c = { workspaceId: access.workspaceId, userId: access.user.id, now, ...input };
  const done = input.undo
    ? await undoDelete(db, thefts, c, noTwin)
    : await softDelete(db, thefts, c);
  return done ? "ok" : "not_found";
}

/** "To follow up": a new state and note for an attacker of this workspace's log, kept with who and when. */
/**
 * A step for an attacker of this workspace's log, kept with who and when. `expected` is the newest change
 * the officer saw (null: none): when another officer changed the step first, nothing is written
 * ("conflict", 409). A retry with the same request id (D100) adds nothing.
 */
export async function setFollowUp(
  db: Db,
  access: WorkspaceAccess,
  input: {
    attacker: string;
    state: FollowUpState;
    note: string;
    requestId: string;
    expected: number | null;
  },
  now: Date,
): Promise<"ok" | "not_found" | "conflict"> {
  const ws = access.workspaceId;
  if (await followUpRequested(db, ws, input.requestId)) return "ok";
  if (!(await hasAttacker(db, ws, input.attacker))) return "not_found";
  if ((await latestFollowUpId(db, ws, input.attacker)) !== input.expected) return "conflict";
  await insertFollowUp(db, {
    workspaceId: ws,
    attackerKey: input.attacker,
    state: input.state,
    note: cleanNote(input.note),
    changedBy: access.user.id,
    changedAt: now,
    requestId: input.requestId,
  });
  return "ok";
}

/** An attacker's server as an officer sets it (null: "not known"), kept per attacker. */
export async function setServer(
  db: Db,
  access: WorkspaceAccess,
  input: { attacker: string; server: number | null },
  now: Date,
): Promise<"ok" | "not_found"> {
  if (!(await hasAttacker(db, access.workspaceId, input.attacker))) return "not_found";
  await setAttackerServer(db, {
    workspaceId: access.workspaceId,
    attackerKey: input.attacker,
    server: input.server,
    setBy: access.user.id,
    setAt: now,
  });
  return "ok";
}

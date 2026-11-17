// The thefts log (issue 321, D97): Secret Operations thefts from the workspace's members by players of the
// same server, grouped by the attacker's alliance and by attacker, with "to follow up" per attacker. The
// attackers are looked up in the public read model of the tracked alliances' rosters (names and tags only);
// the victims in the workspace's own alliance (D71: union_id = access.unionId). Nothing here is logged.
import type { Db } from "../db";
import { serverPlayers } from "../queries/server-players";
import {
  deleteTheft,
  hasAttacker,
  insertFollowUp,
  insertThefts,
  listFollowUps,
  listThefts,
} from "../repo/thefts";
import { latestRoster } from "../repo/workspace-rosters";
import { serverDay, serverInstant } from "../schedule";
import { nameKey } from "../screenshot/name-key";
import type { WorkspaceAccess } from "./access";
import { gameWeek, nextDay } from "./member-week";
import {
  attackerKeyOf,
  groupThefts,
  type AllianceGroup,
  type FollowUpState,
  type TheftEntry,
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

export interface TheftsView {
  groups: AllianceGroup[];
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
  const [rows, changes, roster] = await Promise.all([
    listThefts(db, access.workspaceId),
    listFollowUps(db, access.workspaceId),
    latestRoster(db, access.unionId),
  ]);
  const entries: TheftEntry[] = rows.map((r) => ({
    id: r.id,
    at: r.at,
    attackerKey: r.attackerKey,
    attackerName: r.attackerName,
    attackerTag: r.attackerTag,
    stolen: r.stolen,
    victimUid: r.victimUid,
    victimName: r.victimName,
    source: r.source,
    note: r.note,
  }));
  return {
    groups: groupThefts(entries, changes, week),
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
  stolen: "quest_rewards" | null;
  note: string;
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

export async function addTheft(
  db: Db,
  access: WorkspaceAccess,
  input: TypedTheft,
  clock: Clock,
): Promise<"ok" | TypedRefusal> {
  const at = isRealDay(input.day)
    ? serverInstant(input.day, input.time, { SERVER_TZ: clock.zone })
    : null;
  // A minute's grace for a clock set a little ahead; a later time is a typing slip.
  if (!at || at.getTime() > clock.now.getTime() + 60_000) return "bad_time";
  const attacker = await attackerOf(db, access, input.attacker);
  if (typeof attacker === "string") return attacker;
  const victim =
    input.victimUid === null
      ? null
      : (await latestRoster(db, access.unionId)).find((m) => m.uid === input.victimUid);
  if (victim === undefined) return "not_in_alliance";
  await insertThefts(db, [
    {
      workspaceId: access.workspaceId,
      at,
      attackerKey: attackerKeyOf(attacker.uid, attacker.name),
      attackerUid: attacker.uid,
      attackerName: attacker.name,
      attackerTag: attacker.tag,
      stolen: input.stolen,
      victimUid: victim?.uid ?? null,
      victimName: victim?.name ?? null,
      source: "typed",
      note: cleanNote(input.note),
      createdBy: access.user.id,
      createdAt: clock.now,
    },
  ]);
  return "ok";
}

export async function removeTheft(
  db: Db,
  access: WorkspaceAccess,
  id: number,
): Promise<"ok" | "not_found"> {
  return (await deleteTheft(db, access.workspaceId, id)) ? "ok" : "not_found";
}

/** "To follow up": a new state and note for an attacker of this workspace's log, kept with who and when. */
export async function setFollowUp(
  db: Db,
  access: WorkspaceAccess,
  input: { attacker: string; state: FollowUpState; note: string },
  now: Date,
): Promise<"ok" | "not_found"> {
  if (!(await hasAttacker(db, access.workspaceId, input.attacker))) return "not_found";
  await insertFollowUp(db, {
    workspaceId: access.workspaceId,
    attackerKey: input.attacker,
    state: input.state,
    note: cleanNote(input.note),
    changedBy: access.user.id,
    changedAt: now,
  });
  return "ok";
}

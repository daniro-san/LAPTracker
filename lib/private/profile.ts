// The officer's own profile (issue 334): the name the desk shows, and "This is me", the officer's player in
// the workspace's own alliance (D71: union_id = access.unionId). Only the members' uids and names are read.
// Nothing here is logged or sent to analytics.
import type { Db } from "../db";
import { latestRosterNames } from "../repo/workspace-rosters";
import { updateWorkspaceUser } from "../repo/workspaces";
import { matchName } from "../screenshot/match-name";
import type { WorkspaceAccess } from "./access";

export const NAME_MAX = 32;

/** The name without surrounding spaces, when it has 1 to NAME_MAX characters; null otherwise. */
export function cleanName(raw: string): string | null {
  const name = raw.trim();
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX ? name : null;
}

export interface Player {
  uid: number;
  name: string;
}

export interface Profile {
  name: string;
  /** The linked player; `name` is null when the alliance's newest roster no longer lists them. */
  player: { uid: number; name: string | null } | null;
  /** Players of the alliance whose name is like the officer's, while none is linked. */
  suggestions: Player[];
  /** The alliance's newest roster, uid and name, for the search; empty once a player is linked. */
  roster: Player[];
}

/** The matcher's answer for `name` (D74): its one match, its suggestions, or none. */
function suggestionsFor(name: string, roster: Player[]): Player[] {
  const match = matchName(
    name,
    roster.map((p) => ({ uid: p.uid, names: [p.name] })),
  );
  if (match.status === "matched") return roster.filter((p) => p.uid === match.uid).slice(0, 1);
  if (match.status === "unsure") return match.suggestions.map(({ uid, name }) => ({ uid, name }));
  return [];
}

async function profileOf(
  db: Db,
  access: WorkspaceAccess,
  name: string,
  playerUid: number | null,
): Promise<Profile> {
  const roster = await latestRosterNames(db, access.unionId);
  if (playerUid === null)
    return { name, player: null, suggestions: suggestionsFor(name, roster), roster };
  const listed = roster.find((p) => p.uid === playerUid);
  return {
    name,
    player: { uid: playerUid, name: listed?.name ?? null },
    suggestions: [],
    roster: [],
  };
}

export function profileView(db: Db, access: WorkspaceAccess): Promise<Profile> {
  return profileOf(db, access, access.user.displayName ?? "", access.user.playerUid);
}

export async function renameOfficer(
  db: Db,
  access: WorkspaceAccess,
  raw: string,
): Promise<Profile | "invalid_name"> {
  const name = cleanName(raw);
  if (name === null) return "invalid_name";
  await updateWorkspaceUser(db, access.workspaceId, access.user.id, { chosenName: name });
  return profileOf(db, access, name, access.user.playerUid);
}

/** "This is me": only a member of the workspace's own alliance, in its newest roster. */
export async function linkPlayer(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
): Promise<Profile | "not_in_alliance"> {
  const roster = await latestRosterNames(db, access.unionId);
  const player = roster.find((p) => p.uid === uid);
  if (!player) return "not_in_alliance";
  await updateWorkspaceUser(db, access.workspaceId, access.user.id, { playerUid: uid });
  return { name: access.user.displayName ?? "", player, suggestions: [], roster: [] };
}

export async function unlinkPlayer(db: Db, access: WorkspaceAccess): Promise<Profile> {
  await updateWorkspaceUser(db, access.workspaceId, access.user.id, { playerUid: null });
  return profileOf(db, access, access.user.displayName ?? "", null);
}

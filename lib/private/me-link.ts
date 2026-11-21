// "This is me" for members (D87, D142): a member picks their player from the newest usable roster of the
// workspace's own alliance. Every member's link waits for an officer's Approve (Home's "To review") and
// reserves nothing until then: a member can edit their own server nickname, so a name match proves nothing
// (orchestrator, 2026-11-21). The D74 matcher's answer on the Discord name is only a hint for the officer. One player per Discord user and one user per player in a workspace: a
// player someone else holds is "taken". Officers see, approve and remove links from the desk. Nothing here
// is logged or sent to analytics.
import type { Db } from "../db";
import {
  approveLink,
  clearLink,
  linksOfPlayer,
  linksToReview,
  setLink,
  type LinkState,
} from "../repo/player-links";
import { latestRoster } from "../repo/workspace-rosters";
import { matchName } from "../screenshot/match-name";
import type { BoardAccess, WorkspaceAccess } from "./access";
import type { WorkspaceDictionary } from "./dictionary";
import { linkWords, type LinkWords } from "./dictionary.me";
import { rankOf } from "./members";
import type { Player } from "./profile";

/** True when the matcher's one match for the Discord name, by current game name only, is `uid`. */
export function nameMatches(discordName: string | null, uid: number, roster: Player[]): boolean {
  const match = matchName(
    discordName ?? "",
    roster.map((p) => ({ uid: p.uid, names: [p.name] })),
  );
  return match.status === "matched" && match.via === "current" && match.uid === uid;
}

const playersOf = async (db: Db, unionId: number): Promise<Player[]> =>
  (await latestRoster(db, unionId)).map((e) => ({
    uid: e.uid,
    name: e.name,
    rank: rankOf(e),
    might: e.might,
  }));

export interface LinkPicker {
  /** The matcher's suggestions for the Discord name (D74). */
  suggestions: Player[];
  /** The alliance's newest roster, for the search. */
  roster: Player[];
}

/** What the member picks from, while no player is linked. */
export async function linkPicker(db: Db, board: BoardAccess): Promise<LinkPicker> {
  const roster = await playersOf(db, board.unionId);
  const match = matchName(
    board.discordName ?? "",
    roster.map((p) => ({ uid: p.uid, names: [p.name] })),
  );
  const uids =
    match.status === "matched"
      ? [match.uid]
      : match.status === "unsure"
        ? match.suggestions.map((s) => s.uid)
        : [];
  return { suggestions: roster.filter((p) => uids.includes(p.uid)), roster };
}

/** The name of the member's linked player in the newest roster, or null when it does not list them. */
export async function linkedName(db: Db, board: BoardAccess): Promise<string | null> {
  const uid = board.player?.uid;
  if (uid === undefined) return null;
  return (await latestRoster(db, board.unionId)).find((p) => p.uid === uid)?.name ?? null;
}

export type ClaimResult = { state: LinkState } | "not_in_alliance" | "taken" | "linked";

/** The member says they are `uid`. A member who already has a link removes it first ("linked"). */
export async function claimPlayer(
  db: Db,
  board: BoardAccess,
  uid: number,
  now: Date,
): Promise<ClaimResult> {
  if (board.player) return "linked";
  const roster = await playersOf(db, board.unionId);
  if (!roster.some((p) => p.uid === uid)) return "not_in_alliance";
  // An officer's own link is approved, as on the desk (D87); a member's waits for an officer.
  const state = board.officer ? "approved" : "pending";
  const done = await setLink(db, board.workspaceId, board.userId, { uid, state, at: now });
  return done === "taken" ? "taken" : { state };
}

/** "This isn't me" or "Pick another player": the member's own link goes. */
export async function dropOwnLink(db: Db, board: BoardAccess): Promise<void> {
  await clearLink(db, board.workspaceId, board.userId);
}

/** A link an officer still has to look at (Home's "To review"). */
export interface LinkReview {
  /** The workspace user who holds it: what Approve and Reject name. */
  userId: number;
  discordName: string;
  /** "Wren Invented · R3", from the newest roster. */
  player: string;
  /** A hint only: the Discord name is this player's current game name (D74). It proves nothing. */
  nameMatch: boolean;
}

/** The links waiting for an officer, with the player's name and rank and the name hint. */
export async function linkReviews(db: Db, access: WorkspaceAccess): Promise<LinkReview[]> {
  const links = await linksToReview(db, access.workspaceId);
  if (links.length === 0) return [];
  const players = await playersOf(db, access.unionId);
  const roster = new Map(players.map((p) => [p.uid, p]));
  return links.map((l) => {
    const p = roster.get(l.uid);
    return {
      userId: l.userId,
      discordName: l.discordName ?? "",
      player: p ? [p.name, p.rank].filter(Boolean).join(" · ") : String(l.uid),
      nameMatch: nameMatches(l.discordName, l.uid, players),
    };
  });
}

export interface CardLink {
  userId: number;
  discordName: string;
  state: LinkState;
  words: LinkWords;
}

/** The link to one member of the alliance (the open one, else the oldest claim), for the member card. */
export async function cardLink(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  t: WorkspaceDictionary,
): Promise<CardLink | null> {
  const [link] = await linksOfPlayer(db, access.workspaceId, uid);
  if (!link) return null;
  return {
    userId: link.userId,
    discordName: link.discordName ?? "",
    state: link.state,
    words: linkWords(t),
  };
}

/** An officer approves or confirms one user's link, or removes it (Reject, Remove). */
export async function decideLink(
  db: Db,
  access: WorkspaceAccess,
  userId: number,
  action: "approve" | "unlink",
): Promise<"ok" | "taken" | "none"> {
  if (action === "approve") return approveLink(db, access.workspaceId, userId);
  return (await clearLink(db, access.workspaceId, userId)) ? "ok" : "none";
}

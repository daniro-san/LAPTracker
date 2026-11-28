// Members → Requests (issue 868): the `/join` requests of the workspace's own Discord server, each with the
// players of the alliance's newest roster its typed name or ID matches (D74's matcher; an ID only when the
// roster lists it). An officer's Approve, of one of those players, links the Discord user to the player as an
// approved "This is me" (D142), so their board page opens at once; then the bot gives the member role officers
// chose, and the welcome post is made for them when that post is on (D159). Decline deletes the request and
// posts nothing. Nothing happens without an officer's tap (D75). Every function takes a WorkspaceAccess, so
// another workspace's request is never read or answered. Nothing here is logged but codes.
import type { AppContext } from "../app-context";
import type { Db } from "../db";
import type { Env } from "../env";
import { discordCallout } from "../post-callout";
import {
  deleteJoinRequest,
  findJoinRequest,
  joinSince,
  joinUser,
  markWelcomed,
  openJoinRequests,
} from "../repo/join-requests";
import { setLink } from "../repo/player-links";
import { liveCallout } from "../repo/post-touches";
import { discordState } from "../repo/workspace-discord";
import { postsOf } from "../repo/workspace-posts";
import { findWorkspaceBySlug } from "../repo/workspaces";
import { matchName } from "../screenshot/match-name";
import type { WorkspaceAccess } from "./access";
import { postTitle, welcomeText } from "./catalog-posts";
import { WORKSPACE_DICTIONARIES, WORKSPACE_LANGUAGES, type WorkspaceLanguage } from "./dictionary";
import { giveMemberRole } from "./discord-member-role";
import { noticeChannels } from "./discord-webhooks";
import { featureOn } from "./features";
import { privateLog } from "./log";
import { playersOf } from "./me-link";
import { discordMessages } from "./notice-formats";
import { postMessages } from "./notice-publish";
import type { Player } from "./profile";
import { UID_TEXT } from "./recruit-check";

export interface JoinRequestView {
  id: number;
  /** The name Discord showed for the person when they sent it. */
  who: string;
  typed: string;
  at: Date;
  /** The newest roster's players the typed name or ID matches; empty: not in the roster yet. */
  candidates: Player[];
}

/** The players `typed` names: the one whose ID it is, else the matcher's match or its suggestions. */
export function candidatesOf(typed: string, roster: Player[]): Player[] {
  if (UID_TEXT.test(typed)) {
    const byId = roster.find((p) => p.uid === Number(typed));
    if (byId) return [byId];
  }
  const match = matchName(
    typed,
    roster.map((p) => ({ uid: p.uid, names: [p.name] })),
  );
  const uids =
    match.status === "matched"
      ? [match.uid]
      : match.status === "unsure"
        ? match.suggestions.map((s) => s.uid)
        : [];
  return roster.filter((p) => uids.includes(p.uid));
}

/** The workspace's open requests, the oldest first, each with its candidates. */
export async function joinRequestsView(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
): Promise<JoinRequestView[]> {
  const rows = await openJoinRequests(db, access.workspaceId, joinSince(now));
  if (rows.length === 0) return [];
  const roster = await playersOf(db, access.unionId);
  return rows.map((r) => ({
    id: r.id,
    who: r.discordName,
    typed: r.typed,
    at: r.createdAt,
    candidates: candidatesOf(r.typed, roster),
  }));
}

export interface JoinDeps {
  env: Pick<
    Env,
    | "DISCORD_API_BASE_URL"
    | "DISCORD_BOT_TOKEN"
    | "DISCORD_CLIENT_ID"
    | "WORKSPACE_KEYS_SECRET"
    | "WORKSPACE_DISCORD_WEBHOOKS"
  >;
  fetch: typeof fetch;
  report: AppContext["report"];
}

export type JoinAnswer =
  | { ok: true; role: "given" | "failed" | "none"; welcome: "posted" | "failed" | "off" }
  | { ok: true; declined: true }
  | { ok: false; code: "gone" | "taken" };

const languageOf = (code: string): WorkspaceLanguage =>
  (WORKSPACE_LANGUAGES as readonly string[]).includes(code) ? (code as WorkspaceLanguage) : "en";

/** The welcome post (D159) for one approved member, when the owner allows it and officers turned it on. */
async function welcome(
  db: Db,
  access: WorkspaceAccess,
  deps: JoinDeps,
  name: string,
): Promise<"posted" | "failed" | "off"> {
  const row = (await postsOf(db, access.workspaceId)).get("welcome");
  if (!row?.on || !featureOn(access, "post_welcome")) return "off";
  const channel = (await noticeChannels(db, access, deps))[row.channel];
  if (!channel) return "off";
  const language = languageOf(row.language);
  const text = welcomeText([name], language) ?? "";
  const title = postTitle("welcome", row.title, WORKSPACE_DICTIONARIES[language]);
  const lead = discordCallout(await liveCallout(db, access.workspaceId, "welcome"));
  const messages = discordMessages(title, [{ name: "", text }], !channel.forum, lead);
  const { sent, status } = await postMessages(deps.fetch, channel, title, messages);
  privateLog("join.welcome", { sent, of: messages.length, http: status ?? 0 });
  return sent === messages.length ? "posted" : "failed";
}

/** The member role officers chose, given to the Discord user; "none" when no role is chosen. */
async function role(db: Db, access: WorkspaceAccess, deps: JoinDeps, userId: string) {
  const [state, workspace] = await Promise.all([
    discordState(db, access.workspaceId),
    findWorkspaceBySlug(db, access.slug),
  ]);
  if (!state.memberRoleId) return "none" as const;
  if (!deps.env.DISCORD_BOT_TOKEN || !workspace) return "failed" as const;
  const given = await giveMemberRole(deps, workspace.discordGuildId, userId, state.memberRoleId);
  privateLog("join.role", { given: given === "given" ? 1 : 0 });
  return given;
}

/**
 * An officer's answer to one open request of the workspace. Approve names the player the officer picked, who
 * must be in the newest roster; "taken" when another user holds that player with an approved link, and the
 * request stays. "gone": the request was answered, expired, or the player left the roster meanwhile.
 */
export async function answerJoinRequest(
  db: Db,
  access: WorkspaceAccess,
  deps: JoinDeps,
  input: { action: "approve"; id: number; uid: number } | { action: "decline"; id: number },
  now: Date,
): Promise<JoinAnswer> {
  const request = await findJoinRequest(db, access.workspaceId, input.id, joinSince(now));
  if (!request) return { ok: false, code: "gone" };
  if (input.action === "decline") {
    // Quiet: nothing is posted, and the person is not told.
    const gone = await deleteJoinRequest(db, access.workspaceId, request.id);
    return gone ? { ok: true, declined: true } : { ok: false, code: "gone" };
  }
  const player = (await playersOf(db, access.unionId)).find((p) => p.uid === input.uid);
  if (!player) return { ok: false, code: "gone" };
  const userId = await joinUser(db, access.workspaceId, request.discordUserId, request.discordName);
  const link = { uid: player.uid, state: "approved" as const, at: now };
  if ((await setLink(db, access.workspaceId, userId, link)) === "taken")
    return { ok: false, code: "taken" };
  await deleteJoinRequest(db, access.workspaceId, request.id);
  const given = await role(db, access, deps, request.discordUserId);
  const welcomed = await welcome(db, access, deps, player.name);
  if (welcomed === "posted") await markWelcomed(db, access.workspaceId, userId, now);
  return { ok: true, role: given, welcome: welcomed };
}

// `/join` in an alliance's Discord server (issue 868): a person types their game name or ID, and the request
// waits for an officer on Members → Requests. The reply is private and in the person's own Discord language
// (as D101's commands). Nothing else happens until an officer taps Approve or Decline (D75). Per person, at
// most JOIN_PER_HOUR requests an hour, counted in `auth_attempts` under a hash of their Discord id. The
// leaders' channel hears of a new request with the typed name only, in the server's own Discord language.
// Nothing here is logged but codes.
import { createHash } from "node:crypto";

import { JOIN_TYPED_MAX } from "../app-commands";
import type { Db } from "../db";
import { breakLinks } from "../post-callout";
import { recordFailure } from "../repo/auth-attempts";
import { joinSince, recordJoinRequest } from "../repo/join-requests";
import { findWorkspaceByGuild } from "../repo/workspaces";
import { fill } from "../words";
import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  type WorkspaceLanguage,
} from "./dictionary";
import { EPHEMERAL, REPLY } from "./discord-api";
import { featureOn, featuresById } from "./features";
import { privateLog } from "./log";

/** Requests one person may send in an hour, refused ones included. */
export const JOIN_PER_HOUR = 3;
const HOUR_MS = 60 * 60_000;
/** The longest Discord name kept with a request. */
const NAME_MAX = 100;

/** The leaders' note on a new request: the workspace, the typed name and the note's language. */
export interface JoinNote {
  workspaceId: number;
  slug: string;
  typed: string;
  language: WorkspaceLanguage;
}

export interface JoinInput {
  guildId: string | undefined;
  userId: string | undefined;
  /** The name Discord shows for the person in the server: nickname, then display name, then username. */
  name: string | undefined;
  locale: string | undefined;
  guildLocale: string | undefined;
  /** The option's value as Discord sent it. */
  typed: unknown;
}

const privateReply = (content: string) => ({
  type: REPLY,
  data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } },
});

/** The typed name: control characters out, spaces collapsed, 1 to JOIN_TYPED_MAX characters; else null. */
export function cleanTyped(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length >= 1 && [...text].length <= JOIN_TYPED_MAX ? text : null;
}

/** The per-person key: a hash, so the table never keeps the Discord id. */
const personKey = (userId: string) =>
  `join:${createHash("sha256").update(userId).digest("hex").slice(0, 32)}`;

/** Why this `/join` records nothing (the reply's key), or its server's workspace and the cleaned text. */
async function refusal(db: Db, input: JoinInput, now: Date) {
  const workspace = input.guildId ? await findWorkspaceByGuild(db, input.guildId) : null;
  if (!workspace || !input.userId) return { key: "shots.discord.noDesk", log: "refused" } as const;
  if (!featureOn({ features: await featuresById(db, workspace.id) }, "discord_join"))
    return { key: "features.off.command", log: "off" } as const;
  const typed = cleanTyped(input.typed);
  if (!typed) return { key: "join.discord.empty", log: "empty" } as const;
  if ((await recordFailure(db, personKey(input.userId), HOUR_MS, now)) > JOIN_PER_HOUR)
    return { key: "join.discord.limited", log: "limited" } as const;
  return { workspace, userId: input.userId, typed };
}

/**
 * One `/join`: a private answer, and the leaders' note when the request is new. A server with no workspace,
 * or with `/join` turned off (D126), records nothing.
 */
export async function joinCommand(
  db: Db,
  input: JoinInput,
  now: Date,
): Promise<{ body: unknown; note?: JoinNote }> {
  const t = WORKSPACE_DICTIONARIES[pickWorkspaceLanguage(undefined, input.locale ?? null)];
  const checked = await refusal(db, input, now);
  if ("key" in checked) {
    privateLog(`discord.join.${checked.log}`);
    return { body: privateReply(t[checked.key]) };
  }
  const { workspace, userId, typed } = checked;
  const name = (input.name ?? "").trim().slice(0, NAME_MAX) || userId;
  const fresh = await recordJoinRequest(
    db,
    { workspaceId: workspace.id, discordUserId: userId, discordName: name, typed, at: now },
    joinSince(now),
  );
  privateLog("discord.join.sent", { fresh: fresh ? 1 : 0 });
  const language = pickWorkspaceLanguage(undefined, input.guildLocale ?? null);
  const note = fresh ? { workspaceId: workspace.id, slug: workspace.slug, typed, language } : null;
  return { body: privateReply(t["join.discord.sent"]), ...(note && { note }) };
}

/** The leaders' note: its title, and one line with the typed name (no link in it) and the desk's page. */
export function joinNoteMessage(note: JoinNote, origin: string) {
  const t = WORKSPACE_DICTIONARIES[note.language];
  const link = `${origin}/w/${note.slug}/requests`;
  return {
    title: t["join.note.title"],
    text: fill(t["join.note.text"], { typed: breakLinks(note.typed), link }),
  };
}

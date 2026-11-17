// The app's Discord interactions on one public route: "Apps → Send to LAPTracker" (issue 299, D96), and the
// two Translate commands with their picker (D101, discord-translate.ts). The Ed25519 signature is checked
// with the app's Public Key and a PING is answered. For "Send to LAPTracker" only, the person must pass the
// workspace's own rule (its server's leadership roles, or the allowlist), the same as the sign-in (D71).
// Discord wants an answer within 3 s: the route answers "thinking…" visible only to the sender, and the
// reading runs after the response (`later`), then edits that reply (import-discord.ts).
import { createPublicKey, verify } from "node:crypto";

import { z } from "zod";

import { IMPORT_COMMAND, TRANSLATE_FOR_EVERYONE, TRANSLATE_FOR_ME } from "../app-commands";
import type { Db } from "../db";
import { claimPictures, findWorkspaceByGuild, picturesDrafts, recordOfficer } from "../repo/import";
import { findWorkspaceUser } from "../repo/workspaces";
import { officerAccess, type WorkspaceAccess } from "./access";
import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "./dictionary";
import {
  APPLICATION_COMMAND,
  DEFERRED_REPLY,
  EPHEMERAL,
  MESSAGE_COMPONENT,
  PING,
  PONG,
  REPLY,
} from "./discord-api";
import { translateCommand, translateComponent, type TranslationJob } from "./discord-translate";
import { privately } from "./http";
import { DRAFT_DAYS } from "./import";
import { privateLog } from "./log";
import { DAY_MS } from "./member-week";
import { refusalOf } from "./sign-in";

/** How far a signed timestamp may be from now (seconds). */
const MAX_SKEW_S = 300;

/** Ed25519 over `timestamp + body` with the app's Public Key (hex); false on anything malformed. */
export function verifySignature(
  publicKeyHex: string | undefined,
  signature: string | null,
  timestamp: string | null,
  body: string,
): boolean {
  if (!publicKeyHex || !signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature))
    return false;
  try {
    const x = Buffer.from(publicKeyHex, "hex").toString("base64url");
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x }, format: "jwk" });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

const attachmentSchema = z.object({
  id: z.string(),
  url: z.string(),
  proxy_url: z.string().optional(),
  content_type: z.string().optional(),
  size: z.number(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

const interactionSchema = z.object({
  type: z.number(),
  application_id: z.string(),
  token: z.string(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  locale: z.string().optional(),
  member: z
    .object({
      nick: z.string().nullish(),
      roles: z.array(z.string()),
      /** The person's permissions in this channel, resolved by Discord (a bit field as decimal). */
      permissions: z.string().regex(/^\d+$/).optional(),
      user: z.object({ id: z.string(), username: z.string(), global_name: z.string().nullish() }),
    })
    .optional(),
  data: z
    .object({
      // A command has a name and type; a press in a picker has its custom_id (and a select its values).
      name: z.string().optional(),
      type: z.number().optional(),
      custom_id: z.string().optional(),
      values: z.array(z.string()).optional(),
      target_id: z.string().optional(),
      resolved: z
        .object({
          messages: z
            .record(
              z.string(),
              z.object({
                timestamp: z.string(),
                content: z.string().optional(),
                attachments: z.array(attachmentSchema),
              }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
  /** The app's own message a picker press came from, and who the command that made it was from. */
  message: z
    .object({
      flags: z.number().optional(),
      embeds: z.array(z.object({ description: z.string().optional() })).optional(),
      interaction_metadata: z.object({ user: z.object({ id: z.string() }) }).optional(),
      interaction: z.object({ user: z.object({ id: z.string() }) }).optional(),
    })
    .optional(),
});
type Interaction = z.infer<typeof interactionSchema>;

/** What the reading after the response needs: who, where, which pictures, and the reply to edit. */
export interface Job {
  access: WorkspaceAccess;
  language: WorkspaceLanguage;
  /** Only the pictures this run claimed (D100): none an earlier run already sent. */
  pictures: Attachment[];
  /** The Discord message the pictures are on. */
  messageId: string;
  /** When the message with the pictures was posted. */
  postedAt: Date;
  /** The interaction's webhook: application id and token, to edit the "thinking…" reply. */
  webhook: { applicationId: string; token: string };
}

export type Handled =
  | { status: 200; body: unknown; job?: Job; translation?: TranslationJob }
  | { status: 400 | 401; body: { code: string } };

const reply = (content: string) => ({
  status: 200 as const,
  body: { type: REPLY, data: { content, flags: EPHEMERAL } },
});

const isPicture = (a: Attachment) =>
  (a.content_type ?? "").startsWith("image/") || /\.(png|jpe?g|webp)(\?|$)/i.test(a.url);

function parse(body: string): Interaction | null {
  try {
    const parsed = interactionSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The workspace of the interaction's server, and the person when they pass its rule; a refusal word otherwise. */
async function officerOf(db: Db, interaction: Interaction, now: Date) {
  const member = interaction.member;
  const workspace = interaction.guild_id
    ? await findWorkspaceByGuild(db, interaction.guild_id)
    : null;
  if (!workspace || !member) return { refused: "shots.discord.noDesk" as const };
  const known = await findWorkspaceUser(db, workspace.id, member.user.id);
  const viaRole = member.roles.some((r) => workspace.leaderRoleIds.includes(r));
  if (refusalOf(known, viaRole, false, now))
    return { refused: "shots.discord.notOfficer" as const };
  const name = member.nick ?? member.user.global_name ?? member.user.username;
  // A Discord name is what a person typed: a database error leaves as a code alone (D80).
  const officer = await privately("discord_officer", () =>
    recordOfficer(db, workspace.id, member.user.id, name),
  );
  return { access: officerAccess(workspace, officer) };
}

/** Which of the app's commands this is, or null. */
function commandOf(i: Interaction) {
  if (i.type !== APPLICATION_COMMAND || i.data?.type !== IMPORT_COMMAND.type) return null;
  const names = {
    [IMPORT_COMMAND.name]: "import",
    [TRANSLATE_FOR_ME.name]: "me",
    [TRANSLATE_FOR_EVERYONE.name]: "everyone",
  } as const;
  const name = i.data.name ?? "";
  return Object.hasOwn(names, name) ? names[name as keyof typeof names] : null;
}

/** The message the command was used on, as Discord sends it resolved. */
const targetMessage = (i: Interaction) =>
  i.data?.target_id ? i.data.resolved?.messages?.[i.data.target_id] : undefined;

/**
 * A second run on pictures already sent (D100): the drafts they went into, with their review links. A
 * run still reading them has no draft yet; the line alone says so.
 */
async function alreadySent(
  db: Db,
  access: WorkspaceAccess,
  messageId: string,
  t: WorkspaceDictionary,
  origin: string,
): Promise<string> {
  const drafts = await picturesDrafts(db, { workspaceId: access.workspaceId, messageId });
  const links = drafts.map(
    (id) => `→ [${t["shots.reply.review"]}](${origin}/w/${access.slug}/shots/${id})`,
  );
  return [t["shots.discord.already"], ...links].join("\n");
}

/**
 * One request to the interactions route. The body is the raw text Discord signed. A command from an
 * officer with pictures not sent before gets the deferred reply and a `job` for after the response; a
 * Translate command or Post gets a `translation`. `origin` is the app's, for the review links; `bot`
 * says whether the bot token is set (D101).
 */
export async function handleInteraction(
  db: Db,
  publicKey: string | undefined,
  request: { body: string; signature: string | null; timestamp: string | null },
  now: Date,
  origin: string,
  bot: boolean,
): Promise<Handled> {
  if (!verifySignature(publicKey, request.signature, request.timestamp, request.body)) {
    return { status: 401, body: { code: "bad_signature" } };
  }
  // A signed request replayed later is refused: its timestamp must be within 5 minutes of now.
  if (Math.abs(now.getTime() / 1000 - Number(request.timestamp)) > MAX_SKEW_S) {
    return { status: 401, body: { code: "stale_signature" } };
  }
  const interaction = parse(request.body);
  if (!interaction) return { status: 400, body: { code: "bad_request" } };
  if (interaction.type === PING) return { status: 200, body: { type: PONG } };
  if (interaction.type === MESSAGE_COMPONENT) return translatePress(db, interaction, now, bot);
  const which = commandOf(interaction);
  if (which === "import") return command(db, interaction, now, origin);
  if (!which) return { status: 400, body: { code: "unknown_command" } };
  const target = {
    messageId: interaction.data?.target_id ?? "",
    content: targetMessage(interaction)?.content ?? "",
  };
  const input = translateInput(interaction, bot);
  return { status: 200, ...(await translateCommand(db, which, input, target, now)) };
}

/** What the Translate steps read from an interaction. */
const translateInput = (i: Interaction, bot: boolean) => ({
  guildId: i.guild_id,
  channelId: i.channel_id,
  userId: i.member?.user.id,
  locale: i.locale,
  permissions: i.member?.permissions,
  webhook: { applicationId: i.application_id, token: i.token },
  bot,
});

/** Who opened the picker a press came from: only a private message the app sent counts. */
function pickerOwner(i: Interaction): string | undefined {
  const shown = i.message;
  if (!shown || ((shown.flags ?? 0) & EPHEMERAL) === 0) return undefined;
  return shown.interaction_metadata?.user.id ?? shown.interaction?.user.id;
}

/** A press in the "Translate for everyone" picker; the text is the one the picker shows. */
async function translatePress(db: Db, i: Interaction, now: Date, bot: boolean): Promise<Handled> {
  const press = {
    customId: i.data?.custom_id ?? "",
    values: i.data?.values,
    shownText: i.message?.embeds?.[0]?.description,
    owner: pickerOwner(i),
  };
  const answer = await translateComponent(db, translateInput(i, bot), press, now);
  return answer ? { status: 200, ...answer } : { status: 400, body: { code: "unknown_command" } };
}

/** Our command, signature checked: who sent it, which pictures, and whether they were sent before. */
async function command(
  db: Db,
  interaction: Interaction,
  now: Date,
  origin: string,
): Promise<Handled> {
  const language = pickWorkspaceLanguage(undefined, interaction.locale ?? null);
  const t = WORKSPACE_DICTIONARIES[language];
  const officer = await officerOf(db, interaction, now);
  if ("refused" in officer) {
    privateLog("w.import.discord_refused");
    return reply(t[officer.refused]);
  }
  const message = targetMessage(interaction);
  const pictures = (message?.attachments ?? []).filter(isPicture);
  const messageId = interaction.data?.target_id;
  if (!message || !messageId || pictures.length === 0) return reply(t["shots.discord.noPicture"]);
  // INVARIANT import.discord-once: a (message, attachment) is read once per workspace; the claim is
  // atomic, so two officers running the command at once make one set of drafts.
  const access = officer.access;
  const claimed = await claimPictures(
    db,
    { workspaceId: access.workspaceId, messageId },
    pictures.map((p) => p.id),
    now,
    new Date(now.getTime() - DRAFT_DAYS * DAY_MS),
  );
  if (claimed.length === 0) {
    privateLog("w.import.discord_repeat", { workspace: access.workspaceId });
    return reply(await alreadySent(db, access, messageId, t, origin));
  }
  const webhook = { applicationId: interaction.application_id, token: interaction.token };
  return {
    status: 200,
    body: { type: DEFERRED_REPLY, data: { flags: EPHEMERAL } },
    job: {
      access,
      language,
      pictures: pictures.filter((p) => claimed.includes(p.id)),
      messageId,
      postedAt: new Date(message.timestamp),
      webhook,
    },
  };
}

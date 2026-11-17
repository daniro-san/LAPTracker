// Discord's "Apps → Send to LAPTracker" message command (issue 299, D96). Discord posts each use to one
// public route: the Ed25519 signature is checked with the app's Public Key, a PING is answered, and the
// person must pass the workspace's own rule (its server's leadership roles, or the allowlist), the same as
// the sign-in (D71). Discord wants an answer within 3 s: the route answers "thinking…" visible only to the
// sender, and the reading runs after the response (`later`), then edits that reply (import-discord.ts).
import { createPublicKey, verify } from "node:crypto";

import { z } from "zod";

import type { Db } from "../db";
import { IMPORT_COMMAND } from "../import-command";
import { findWorkspaceByGuild, recordOfficer } from "../repo/import";
import { findWorkspaceUser } from "../repo/workspaces";
import { officerAccess, type WorkspaceAccess } from "./access";
import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  type WorkspaceLanguage,
} from "./dictionary";
import { privately } from "./http";
import { privateLog } from "./log";
import { refusalOf } from "./sign-in";

/** Discord's interaction and response types used here. */
const PING = 1;
const APPLICATION_COMMAND = 2;
const PONG = 1;
const REPLY = 4;
const DEFERRED_REPLY = 5;
/** A reply only the person who used the command sees. */
const EPHEMERAL = 64;
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
  locale: z.string().optional(),
  member: z
    .object({
      nick: z.string().nullish(),
      roles: z.array(z.string()),
      user: z.object({ id: z.string(), username: z.string(), global_name: z.string().nullish() }),
    })
    .optional(),
  data: z
    .object({
      name: z.string(),
      type: z.number(),
      target_id: z.string().optional(),
      resolved: z
        .object({
          messages: z
            .record(
              z.string(),
              z.object({ timestamp: z.string(), attachments: z.array(attachmentSchema) }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
type Interaction = z.infer<typeof interactionSchema>;

/** What the reading after the response needs: who, where, which pictures, and the reply to edit. */
export interface Job {
  access: WorkspaceAccess;
  language: WorkspaceLanguage;
  pictures: Attachment[];
  /** When the message with the pictures was posted. */
  postedAt: Date;
  /** The interaction's webhook: application id and token, to edit the "thinking…" reply. */
  webhook: { applicationId: string; token: string };
}

export type Handled =
  { status: 200; body: unknown; job?: Job } | { status: 400 | 401; body: { code: string } };

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

const isOurCommand = (i: Interaction) =>
  i.type === APPLICATION_COMMAND &&
  i.data?.type === IMPORT_COMMAND.type &&
  i.data.name === IMPORT_COMMAND.name;

/** The message the command was used on, as Discord sends it resolved. */
const targetMessage = (i: Interaction) =>
  i.data?.target_id ? i.data.resolved?.messages?.[i.data.target_id] : undefined;

/**
 * One request to the interactions route. The body is the raw text Discord signed. A command from an
 * officer with pictures gets the deferred reply and a `job` for after the response.
 */
export async function handleInteraction(
  db: Db,
  publicKey: string | undefined,
  request: { body: string; signature: string | null; timestamp: string | null },
  now: Date,
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
  if (!isOurCommand(interaction)) return { status: 400, body: { code: "unknown_command" } };
  const language = pickWorkspaceLanguage(undefined, interaction.locale ?? null);
  const t = WORKSPACE_DICTIONARIES[language];
  const officer = await officerOf(db, interaction, now);
  if ("refused" in officer) {
    privateLog("w.import.discord_refused");
    return reply(t[officer.refused]);
  }
  const message = targetMessage(interaction);
  const pictures = (message?.attachments ?? []).filter(isPicture);
  if (!message || pictures.length === 0) return reply(t["shots.discord.noPicture"]);
  const webhook = { applicationId: interaction.application_id, token: interaction.token };
  return {
    status: 200,
    body: { type: DEFERRED_REPLY, data: { flags: EPHEMERAL } },
    job: {
      access: officer.access,
      language,
      pictures,
      postedAt: new Date(message.timestamp),
      webhook,
    },
  };
}

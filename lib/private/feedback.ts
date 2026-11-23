// "Send feedback" (D157, issue 713): an officer on the desk, or an officer or member on the board, sends the
// site's owner an idea, a problem or something good. Collect only: nothing comes back to the sender. Who sent
// it is never stored, and the IP only as an HMAC in a day counter. The text goes through redactPrivate
// before it is stored, and never to a log, PostHog, AI or Discord. A send may carry one picture (D157
// amended 2026-11-22), checked by D119's checkPicture and kept with its row; it goes nowhere else either.
import { createHash, createHmac } from "node:crypto";

import { z } from "zod";

import type { Db } from "../db";
import { FEEDBACK_AREAS, FEEDBACK_KINDS } from "../feedback-words";
import { redactPrivate } from "../redact";
import { DAY_KEY_PREFIX, recordFailure } from "../repo/auth-attempts";
import { feedbackLimitKey, insertFeedback, type FeedbackPictureRow } from "../repo/feedback";
import { WORKSPACE_LANGUAGES } from "./dictionary";
import { checkPicture, type PictureRefusal } from "./notice-picture";
import { MAX_PICTURE_BYTES } from "./notice-picture-rules";

/** The text's limit, in characters, as the sheet counts them. */
export const FEEDBACK_MAX = 1000;
/** Per IP hash and per workspace, in a day from the first send. */
export const PER_IP_DAY = 5;
export const PER_WORKSPACE_DAY = 20;
const DAY_MS = 24 * 60 * 60_000;
/** The picture as base64 in the JSON body: at most 400 KB of bytes once decoded. */
const PICTURE_BASE64_MAX = Math.ceil(MAX_PICTURE_BYTES / 3) * 4;
/** The most a send's body may weigh: the picture's base64 and room for the rest. */
export const FEEDBACK_BODY_MAX = PICTURE_BASE64_MAX + 16 * 1024;

export const FEEDBACK_SEND = z
  .object({
    area: z.enum(FEEDBACK_AREAS),
    kind: z.enum(FEEDBACK_KINDS),
    text: z.string().trim().min(1).max(FEEDBACK_MAX),
    // The page's own path, never its query (a search may hold a name).
    path: z
      .string()
      .max(200)
      .regex(/^\/w\/[a-z0-9-]+(?:\/[A-Za-z0-9._~-]+)*$/),
    language: z.enum(WORKSPACE_LANGUAGES),
    // The honeypot: hidden from people, filled by form-filling bots.
    website: z.string().max(200),
    // One picture, already resized and re-encoded in the browser (D119); checked again here.
    picture: z
      .string()
      .max(PICTURE_BASE64_MAX)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/)
      .optional(),
  })
  .strict();
export type FeedbackSend = z.infer<typeof FEEDBACK_SEND>;

/**
 * The IP as a day counter's key: an HMAC under the server's secret, labelled for this one use, so the key
 * cannot be turned back and serves nothing else.
 */
export const feedbackIpKey = (ip: string, secret: string) => {
  const mac = createHmac("sha256", secret).update(`feedback-ip:${ip}`).digest("hex");
  return `${DAY_KEY_PREFIX}feedback:ip:${mac.slice(0, 32)}`;
};

/** The send's picture after D119's check: its row, a refusal's code, or null without one. */
function checkedPicture(picture: string | undefined): FeedbackPictureRow | PictureRefusal | null {
  if (picture === undefined) return null;
  const bytes = Buffer.from(picture, "base64");
  const checked = checkPicture(bytes);
  if (!checked.ok) return checked.code;
  const { type, width, height } = checked;
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return { data: bytes, type, width, height, bytes: bytes.length, hash };
}

export interface FeedbackSender {
  workspaceId: number;
  slug: string;
  tier: "officer" | "member";
}

/**
 * Stores one send. `bad`: the path is not this workspace's. A picture D119's check refuses answers its code
 * (wrong_type, too_large…) before anything is counted. `too_many`: the IP hash sent PER_IP_DAY or the
 * workspace PER_WORKSPACE_DAY in the day already; nothing stored. A filled honeypot answers `ok` and stores
 * and counts nothing, so a bot learns nothing. The IP is counted first, so one address over its limit never
 * uses up the workspace's.
 */
export async function sendFeedback(
  db: Db,
  from: FeedbackSender,
  input: FeedbackSend,
  ip: { address: string; secret: string },
  now: Date,
): Promise<"ok" | "bad" | "too_many" | PictureRefusal> {
  const own = `/w/${from.slug}`;
  if (input.path !== own && !input.path.startsWith(`${own}/`)) return "bad";
  // INVARIANT feedback.honeypot: a filled hidden field stores and counts nothing.
  if (input.website !== "") return "ok";
  const picture = checkedPicture(input.picture);
  if (typeof picture === "string") return picture;
  if ((await recordFailure(db, feedbackIpKey(ip.address, ip.secret), DAY_MS, now)) > PER_IP_DAY)
    return "too_many";
  if (
    (await recordFailure(db, feedbackLimitKey(from.workspaceId), DAY_MS, now)) > PER_WORKSPACE_DAY
  )
    return "too_many";
  // INVARIANT feedback.no-sender: the area, kind, text, page, language, workspace and tier; never who.
  await insertFeedback(
    db,
    {
      area: input.area,
      kind: input.kind,
      // INVARIANT feedback.redacted: a private roster value pasted in is stored as `…` (D115).
      text: redactPrivate(input.text),
      path: input.path,
      language: input.language,
      workspaceId: from.workspaceId,
      tier: from.tier,
      createdAt: now,
    },
    picture,
  );
  return "ok";
}

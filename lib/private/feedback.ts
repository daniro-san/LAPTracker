// "Send feedback" (D155, issue 713): an officer on the desk, or an officer or member on the board, sends the
// site's owner an idea, a problem or something good. Collect only: nothing comes back to the sender. Who sent
// it is never stored, and the IP only as an HMAC in a day counter. The text goes through redactPrivate
// before it is stored, and never to a log, PostHog, AI or Discord.
import { createHmac } from "node:crypto";

import { z } from "zod";

import type { Db } from "../db";
import { redactPrivate } from "../redact";
import { DAY_KEY_PREFIX, recordFailure } from "../repo/auth-attempts";
import { feedbackLimitKey, insertFeedback } from "../repo/feedback";
import { FEEDBACK_AREAS, FEEDBACK_KINDS } from "../schema-feedback";
import { WORKSPACE_LANGUAGES } from "./dictionary";

/** The text's limit, in characters, as the sheet counts them. */
export const FEEDBACK_MAX = 1000;
/** Per IP hash and per workspace, in a day from the first send. */
export const PER_IP_DAY = 5;
export const PER_WORKSPACE_DAY = 20;
const DAY_MS = 24 * 60 * 60_000;

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

export interface FeedbackSender {
  workspaceId: number;
  slug: string;
  tier: "officer" | "member";
}

/**
 * Stores one send. `bad`: the path is not this workspace's. `too_many`: the IP hash sent PER_IP_DAY or the
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
): Promise<"ok" | "bad" | "too_many"> {
  const own = `/w/${from.slug}`;
  if (input.path !== own && !input.path.startsWith(`${own}/`)) return "bad";
  // INVARIANT feedback.honeypot: a filled hidden field stores and counts nothing.
  if (input.website !== "") return "ok";
  if ((await recordFailure(db, feedbackIpKey(ip.address, ip.secret), DAY_MS, now)) > PER_IP_DAY)
    return "too_many";
  if (
    (await recordFailure(db, feedbackLimitKey(from.workspaceId), DAY_MS, now)) > PER_WORKSPACE_DAY
  )
    return "too_many";
  // INVARIANT feedback.no-sender: the area, kind, text, page, language, workspace and tier; never who.
  await insertFeedback(db, {
    area: input.area,
    kind: input.kind,
    // INVARIANT feedback.redacted: a private roster value pasted in is stored as `…` (D115).
    text: redactPrivate(input.text),
    path: input.path,
    language: input.language,
    workspaceId: from.workspaceId,
    tier: from.tier,
    createdAt: now,
  });
  return "ok";
}

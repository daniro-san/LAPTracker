// The Discord Translate commands' limits (D101): the text a message may have (length, letters once masked)
// and how many languages one person and the whole app may have translated, counted in units before the
// translator is called. The counters are `auth_attempts` rows: the person's keyed by a hash of their id.
import { createHash } from "node:crypto";

import type { Db } from "../db";
import { currentCount, DAY_KEY_PREFIX, recordFailure } from "../repo/auth-attempts";
import { fill } from "../words";
import type { Allowance } from "../workspace-features";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import { useAllowance, type WithFeatures } from "./features";
import { privateLog } from "./log";
import { mask, MAX_TRANSLATE_CHARS } from "./translate-message";

/** Languages one person may have translated in a minute (one unit per language asked). */
export const TRANSLATE_PER_MINUTE = 5;
/**
 * Languages the whole app may have translated in a day. Groq's free tier allows 1,000 requests a day per
 * model; a language is one request, or up to two on each model with the untranslated retry (D81).
 */
export const TRANSLATE_PER_DAY = 300;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DAY_KEY = `${DAY_KEY_PREFIX}translate`;

/** The per-person key: a hash, so the person's Discord id is not what the table keeps. */
const personKey = (userId: string) =>
  `translate:${createHash("sha256").update(userId).digest("hex").slice(0, 32)}`;

/**
 * Counts `units` (languages) for the person and the day, and against the workspace's own daily allowance
 * when given (D126), or says which limit they would pass: then nothing is counted. The workspace's count
 * is the last check, made and counted in one statement.
 */
export async function quota(
  db: Db,
  userId: string,
  units: number,
  now: Date,
  workspace?: { ws: WithFeatures; allowance: Allowance },
) {
  const person = personKey(userId);
  if ((await currentCount(db, person, MINUTE_MS, now)) + units > TRANSLATE_PER_MINUTE) {
    privateLog("discord.translate.limited");
    return "person" as const;
  }
  if ((await currentCount(db, DAY_KEY, DAY_MS, now)) + units > TRANSLATE_PER_DAY) {
    privateLog("discord.translate.paused");
    return "day" as const;
  }
  if (workspace && (await useAllowance(db, workspace.ws, workspace.allowance, units, now)) !== "ok")
    return "cap" as const;
  await recordFailure(db, person, MINUTE_MS, now, units);
  await recordFailure(db, DAY_KEY, DAY_MS, now, units);
  return "ok" as const;
}

export const quotaLine = (t: WorkspaceDictionary, refused: "person" | "day" | "cap") =>
  refused === "cap"
    ? t["features.cap.translate"]
    : refused === "day"
      ? t["translate.discord.paused"]
      : fill(t["translate.discord.tooMany"], { limit: TRANSLATE_PER_MINUTE });

/** The message's text, checked and masked; or the line that says why it cannot be translated. */
export function checkedText(
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  content: string,
): { text: string; kept: string[] } | { refused: string } {
  const text = content.trim();
  if (text.length > MAX_TRANSLATE_CHARS) {
    const n = new Intl.NumberFormat(language);
    return {
      refused: fill(t["translate.discord.tooLong"], {
        count: n.format(text.length),
        limit: n.format(MAX_TRANSLATE_CHARS),
      }),
    };
  }
  const masked = mask(text);
  // Only mentions, links, emoji, numbers: nothing for the model.
  if (!/\p{L}/u.test(masked.text)) return { refused: t["translate.discord.noText"] };
  return masked;
}

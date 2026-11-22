// Alliance settings → Your line on our posts (#713, D156): one line per post an alliance can get from us,
// written by an officer, at most 120 graphemes, never translated, posted above our title (lib/post-callout.ts
// makes it safe for Discord). Only while `post_callouts` is on (D134): off, the card is hidden, saves are
// refused and posts carry no line, and the saved lines stay. The text never reaches a log, an AI request,
// push, a public page or analytics.
import { z } from "zod";

import { SHIELD_POST, SHIELD_LANGUAGES, type ShieldLanguage } from "../copy-shield";
import type { Db } from "../db";
import { CALLOUT_LIMIT, calloutLength, cleanCallout, discordCallout } from "../post-callout";
import { recordFailure } from "../repo/auth-attempts";
import { calloutOf, calloutsOf, saveCallout } from "../repo/post-touches";
import { POST_KEYS, type PostKey } from "../schema-discord";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import { featureOn } from "./features";

/** At most this many saves per 15 minutes per workspace: far above a person changing a line. */
const SAVES = 30;
const WINDOW_MS = 15 * 60_000;

/** The raw text is bounded at the boundary; its length in graphemes is checked once cleaned. */
export const calloutInput = z
  .object({ post: z.enum(POST_KEYS), callout: z.string().max(CALLOUT_LIMIT * 8) })
  .strict();
export type CalloutInput = z.infer<typeof calloutInput>;

/** Each post's line and the first line of the post it goes above, for the card's preview. */
export interface CalloutView {
  post: PostKey;
  callout: string;
  /** Our post's title as the next post opens with it, without its bold marks. */
  title: string;
}

/** The posts this alliance can get: the Raid Shield summary only with the check on, garrison with its tab. */
function postsOf(access: WorkspaceAccess): PostKey[] {
  return POST_KEYS.filter(
    (p) =>
      (p !== "shield" || featureOn(access, "shield_check")) &&
      (p !== "garrison" || featureOn(access, "garrison")),
  );
}

/** The Raid Shield summary's title in the language the officers picked for it (D137). */
function shieldTitle(language: WorkspaceLanguage | null) {
  const lang = language as ShieldLanguage;
  return SHIELD_POST[SHIELD_LANGUAGES.includes(lang) ? lang : "en"].title.replaceAll("*", "");
}

/**
 * The card's rows; null while `post_callouts` is off. `shieldLanguage` is the Raid Shield card's own
 * setting, which the page has already read (null while the check is off: no shield row then).
 */
export async function calloutsView(
  db: Db,
  access: WorkspaceAccess,
  t: WorkspaceDictionary,
  shieldLanguage: WorkspaceLanguage | null,
): Promise<CalloutView[] | null> {
  if (!featureOn(access, "post_callouts")) return null;
  const saved = await calloutsOf(db, access.workspaceId);
  const titles: Record<PostKey, string> = {
    shield: shieldTitle(shieldLanguage),
    thanks: t["share.discord.title"],
    garrison: t["switches.name.garrison"],
  };
  return postsOf(access).map((post) => ({
    post,
    callout: saved.get(post) ?? "",
    title: titles[post],
  }));
}

export type CalloutResult =
  | { ok: true; callout: string; changed: boolean }
  | { ok: false; code: "turned_off" | "too_long" | "rate_limited" };

export async function saveCalloutFor(
  db: Db,
  access: WorkspaceAccess,
  input: CalloutInput,
  now: Date,
): Promise<CalloutResult> {
  if (!featureOn(access, "post_callouts")) return { ok: false, code: "turned_off" };
  const callout = cleanCallout(input.callout);
  if (calloutLength(callout) > CALLOUT_LIMIT) return { ok: false, code: "too_long" };
  const tries = await recordFailure(db, `callout:ws:${access.workspaceId}`, WINDOW_MS, now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  const changed = await saveCallout(db, {
    workspaceId: access.workspaceId,
    post: input.post,
    callout,
    by: access.user.id,
    at: now,
  });
  return { ok: true, callout, changed };
}

/**
 * The line a desk post (weekly thanks, garrison) opens with, already made safe for Discord (escaped, linking
 * and pinging no one), so a caller cannot forget it; "" while `post_callouts` is off or none is saved.
 */
export async function postCallout(db: Db, access: WorkspaceAccess, post: PostKey) {
  if (!featureOn(access, "post_callouts")) return "";
  return discordCallout(await calloutOf(db, access.workspaceId, post));
}

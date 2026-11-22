// Alliance settings → Your line on our posts (#713, D156): one line per post an alliance can get from us,
// written by an officer, at most 120 graphemes, never translated, posted above our title (lib/post-callout.ts
// makes it safe for Discord). Only while `post_callouts` is on (D134): off, the card is hidden, saves are
// refused and posts carry no line, and the saved lines stay. The text never reaches a log, an AI request,
// push, a public page or analytics.
import { z } from "zod";

import { SHIELD_POST, SHIELD_LANGUAGES, type ShieldLanguage } from "../copy-shield";
import type { Db } from "../db";
import { CALLOUT_LIMIT, calloutLength, cleanCallout } from "../post-callout";
import { recordFailure } from "../repo/auth-attempts";
import { calloutOf, calloutsOf, saveCallout } from "../repo/post-touches";
import { shieldSettingsOf } from "../repo/shield-checks";
import { POST_KEYS, type PostKey } from "../schema-discord";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary } from "./dictionary";
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
async function shieldTitle(db: Db, access: WorkspaceAccess) {
  const lang = (await shieldSettingsOf(db, access.workspaceId))?.language as ShieldLanguage;
  const words = SHIELD_POST[SHIELD_LANGUAGES.includes(lang) ? lang : "en"];
  return words.title.replaceAll("*", "");
}

/** The card's rows; null while `post_callouts` is off. */
export async function calloutsView(
  db: Db,
  access: WorkspaceAccess,
  t: WorkspaceDictionary,
): Promise<CalloutView[] | null> {
  if (!featureOn(access, "post_callouts")) return null;
  const [saved, shield] = await Promise.all([
    calloutsOf(db, access.workspaceId),
    shieldTitle(db, access),
  ]);
  const titles: Record<PostKey, string> = {
    shield,
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

/** The line a desk post (weekly thanks, garrison) opens with: "" while `post_callouts` is off. */
export const postCallout = (db: Db, access: WorkspaceAccess, post: PostKey) =>
  featureOn(access, "post_callouts")
    ? calloutOf(db, access.workspaceId, post)
    : Promise.resolve("");

// "Post to Discord" for a garrison plan (D121): the plan as officers left it (else the suggestion) goes to
// the channel the officer chose, the members' (the default) or the leaders', through the notices' webhook
// code (D102), once per request id (D100), with no mention allowed. The text carries names and squad might
// only (D71, D76); the log, codes and counts.
import type { Db } from "../db";
import { discordCallout } from "../post-callout";
import { claimPost, ensurePlan, findPlan, finishPost, type GarrisonRow } from "../repo/garrison";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import { garrisonView, type GarrisonInput } from "./garrison";
import { garrisonText, shareWordsOf } from "./garrison-words";
import { privateLog } from "./log";
import { discordMessages } from "./notice-formats";
import { postMessages, STUCK_MS, type Channels } from "./notice-publish";
import { postCallout } from "./post-callouts";

export type PostResult =
  | { ok: true; at: Date; rev: number }
  | {
      ok: false;
      code: "not_found" | "no_enemy_might" | "not_saved" | "not_set_up" | "posting" | "failed";
    };

export interface PostDeps {
  fetch: typeof fetch;
  now: Date;
  channels: Channels;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}

/** An earlier claim of this request id: what it came to. */
function earlier(row: GarrisonRow | null, requestId: string, now: Date): PostResult {
  if (row?.postRequestId !== requestId) return { ok: false, code: "posting" };
  if (row.postStatus === "posted" && row.postedAt)
    return { ok: true, at: row.postedAt, rev: row.rev };
  const at = row.postedAt?.getTime() ?? 0;
  const running = row.postStatus === "posting" && now.getTime() - at < STUCK_MS;
  return { ok: false, code: running ? "posting" : "failed" };
}

export async function postGarrison(
  db: Db,
  access: WorkspaceAccess,
  input: Extract<GarrisonInput, { action: "post" }>,
  deps: PostDeps,
): Promise<PostResult> {
  const read = await garrisonView(db, access, input.entry, input.week);
  if (!read) return { ok: false, code: "not_found" };
  const { view } = read;
  if (view.enemyMight === null) return { ok: false, code: "no_enemy_might" };
  // A value carried over from an earlier siege is not this siege's until an officer saves it.
  if (view.carriedFrom !== null) return { ok: false, code: "not_saved" };
  const channel = deps.channels[input.channel];
  if (!channel) return { ok: false, code: "not_set_up" };
  const siege = { workspaceId: access.workspaceId, entryId: input.entry, week: input.week };
  // A siege with no row yet gets an empty one, so the post has a row to claim.
  const row = read.row ?? (await ensurePlan(db, siege));
  if (!row) return { ok: false, code: "failed" };
  // INVARIANT garrison.post-once: a double tap or a retry with the same request id posts nothing more.
  const stuck = new Date(deps.now.getTime() - STUCK_MS);
  const post = { requestId: input.requestId, channel: input.channel, by: access.user.id };
  const claimed = await claimPost(db, row.id, post, deps.now, stuck);
  if (!claimed) return earlier(await findPlan(db, siege), input.requestId, deps.now);
  const words = shareWordsOf(view, deps.t, deps.language);
  const [title = "", ...head] = words.head;
  const text = garrisonText(view, { ...words, head }, deps.language);
  // D156: the alliance's own line above our title.
  const lead = discordCallout(await postCallout(db, access, "garrison"));
  const messages = discordMessages(title, [{ name: "", text }], !channel.forum, lead);
  const { sent } = await postMessages(deps.fetch, channel, title, messages);
  const done = sent === messages.length;
  await finishPost(db, row.id, input.requestId, done ? "posted" : "failed");
  privateLog(done ? "garrison.post" : "garrison.post.failed", {
    sent,
    of: messages.length,
    pairs: view.pairs.length,
  });
  return done ? { ok: true, at: deps.now, rev: row.rev } : { ok: false, code: "failed" };
}

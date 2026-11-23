// Alliance settings → Posts (#713 part C, D159): the catalog posts the owner allows this alliance, each with
// the alliance's own switch (off until officers turn it on), its channel, its day, its title, the language it
// is written in, and when the next one goes out in plain words. Officers only, after requireWorkspace; the
// title is officers' text, cleaned like a line (one line, nothing hidden) and at most 80 graphemes. It never
// reaches a log, an AI request or analytics.
import { z } from "zod";

import type { Db } from "../db";
import { calloutLength, cleanCallout } from "../post-callout";
import { POST_CATALOG, POST_TITLE_LIMIT } from "../post-catalog";
import { recordFailure } from "../repo/auth-attempts";
import { postsOf, savePost } from "../repo/workspace-posts";
import { serverInstant, serverMinuteOfDay, type ScheduleConfig } from "../schedule";
import {
  CATALOG_POSTS,
  POST_CHANNELS,
  type CatalogPost,
  type PostChannel,
} from "../schema-discord";
import { HEARTBEAT_EVERY_H } from "../tick-gate";
import type { WorkspaceAccess } from "./access";
import { addDays, hhmm } from "./calendar-time";
import { WORKSPACE_DICTIONARIES, WORKSPACE_LANGUAGES, type WorkspaceLanguage } from "./dictionary";
import type { WebhookView } from "./discord-webhooks";
import { featureOn } from "./features";

/** At most this many saves per 15 minutes per workspace: far above a person changing a post. */
const SAVES = 30;
const WINDOW_MS = 15 * 60_000;

/** The raw title is bounded at the boundary; its length in graphemes is checked once cleaned. */
export const postInput = z
  .object({
    post: z.enum(CATALOG_POSTS),
    on: z.boolean(),
    channel: z.enum(POST_CHANNELS),
    title: z.string().max(POST_TITLE_LIMIT * 8),
    language: z.enum(WORKSPACE_LANGUAGES),
  })
  .strict();
export type PostInput = z.infer<typeof postInput>;

export interface PostView {
  post: CatalogPost;
  on: boolean;
  channel: PostChannel;
  title: string;
  language: WorkspaceLanguage;
  /** Our title in each language the post can be written in: the title help follows the post's language. */
  defaultTitles: Record<WorkspaceLanguage, string>;
  /** The channels the post may go to, each with the name officers gave it (null: not set up). */
  channels: { channel: PostChannel; name: string | null }[];
  /** The post's server weekday in the officer's words ("Monday"), and the window its tick falls in (ST). */
  day: string;
  from: string;
  to: string;
}

const HOUR_MS = 3_600_000;

/**
 * The latest server time a post due at 00:00 ST goes out: the end of the first heartbeat slot at or after
 * it (D141: a tick opens the database every HEARTBEAT_EVERY_H hours, in their first 15 minutes, UTC).
 */
export function sendBy(cfg: Pick<ScheduleConfig, "SERVER_TZ">, day: string): string {
  const start = serverInstant(day, "00:00", cfg).getTime();
  const every = HEARTBEAT_EVERY_H * HOUR_MS;
  const slot = Math.ceil(start / every) * every;
  return hhmm(serverMinuteOfDay(new Date(slot + 15 * 60_000), cfg));
}

/** A day on the given weekday (0 = Monday), any week: the windows are the same every week. */
const sampleDay = (weekday: number) => addDays("2026-11-23", weekday);

/** The card's rows: the catalog posts the owner allows, as saved (off by default); null when none is. */
export async function postsView(
  db: Db,
  access: WorkspaceAccess,
  channels: WebhookView[],
  cfg: Pick<ScheduleConfig, "SERVER_TZ">,
  language: WorkspaceLanguage,
): Promise<PostView[] | null> {
  const allowed = CATALOG_POSTS.filter((p) => featureOn(access, POST_CATALOG[p].feature));
  if (allowed.length === 0) return null;
  const saved = await postsOf(db, access.workspaceId);
  const weekdays = new Intl.DateTimeFormat(language, { weekday: "long", timeZone: "UTC" });
  const nameOf = (c: PostChannel) => {
    const v = channels.find((x) => x.channel === c);
    return v && (v.state === "set" || v.state === "site") ? v.name : null;
  };
  return allowed.map((post) => {
    const entry = POST_CATALOG[post];
    const row = saved.get(post);
    const weekday = row?.weekday ?? entry.weekday;
    return {
      post,
      on: row?.on ?? false,
      channel: row?.channel ?? entry.audience,
      title: row?.title ?? "",
      language: (row?.language ?? "en") as WorkspaceLanguage,
      defaultTitles: Object.fromEntries(
        WORKSPACE_LANGUAGES.map((l) => [
          l,
          WORKSPACE_DICTIONARIES[l][`posts.${post}.defaultTitle`],
        ]),
      ) as Record<WorkspaceLanguage, string>,
      channels: entry.channels.map((c) => ({ channel: c, name: nameOf(c) })),
      day: weekdays.format(new Date(`${sampleDay(weekday)}T00:00:00Z`)),
      from: "00:00",
      to: sendBy(cfg, sampleDay(weekday)),
    };
  });
}

export type PostResult =
  | { ok: true; title: string; event: "turn_on" | "turn_off" | "save" | null }
  | { ok: false; code: "not_allowed" | "bad_channel" | "too_long" | "rate_limited" };

/**
 * One post's settings. not_allowed: the owner does not allow it (a stale page); bad_channel: a channel the
 * catalog does not offer for it. `event`: what the save did, for analytics: the switch turned on or off,
 * else any other change (`save`), else nothing (null: the same values again).
 */
export async function savePostFor(
  db: Db,
  access: WorkspaceAccess,
  input: PostInput,
  now: Date,
): Promise<PostResult> {
  const entry = POST_CATALOG[input.post];
  if (!featureOn(access, entry.feature)) return { ok: false, code: "not_allowed" };
  if (!entry.channels.includes(input.channel)) return { ok: false, code: "bad_channel" };
  const title = cleanCallout(input.title);
  if (calloutLength(title) > POST_TITLE_LIMIT) return { ok: false, code: "too_long" };
  const tries = await recordFailure(db, `posts:ws:${access.workspaceId}`, WINDOW_MS, now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  const values = {
    on: input.on,
    channel: input.channel,
    weekday: null,
    title,
    picture: false,
    language: input.language,
  };
  const saved = await savePost(db, {
    workspaceId: access.workspaceId,
    post: input.post,
    values,
    by: access.user.id,
    at: now,
  });
  if (!saved.written) return { ok: true, title, event: null };
  const wasOn = saved.before?.on ?? false;
  if (wasOn !== input.on) return { ok: true, title, event: input.on ? "turn_on" : "turn_off" };
  return { ok: true, title, event: "save" };
}

// Alliance settings → Posts (#713 part C, D159): the catalog posts the owner allows this alliance, each with
// the alliance's own switch (off until officers turn it on), its channel, its day, its title, the language it
// is written in, and when the next one goes out in plain words. Officers only, after requireWorkspace; the
// title is officers' text, cleaned like a line (one line, nothing hidden) and at most 80 graphemes. It never
// reaches a log, an AI request or analytics.
import { z } from "zod";

import type { Db } from "../db";
import { calloutLength, cleanCallout } from "../post-callout";
import { fromOf, POST_CATALOG, POST_TITLE_LIMIT } from "../post-catalog";
import { recordFailure } from "../repo/auth-attempts";
import { postsOf, savePost } from "../repo/workspace-posts";
import { serverInstant, serverMinuteOfDay, type ScheduleConfig } from "../schedule";
import {
  CATALOG_POSTS,
  POST_CHANNELS,
  type CatalogPost,
  type PostChannel,
} from "../schema-discord";
import { tickClockDue } from "../tick-gate";
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
  /**
   * The post's server weekday in the officer's words ("Monday"; null: every day), and the window its tick
   * falls in (ST).
   */
  day: string | null;
  from: string;
  to: string;
}

const QUARTER_MS = 15 * 60_000;

/**
 * The latest server time a post due from `from` on `day` goes out: the end of the first tick slot (:00, :15,
 * :30, :45 UTC) at or after it in which the clock alone opens the database (D141's `tickClockDue`: the
 * Friday check, the daily read, the event, the heartbeat every HEARTBEAT_EVERY_H hours). Monday 00:00 ST:
 * the 01:00 ST heartbeat, so 01:15; Friday 20:30 ST: the Friday check's last tick, so 20:45. The heartbeat
 * is always one of them, so the search ends within HEARTBEAT_EVERY_H hours.
 */
export function sendBy(cfg: ScheduleConfig, day: string, from: string): string {
  const start = Math.ceil(serverInstant(day, from, cfg).getTime() / QUARTER_MS) * QUARTER_MS;
  for (let t = start; ; t += QUARTER_MS) {
    if (tickClockDue(new Date(t), cfg))
      return hhmm(serverMinuteOfDay(new Date(t + QUARTER_MS), cfg));
  }
}

/** A day on the given weekday (0 = Monday), any week: the windows are the same every week. */
const sampleDay = (weekday: number) => addDays("2026-11-23", weekday);

/**
 * The end of a post's window on the card. A post due from the daily read (`read`) may go until 00:00 ST:
 * the read's automatic retry can come at any tick of its window before midnight (D72), and the period ends
 * then. Any other post: `sendBy`.
 */
const windowEnd = (post: CatalogPost, cfg: ScheduleConfig, weekday: number | null) =>
  POST_CATALOG[post].from === "read"
    ? "00:00"
    : sendBy(cfg, sampleDay(weekday ?? 0), fromOf(post, cfg));

/** The card's rows: the catalog posts the owner allows, as saved (off by default); null when none is. */
export async function postsView(
  db: Db,
  access: WorkspaceAccess,
  channels: WebhookView[],
  cfg: ScheduleConfig,
  language: WorkspaceLanguage,
): Promise<PostView[] | null> {
  const allowed = CATALOG_POSTS.filter((p) => featureOn(access, POST_CATALOG[p].feature));
  if (allowed.length === 0) return null;
  const saved = await postsOf(db, access.workspaceId);
  const weekdays = new Intl.DateTimeFormat(language, { weekday: "long", timeZone: "UTC" });
  // A daily post (no weekday) has no day name, and its window is the same every day.
  const dayName = (weekday: number | null) =>
    weekday === null ? null : weekdays.format(new Date(`${sampleDay(weekday)}T00:00:00Z`));
  const nameOf = (c: PostChannel) => {
    const v = channels.find((x) => x.channel === c);
    return v && (v.state === "set" || v.state === "site") ? v.name : null;
  };
  return allowed.map((post) => {
    const entry = POST_CATALOG[post];
    const row = saved.get(post);
    const weekday = row?.weekday ?? entry.weekday;
    const from = fromOf(post, cfg);
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
      day: dayName(weekday),
      from,
      to: windowEnd(post, cfg, weekday),
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

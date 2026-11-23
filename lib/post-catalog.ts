// The catalog of optional posts (#713 part C, D159): posts LAPTracker can make for an alliance on its own, a
// code table. Each post names its template (the key), when it is due, who it is for, the channels it may go
// to and the parts officers may change. Two layers (D134): the owner allows the post (its `feature`, allowed
// for new alliances by default), the alliance turns it on in Alliance settings → Posts (off until it does,
// `workspace_posts`). A post goes out at most once per period (`post_runs`), only in a tick that opens the
// database anyway (D141). Pure and browser-safe: the settings card reads it too.
import { hhmm } from "./calendar-time";
import { serverDay, serverMinuteOfDay, serverWeekday, type ScheduleConfig } from "./schedule";
import type { CatalogPost, PostChannel } from "./schema-discord";
import { NIGHT_MINUTE } from "./shield-check";
import type { Feature } from "./workspace-features";

/** The officers' title: at most this many graphemes, once cleaned like a line (lib/post-callout.ts). */
export const POST_TITLE_LIMIT = 80;

export interface CatalogEntry {
  /** The owner's layer (D134): /admin's switch and "Defaults for new alliances". */
  feature: Feature;
  /**
   * When it is due: on this server weekday (0 = Monday … 6 = Sunday), in the first tick that opens the
   * database that day, which on a Monday follows Sunday's end-of-day read (D72, D141).
   */
  weekday: number;
  /** The earliest server time ("HH:MM") it goes out that day: the first tick that opens the database from then. */
  from: string;
  /** Who reads it; the channel it goes to by default. */
  audience: PostChannel;
  /** The channels officers may pick. */
  channels: readonly PostChannel[];
  /** The parts officers may change besides the switch, the channel, the title, the language and the line. */
  editable: { weekday: boolean; picture: boolean };
}

export const POST_CATALOG: Record<CatalogPost, CatalogEntry> = {
  // 1. This week in the alliance: the week's calendar entries members can see, with server times. No people.
  week: {
    feature: "post_week",
    weekday: 0,
    from: "00:00",
    audience: "members",
    channels: ["members", "leaders"],
    editable: { weekday: false, picture: false },
  },
  // 2. Shield-up reminder: on Friday, 3 hours before the Raid Shield check's night read (23:30 ST, D137), a
  // reminder to the members to put their shield up before the raid at the reset. No names, no counts.
  // Due from 20:30 ST: the Friday check's tick (QUOTA_CHECK_AT, D141) opens the database then anyway.
  shield_up: {
    feature: "post_shield_up",
    weekday: 4,
    from: hhmm(NIGHT_MINUTE - 3 * 60),
    audience: "members",
    channels: ["members"],
    editable: { weekday: false, picture: false },
  },
};

/** The catalog's owner switches: shown in /admin, never in Alliance settings → Features (D159). */
export const POST_FEATURES: ReadonlySet<Feature> = new Set(
  Object.values(POST_CATALOG).map((p) => p.feature),
);

/** 0 = Monday … 6 = Sunday, server time. */
const weekdayAt = (now: Date, cfg: Pick<ScheduleConfig, "SERVER_TZ">) =>
  (serverWeekday(now, cfg) + 6) % 7;

/**
 * The period a post is due in at `now`: its server day ("2026-11-23") when `now` falls on it at or after the
 * post's `from`, else null.
 */
export function postPeriod(
  post: CatalogPost,
  now: Date,
  cfg: Pick<ScheduleConfig, "SERVER_TZ">,
): string | null {
  const entry = POST_CATALOG[post];
  const due =
    weekdayAt(now, cfg) === entry.weekday && hhmm(serverMinuteOfDay(now, cfg)) >= entry.from;
  return due ? serverDay(now, cfg) : null;
}

/** Whether any catalog post can be due at `now`, by the clock alone: no query before this holds. */
export const postsMayBeDue = (now: Date, cfg: Pick<ScheduleConfig, "SERVER_TZ">) =>
  (Object.keys(POST_CATALOG) as CatalogPost[]).some((p) => postPeriod(p, now, cfg) !== null);

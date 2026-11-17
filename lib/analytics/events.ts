// The custom events (D77): a closed list of names, and properties that are only closed lists of words, so no
// roster value, name or typed text can ride along (events.test.ts proves it at type level). Until PostHog has
// loaded, calls wait for it; when it never loads (previews, `next dev`, tests) or fails to, they do nothing. This module
// does not import posthog-js, so a page that only tracks never downloads it by itself.
import type { PostHog } from "posthog-js";

/** The workspace languages (D71); the same three as lib/private/dictionary.ts, which this module may not import. */
export type AnalyticsLanguage = "en" | "pt-BR" | "fr";
/**
 * The Members tab's filters (`MEMBER_FILTERS` in lib/private/members-list.ts, which this module may not import).
 * FilterChip passes that type here, so `tsc` fails if a filter is added there and not here.
 */
export type MemberFilter = "all" | "new" | "checkin" | "missing" | "r4";

/**
 * What a screenshot sent to the desk was read as (issue 299): `ImportKind` in lib/private/import-kinds.ts,
 * which this module may not import, plus a picture not recognised and a map. The desk passes that type
 * here, so `tsc` fails if a kind is added there and not here.
 */
export type ScreenshotKind =
  | "alliance_duel"
  | "donation"
  | "might"
  | "kills"
  | "secret_ops"
  | "member_update"
  | "damage_event"
  | "undead_mail"
  | "elixir_teams"
  | "unrecognised"
  | "map";

type NoProperties = Record<string, never>;

export interface AnalyticsEvents {
  ws_sign_in_completed: NoProperties;
  ws_first_use_done: NoProperties;
  ws_first_use_skipped: NoProperties;
  ws_copy_spreadsheet: NoProperties;
  ws_filter_used: { filter: MemberFilter };
  ws_language_switched: { language: AnalyticsLanguage };
  /** A notice's Translate filled drafts (D81); nothing about the text. */
  ws_notice_translated: NoProperties;
  /** One picture read from the desk's "Send screenshots": its type only, nothing it showed. */
  ws_screenshot_sent: { kind: ScreenshotKind };
  /** A draft saved: its type only. */
  ws_draft_saved: { kind: ScreenshotKind };
}
export type AnalyticsEvent = keyof AnalyticsEvents;

/** The URL fragment the sign-in callback adds after a successful sign-in, when analytics is on. */
export const SIGNED_IN_HASH = "#signed-in";

/** The PostHog key when analytics is on: the production deployment, with POSTHOG_KEY set (D77). */
export function analyticsKey(env: {
  VERCEL_ENV?: string | undefined;
  POSTHOG_KEY?: string | undefined;
  [name: string]: unknown;
}): string | undefined {
  return env.VERCEL_ENV === "production" && env.POSTHOG_KEY ? env.POSTHOG_KEY : undefined;
}

let started = false;
let client: PostHog | Promise<PostHog | null> | null = null;

/** Called by app/_ui/PostHogAnalytics.tsx; only the first call loads. A failed load leaves tracking a no-op. */
export function loadAnalytics(load: () => Promise<PostHog>): void {
  if (started) return;
  started = true;
  client = load().then(
    (ph) => (client = ph),
    () => (client = null),
  );
}

export function withPostHog(use: (ph: PostHog) => void): void {
  if (client instanceof Promise) void client.then((ph) => ph && use(ph));
  else if (client) use(client);
}

export function track<E extends AnalyticsEvent>(
  event: E,
  ...properties: AnalyticsEvents[E] extends NoProperties ? [] : [AnalyticsEvents[E]]
): void {
  withPostHog((ph) => ph.capture(event, properties[0] ?? {}));
}

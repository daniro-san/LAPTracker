// The custom events (D77): a closed list of names, and properties that are only closed lists of words, so no
// roster value, name or typed text can ride along (events.test.ts proves it at type level). Until PostHog has
// loaded, calls wait for it; when it never loads (previews, `next dev`, tests) they do nothing. This module
// does not import posthog-js, so a page that only tracks never downloads it by itself.
import type { PostHog } from "posthog-js";

/** The workspace languages (D71); the same three as lib/private/dictionary.ts, which this module may not import. */
export type AnalyticsLanguage = "en" | "pt-BR" | "fr";
/** The Members tab filters of issue #296. */
export type MemberFilter = "new" | "low_donations" | "missing_data" | "away" | "r4_plus";

type NoProperties = Record<string, never>;

export interface AnalyticsEvents {
  ws_sign_in_completed: NoProperties;
  ws_first_use_done: NoProperties;
  ws_first_use_skipped: NoProperties;
  ws_copy_spreadsheet: NoProperties;
  ws_filter_used: { filter: MemberFilter };
  ws_language_switched: { language: AnalyticsLanguage };
}
export type AnalyticsEvent = keyof AnalyticsEvents;

/** The URL fragment the sign-in callback adds after a successful sign-in (lib/private/sign-in.ts). */
export const SIGNED_IN_HASH = "#signed-in";

let client: PostHog | Promise<PostHog> | null = null;

/** Called once, by app/_ui/PostHogAnalytics.tsx, before any component can track. */
export function loadAnalytics(load: () => Promise<PostHog>): void {
  client ??= load().then((ph) => (client = ph));
}

export function withPostHog(use: (ph: PostHog) => void): void {
  if (client instanceof Promise) void client.then(use);
  else if (client) use(client);
}

export function track<E extends AnalyticsEvent>(
  event: E,
  ...properties: AnalyticsEvents[E] extends NoProperties ? [] : [AnalyticsEvents[E]]
): void {
  withPostHog((ph) => ph.capture(event, properties[0] ?? {}));
}

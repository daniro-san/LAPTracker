// The custom events (D77): a closed list of names, and properties that are only closed lists of words, so no
// roster value, name or typed text can ride along (events.test.ts proves it at type level). Until PostHog has
// loaded, calls wait for it; when it never loads (previews, `next dev`, tests) or fails to, they do nothing. This module
// does not import posthog-js, so a page that only tracks never downloads it by itself.
import type { PostHog } from "posthog-js";

/** The workspace languages (D71); the same three as lib/private/dictionary.ts, which this module may not import. */
export type AnalyticsLanguage = "en" | "pt-BR" | "fr";
/**
 * The Members list's filters and orders (issue 337, D98; lib/private/members-list.ts, which this module may not
 * import). Only the name is sent: never the hour, the language, the search text or the address.
 */
export type MemberFilter =
  | "r4"
  | "ask"
  | "who"
  | "daytime"
  | "night"
  | "language"
  | "order_rank"
  | "order_might"
  | "order_might_asc"
  | "order_kills"
  | "order_kills_asc"
  | "order_squad";

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

/** The members' board's sections (D105; `data-board-section` in BoardSections.tsx). */
export type BoardSection = "week" | "notices" | "start_here";

type NoProperties = Record<string, never>;

export interface AnalyticsEvents {
  ws_sign_in_completed: NoProperties;
  ws_first_use_done: NoProperties;
  ws_first_use_skipped: NoProperties;
  ws_copy_spreadsheet: NoProperties;
  ws_filter_used: { filter: MemberFilter };
  ws_language_switched: { language: AnalyticsLanguage };
  /** A member's facts saved from the card's editor (D80); nothing about the member or the values. */
  ws_facts_saved: NoProperties;
  /** A sheet imported once every row was matched or dismissed (D80). */
  ws_sheet_imported: NoProperties;
  /** A notice's Translate filled drafts (D81); nothing about the text. */
  ws_notice_translated: NoProperties;
  /** One picture read from the desk's "Send screenshots": its type only, nothing it showed. */
  ws_screenshot_sent: { kind: ScreenshotKind };
  /** A draft saved: its type only. */
  ws_draft_saved: { kind: ScreenshotKind };
  // D115, docs/analytics/tracking-plan.md: each answers one product question there.
  /** A draft discarded from its review: its type only. */
  ws_draft_discarded: { kind: ScreenshotKind };
  /** "Send screenshots" made no draft: no picture read (`read`), or the drafts' request failed (`drafts`). */
  ws_screenshot_failed: { stage: "read" | "drafts" };
  /** Members' "Paste updates" → Check: a draft made, no line with a name and a value, or the request failed. */
  ws_updates_pasted: { outcome: "draft" | "nothing" | "failed" };
  /** "Read from a screenshot" beside a paste box: where, and whether text came back. */
  ws_text_read: {
    place: "paste_updates" | "facts" | "garrison";
    outcome: "read" | "failed" | "busy";
  };
  /** A notice's "Fit to 1,000" filled a draft (D113). */
  ws_notice_fit: NoProperties;
  /** Translate, Improve writing or Fit gave no draft. */
  ws_notice_ai_failed: { action: "translate" | "improve" | "fit" };
  /** A review asked (D113): for the whole notice or one language, from the team or one officer. */
  ws_review_requested: { scope: "notice" | "language"; to: "team" | "officer" };
  ws_review_approved: NoProperties;
  /** "Publish to Discord" posted (D102): the notice's audience only. */
  ws_notice_published: { audience: "members" | "leaders" };
  /** A roll call mark stored: one tap, or "the rest" for everyone left (D103). */
  ws_roll_call_marked: { how: "tap" | "rest" };
  /** The weekly thanks shared (D114, issue 404): posted to the board or Discord, or copied for the game. */
  ws_thanks_shared: { to: "game" | "discord" | "board" };
  /** A members' board section came on screen, once per page load. */
  ws_board_section_viewed: { board_section: BoardSection };
  /** Alliance settings' Check found the bot in the alliance's Discord server for the first time (D129). */
  ws_bot_installed: NoProperties;
  /** A notice channel's webhook saved in Alliance settings (D129): which channel only, never the URL. */
  ws_webhook_set: { channel: "leaders" | "members" };
}
export type AnalyticsEvent = keyof AnalyticsEvents;

/** Every event above, at run time: events.test.ts checks this list against the type and the tracking plan. */
export const ANALYTICS_EVENTS = [
  "ws_sign_in_completed",
  "ws_first_use_done",
  "ws_first_use_skipped",
  "ws_copy_spreadsheet",
  "ws_filter_used",
  "ws_language_switched",
  "ws_facts_saved",
  "ws_sheet_imported",
  "ws_notice_translated",
  "ws_screenshot_sent",
  "ws_draft_saved",
  "ws_draft_discarded",
  "ws_screenshot_failed",
  "ws_updates_pasted",
  "ws_text_read",
  "ws_notice_fit",
  "ws_notice_ai_failed",
  "ws_review_requested",
  "ws_review_approved",
  "ws_notice_published",
  "ws_roll_call_marked",
  "ws_thanks_shared",
  "ws_board_section_viewed",
  "ws_bot_installed",
  "ws_webhook_set",
] as const satisfies readonly AnalyticsEvent[];

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

/**
 * The desk's or the board's person (D115): `id` is the pseudonymous id from lib/analytics/person.ts, the
 * properties only the tier and the slug. Again on every page load: nothing is stored on the device. Never on
 * a page load that started on a public page and moved to the desk, whatever the visitor answered: cookieless,
 * a lasting id would undo the mode; after "Allow", the officer would be tied to the id PostHog stores.
 */
export function identify(id: string, tier: "officer" | "member", workspace: string): void {
  withPostHog((ph) => {
    // Any page load that started on a public page: cookieless, or one whose visitor said "Allow". There
    // PostHog keeps an id on the device, and an officer's pseudonymous id must never be tied to it.
    if (ph.config.cookieless_mode) return;
    if (ph.get_distinct_id() !== id) ph.identify(id, { tier, workspace });
  });
}

/** The super properties that say which alliance an event came from (issue 452). */
export const WORKSPACE_PROPERTIES = ["workspace", "alliance"] as const;

/**
 * The desk's or the board's workspace (issue 452): its slug and its alliance's public tag ride on every later
 * event of this page load, until sign-out or a page outside it. Never on a page load that started on a public
 * page (as `identify`): its PostHog store may outlive the page load, and a cookieless one stays untouched.
 */
export function registerWorkspace(workspace: string, alliance: string | null): void {
  withPostHog((ph) => {
    if (!ph.config.cookieless_mode) ph.register({ workspace, alliance });
  });
}

/** Sign-out: the next events on this page load belong to no one and no workspace (D115, issue 452). */
export function forgetPerson(): void {
  withPostHog((ph) => {
    for (const property of WORKSPACE_PROPERTIES) ph.unregister(property);
    ph.reset();
  });
}

export function track<E extends AnalyticsEvent>(
  event: E,
  ...properties: AnalyticsEvents[E] extends NoProperties ? [] : [AnalyticsEvents[E]]
): void {
  withPostHog((ph) => ph.capture(event, properties[0] ?? {}));
}

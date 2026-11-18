// PostHog in the browser (D77), loaded only by app/_ui/PostHogAnalytics.tsx. The `no-external` build never
// loads a script from PostHog: exception capture is bundled here and the replay recorder is a chunk of our own,
// fetched the first time a page is recorded. Requests go to /ingest, our own origin (lib/analytics/ingest.ts).
//
// No device model, no campaign parameters, no query string or hash in a URL. Who is counted depends on where
// the page load starts (D115):
// - a public page: `cookieless_mode: "on_reject"`, answered by the visitor's choice (lib/analytics/consent.ts,
//   the bar in AnalyticsConsent.tsx). No answer or "No thanks": rejected (`opt_out_capturing_by_default`),
//   so PostHog's servers count the visitor by a daily-salted hash, nothing is stored and nothing is
//   recorded. "Allow": PostHog's cookie and local storage, and replay in PUBLIC_REPLAY_SAMPLE of page loads;
// - /w and /admin: `memory` persistence (no cookie or storage), a random id per page load, and replay. On the
//   desk and the board, AnalyticsPerson calls identify with a pseudonymous id (lib/analytics/person.ts).
//
// Replay (owner, D77): the workspace and /admin always, public pages in PUBLIC_REPLAY_SAMPLE of page loads,
// never while cookieless.
// What is masked follows the DOM, not the URL, so it holds across client-side navigations: the /w/[slug] and
// /admin layouts wrap their pages in MASK_CLASS, and under it every text, attribute (but styling and sizes),
// image and form field is masked or blocked. Public game data outside it stays readable. Every input value
// everywhere is replaced by the same three stars, so not even its length is kept.
import posthog, { type PostHog } from "posthog-js/no-external";
import "posthog-js/dist/exception-autocapture";

import { storeConsent, storedConsent, type Consent } from "./consent";
import { COOKIELESS_PREFIX, POSTHOG_UI_HOST } from "./region";
import { areaOf, MASK_CLASS, sanitiseEvent, withoutQuery } from "./sanitise";

/** Share of public page loads whose session is recorded; the free plan's recordings go to the workspace first. */
export const PUBLIC_REPLAY_SAMPLE = 0.25;

const MASK = `.${MASK_CLASS}`;
/** Styling, and the sizes rrweb writes for a blocked element so it replays as a box of the right size. */
const KEPT_ATTRIBUTES = new Set(["class", "style", "rr_width", "rr_height", "rr_left", "rr_top"]);
/** No click autocapture where per-member values are shown; the custom events cover the workspace. */
const NO_AUTOCAPTURE = /^[a-z]+:\/\/[^/]+\/(?:admin|w)(?:[/?#]|$)/;

const publicSampled = Math.random() < PUBLIC_REPLAY_SAMPLE;
let recorder: Promise<unknown> | null = null;
let recording = false;

/** A cookieless load sends to its own path, so the proxy adds the visitor's IP to those events only. */
const hostFor = (cookieless: boolean) => (cookieless ? `/ingest${COOKIELESS_PREFIX}` : "/ingest");

/** True while PostHog counts this page load by the daily hash: it then stores and records nothing. */
export function isCookieless(ph: PostHog): boolean {
  return Boolean(ph.config.cookieless_mode) && !ph.has_opted_in_capturing();
}

/** `key` is the project API key, public by design: it is in every page's HTML. */
export function startPostHog(key: string): PostHog {
  const publicLoad = areaOf(location.pathname).area === "public";
  const granted = publicLoad && storedConsent() === "granted";
  posthog.init(key, {
    api_host: hostFor(publicLoad && !granted),
    ui_host: POSTHOG_UI_HOST,
    persistence: publicLoad ? "localStorage+cookie" : "memory",
    ...(publicLoad && {
      cookieless_mode: "on_reject" as const,
      // No answer counts as "no": cookieless, nothing stored, until the visitor says yes.
      opt_out_capturing_by_default: true,
    }),
    // Profiles only for the desk's and the board's pseudonymous ids; every other event is personless.
    person_profiles: "identified_only",
    disableDeviceModel: true,
    save_campaign_params: false,
    disable_capture_url_hashes: true,
    capture_pageview: "history_change",
    autocapture: { url_ignorelist: [NO_AUTOCAPTURE] },
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    error_tracking: { exception_steps: { enabled: false } },
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: false,
    advanced_disable_feature_flags: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    // Started by followPath, never by the project setting alone.
    disable_session_recording: true,
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: true,
      maskInputFn: () => "***",
      maskTextSelector: MASK,
      blockSelector: [`${MASK} img`, `${MASK} input`, `${MASK} select`, `${MASK} textarea`].join(
        ", ",
      ),
      maskAllElementAttributes: false,
      maskAttributeFn: (name, value, element) =>
        element?.closest(MASK) && !KEPT_ATTRIBUTES.has(name) ? "" : value,
      maskCapturedNetworkRequestFn: (request) => ({ ...request, name: withoutQuery(request.name) }),
      recordHeaders: false,
      recordBody: false,
    },
    before_send: (event) => sanitiseEvent(event, location.pathname),
  });
  // PostHog keeps its own record of a "yes"; ours decides, so a cleared or partial store asks again.
  if (granted && !posthog.has_opted_in_capturing()) posthog.opt_in_capturing();
  return posthog;
}

/** The visitor answered the bar: kept on the device, and applied to this page load when it can be. */
export function answerConsent(ph: PostHog, consent: Consent): void {
  storeConsent(consent);
  // Only a public page load has the choice; a desk or /admin load keeps its own mode until the next load.
  if (ph.config.cookieless_mode !== "on_reject") return;
  if (consent === "granted") {
    ph.opt_in_capturing();
    ph.set_config({ api_host: hostFor(false) });
  } else {
    ph.opt_out_capturing();
    ph.set_config({ api_host: hostFor(true) });
    recording = false;
  }
  followPath(ph, location.pathname);
}

/** Records the page or not, by its area; called on the first page and on every client-side navigation. */
export function followPath(ph: PostHog, path: string): void {
  // Cookieless mode has no session, so it records nothing, whatever the area.
  const wanted = !isCookieless(ph) && (areaOf(path).area !== "public" || publicSampled);
  if (wanted === recording) return;
  recording = wanted;
  if (!wanted) {
    ph.stopSessionRecording();
    return;
  }
  recorder ??= import("posthog-js/dist/posthog-recorder");
  // `true` overrides PostHog's own sampling and triggers: this module decides what is recorded.
  void recorder.then(() => recording && ph.startSessionRecording(true));
}

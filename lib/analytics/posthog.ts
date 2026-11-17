// PostHog in the browser (D77), loaded only by app/_ui/PostHogAnalytics.tsx. The `no-external` build never
// loads a script from PostHog: exception capture is bundled here and the replay recorder is a chunk of our own,
// fetched the first time a page is recorded. Requests go to /ingest, our own origin (lib/analytics/ingest.ts).
//
// Nothing identifies the visitor: no identify, no person profile, no cookie or storage (`memory`: a new
// anonymous id per page load), no device model, no campaign parameters, no query string or hash in a URL.
//
// Replay (owner, D77): the workspace and /admin always, public pages in PUBLIC_REPLAY_SAMPLE of page loads.
// What is masked follows the DOM, not the URL, so it holds across client-side navigations: the /w/[slug] and
// /admin layouts wrap their pages in MASK_CLASS, and under it every text, attribute (but styling and sizes),
// image and form field is masked or blocked. Public game data outside it stays readable. Every input value
// everywhere is replaced by the same three stars, so not even its length is kept.
import posthog, { type PostHog } from "posthog-js/no-external";
import "posthog-js/dist/exception-autocapture";

import { POSTHOG_UI_HOST } from "./region";
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

/** `key` is the project API key, public by design: it is in every page's HTML. */
export function startPostHog(key: string): PostHog {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: POSTHOG_UI_HOST,
    persistence: "memory",
    person_profiles: "never",
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
  return posthog;
}

/** Records the page or not, by its area; called on the first page and on every client-side navigation. */
export function followPath(ph: PostHog, path: string): void {
  const wanted = areaOf(path).area !== "public" || publicSampled;
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

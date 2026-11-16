// PostHog's US cloud, the owner's choice (D77). The one place the region is named: the /ingest proxy and the
// browser SDK derive every PostHog host from it. Not configurable on purpose.
const POSTHOG_REGION = "us";

/** Events, replay snapshots and flags. */
export const POSTHOG_INGEST_HOST = `https://${POSTHOG_REGION}.i.posthog.com`;
/** Static files and the project's remote config (`/array/<key>/config`). */
export const POSTHOG_ASSETS_HOST = `https://${POSTHOG_REGION}-assets.i.posthog.com`;
/** The dashboard, for links the SDK builds (never requested by the browser). */
export const POSTHOG_UI_HOST = `https://${POSTHOG_REGION}.posthog.com`;

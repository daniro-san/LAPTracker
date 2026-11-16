"use client";
// PostHog (D77): page views, clicks, client errors, a few typed events and session replay. The root layout
// renders this on the production deployment only, and only when POSTHOG_KEY is set; anywhere else this module
// is never loaded and nothing is requested. The SDK is a separate chunk (lib/analytics/posthog.ts).
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { loadAnalytics, SIGNED_IN_HASH, track, withPostHog } from "@/lib/analytics/events";

const sdk = typeof window === "undefined" ? null : import("@/lib/analytics/posthog");
// Once per page load: Next's router can restore the first URL's hash on a later visit to the same path.
let signInCounted = false;

/** `apiKey`: the project key, public by design (it is in the page's HTML either way). */
export function PostHogAnalytics({ apiKey }: { apiKey: string }) {
  // Started during render, which comes before any component's effect: a sign-in event or a language switch on
  // the first page waits for PostHog instead of being dropped. loadAnalytics runs only once.
  if (sdk) loadAnalytics(() => sdk.then((m) => m.startPostHog(apiKey)));
  const pathname = usePathname();
  useEffect(() => {
    void sdk?.then((m) => withPostHog((ph) => m.followPath(ph, pathname)));
    if (location.hash === SIGNED_IN_HASH) {
      if (!signInCounted) track("ws_sign_in_completed");
      signInCounted = true;
      // `null`, as Next documents: Next then syncs its router, which would otherwise put the hash back.
      history.replaceState(null, "", location.pathname + location.search);
    }
  }, [pathname]);
  return null;
}

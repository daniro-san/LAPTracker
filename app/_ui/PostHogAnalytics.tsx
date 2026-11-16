"use client";
// PostHog (D77): page views, clicks, client errors, a few typed events and session replay. The root layout
// renders this on the production deployment only, and only when POSTHOG_KEY is set; anywhere else this module
// is never loaded and nothing is requested. The SDK is a separate chunk (lib/analytics/posthog.ts), fetched
// after the page's `load` event, when the browser is idle, so it never competes with the page itself.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { loadAnalytics, SIGNED_IN_HASH, track, withPostHog } from "@/lib/analytics/events";

type Sdk = typeof import("@/lib/analytics/posthog");
let sdk: Promise<Sdk | null> | null = null;
// Once per page load: Next's router can restore the first URL's hash on a later visit to the same path.
let signInCounted = false;

/** The SDK chunk, requested once after `load` and an idle moment; null when it fails to load. */
function loadSdk(): Promise<Sdk | null> {
  sdk ??= new Promise<void>((resolve) => {
    const idle = () =>
      "requestIdleCallback" in window
        ? requestIdleCallback(() => resolve(), { timeout: 3000 })
        : setTimeout(resolve, 1);
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
  })
    .then(() => import("@/lib/analytics/posthog"))
    .catch(() => null);
  return sdk;
}

/** `apiKey`: the project key, public by design (it is in the page's HTML either way). */
export function PostHogAnalytics({ apiKey }: { apiKey: string }) {
  // Registered during render, which comes before any component's effect: a sign-in event or a language switch
  // made before the SDK arrives waits for it instead of being dropped. loadAnalytics runs only once.
  if (typeof window !== "undefined") {
    loadAnalytics(() =>
      loadSdk().then((m) => {
        if (!m) throw new Error("PostHog did not load");
        return m.startPostHog(apiKey);
      }),
    );
  }
  const pathname = usePathname();
  useEffect(() => {
    void loadSdk().then((m) => m && withPostHog((ph) => m.followPath(ph, pathname)));
    if (location.hash === SIGNED_IN_HASH) {
      if (!signInCounted) track("ws_sign_in_completed");
      signInCounted = true;
      // `null`, as Next documents: Next then syncs its router, which would otherwise put the hash back.
      history.replaceState(null, "", location.pathname + location.search);
    }
  }, [pathname]);
  return null;
}

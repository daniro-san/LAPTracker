"use client";
// Insights' open set (issue 678): opening a set's names writes its key into the address fragment
// (`#who-<key>`, replaceState, no navigation), so after an officer opens a member's card from it and goes
// Back, the page opens that set again, with the folds around it, and shows it. Opening a set also counts
// `ws_drilldown_opened` (surface, kind and a count bucket), once per kind per page view, never a name, uid,
// exact count or range. The fragment never reaches analytics (`before_send` drops it) and holds only the
// set's key.
import { useEffect } from "react";

import { countBucket } from "@/lib/analytics/count-bucket";
import { track, type InsightsSet } from "@/lib/analytics/events";

const PREFIX = "who-";

/**
 * The open set's element id in the address fragment, or null. Compared raw, never decoded: the keys are
 * plain ASCII, and a fragment the page does not own (a stray "%" too) must not stop the page loading.
 */
export function openSetId(hash: string): string | null {
  const id = hash.slice(1);
  return id.startsWith(PREFIX) ? id : null;
}

/** What `ws_drilldown_opened` carries for an opened Insights set: the page, its kind, its size as a bucket. */
export const drilldownOf = (kind: InsightsSet, count: number) => ({
  surface: "insights" as const,
  kind,
  count_bucket: countBucket(count),
});

export function InsightsSetMemory() {
  useEffect(() => {
    const counted = new Set<string>();
    let restoring: HTMLDetailsElement | null = null;
    const id = openSetId(window.location.hash);
    const found = id ? document.getElementById(id) : null;
    if (found instanceof HTMLDetailsElement) {
      restoring = found;
      // A zone row sits inside the card's "Show the details": open every fold around it too.
      for (let d: Element | null = found; d; d = d.parentElement?.closest("details") ?? null)
        (d as HTMLDetailsElement).open = true;
      found.scrollIntoView({ block: "start" });
    }
    const onToggle = (e: Event) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || !d.id.startsWith(PREFIX)) return;
      const url = new URL(window.location.href);
      if (d.open) {
        url.hash = d.id;
        const kind = d.dataset.set as InsightsSet;
        // A set opened again after Back is not counted as a new open.
        if (d !== restoring && !counted.has(kind)) {
          counted.add(kind);
          track("ws_drilldown_opened", drilldownOf(kind, Number(d.dataset.count)));
        }
      } else if (url.hash === `#${d.id}`) url.hash = "";
      restoring = null;
      window.history.replaceState(window.history.state, "", url);
    };
    // `toggle` does not bubble: listen in the capture phase.
    document.addEventListener("toggle", onToggle, true);
    return () => document.removeEventListener("toggle", onToggle, true);
  }, []);
  return null;
}

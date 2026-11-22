"use client";
// Insights' open set (issue 678): opening a set's names writes its key into the address fragment
// (`#who-<key>`, replaceState, no navigation), so after an officer opens a member's card from it and goes Back, the page
// opens that set again, with the folds around it, and shows it. Opening a set also counts
// `ws_insights_set_opened` with its kind only, once per kind per page view (no name, uid or count). The
// fragment never reaches analytics (`before_send` drops it) and holds only the set's key.
import { useEffect } from "react";

import { track, type InsightsSet } from "@/lib/analytics/events";

const PREFIX = "who-";

export function InsightsSetMemory() {
  useEffect(() => {
    const counted = new Set<string>();
    let restoring: HTMLDetailsElement | null = null;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const found = id.startsWith(PREFIX) ? document.getElementById(id) : null;
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
          track("ws_insights_set_opened", { set: kind });
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

"use client";

// Names the desk's or the board's visitor to PostHog by a pseudonymous id (D115): the page renders this only
// when analytics is on, with the id made on the server (lib/analytics/person.ts). The workspace's slug and
// its alliance's tag go on every later event of the page load (issue 452). Renders nothing.
import { useEffect } from "react";

import { identify, registerWorkspace } from "@/lib/analytics/events";
import type { AnalyticsPersonProps } from "@/lib/analytics/person";

export function AnalyticsPerson({ id, tier, workspace, alliance }: AnalyticsPersonProps) {
  useEffect(() => {
    registerWorkspace(workspace, alliance);
    identify(id, tier, workspace);
  }, [id, tier, workspace, alliance]);
  return null;
}

"use client";

// Names the desk's or the board's visitor to PostHog by a pseudonymous id (D115): the page renders this only
// when analytics is on, with the id made on the server (lib/analytics/person.ts). Renders nothing.
import { useEffect } from "react";

import { identify } from "@/lib/analytics/events";
import type { AnalyticsPersonProps } from "@/lib/analytics/person";

export function AnalyticsPerson({ id, tier, workspace }: AnalyticsPersonProps) {
  useEffect(() => identify(id, tier, workspace), [id, tier, workspace]);
  return null;
}

"use client";
// A link from an Insights chart's row to its next level, a chart of that week's days in the same card (D158
// rule 7 (b)). It keeps the scroll position, and a tap counts `ws_drilldown_opened` (surface `insights`, the
// level's kind, a bucket of what the row counts), once per kind per page view, as a set opened in place is.
import Link from "next/link";
import type { ReactNode } from "react";

import type { InsightsLevel } from "@/lib/analytics/events";

import { countOpen } from "./InsightsSetMemory";

export function InsightsDrillLink(props: {
  href: string;
  kind: InsightsLevel;
  count: number;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={props.href}
      scroll={false}
      prefetch={false}
      onClick={() => countOpen(props.kind, props.count)}
      className={props.className}
    >
      {props.children}
    </Link>
  );
}

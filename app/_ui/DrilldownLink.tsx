"use client";

// A link from a public count to the people behind it (the drilldowns): the alliance page's member list,
// filtered or sorted. It counts the tap by where it was, what it opens and a bucket of the count, nothing more.
import Link from "next/link";
import type { ComponentProps } from "react";

import { countBucket } from "@/lib/analytics/count-bucket";
import {
  track,
  type PublicDrilldownKind,
  type PublicDrilldownSurface,
} from "@/lib/analytics/events";

export function DrilldownLink({
  surface,
  kind,
  count,
  ...link
}: ComponentProps<typeof Link> & {
  surface: PublicDrilldownSurface;
  kind: PublicDrilldownKind;
  count: number;
}) {
  return (
    <Link
      {...link}
      onClick={() => track("drilldown_opened", { surface, kind, count_bucket: countBucket(count) })}
    />
  );
}

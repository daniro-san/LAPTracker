"use client";

// Home's "4 already noted by officers ›" (drilldown batch C): opens Follow-up's "Noted this week", which lists
// exactly those members (both from `weekLists`). A tap counts `ws_drilldown_opened` with a bucket of n only.
import { countBucket } from "@/lib/analytics/count-bucket";
import { track } from "@/lib/analytics/events";

import { LINK } from "./BoardText";

export function HomeNotedLink(props: { slug: string; n: number; text: string }) {
  return (
    <a
      href={`/w/${props.slug}/follow-up#follow-up-noted`}
      onClick={() =>
        track("ws_drilldown_opened", {
          surface: "home",
          kind: "noted",
          count_bucket: countBucket(props.n),
        })
      }
      className={LINK}
    >
      {props.text}
      <span aria-hidden="true">&nbsp;›</span>
    </a>
  );
}

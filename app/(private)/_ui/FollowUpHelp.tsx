"use client";

// Follow-up's "How this list works" (issue 585 S3): D140's "what to do" line and D104's help line in one
// disclosure under the head's numbers, its summary saying, always in sight, that a name opens the member's
// panel (the officer panel: with one button per row, 5 of 6 did not find it). Open on an officer's first visit on this
// browser and closed after: the server decides from a cookie, so nothing moves once the page is drawn, and
// the cookie is written once the help was shown open, not while the first-use cards cover the page. Without
// cookies it opens on every visit.
import { useEffect, useState } from "react";

import { FOLLOW_UP_HELP_COOKIE } from "@/lib/private/cookies";

export function FollowUpHelp(props: {
  /** The cookie was there: the help was shown open on this browser before. */
  seen: boolean;
  /** The first-use cards cover the page (no `lap_ws_intro` yet): the help is open, but not seen. */
  covered: boolean;
  /** `tap`: always in sight, before the label: with one button per row, the name is the way to the panel. */
  words: { tap: string; head: string; lines: string[] };
}) {
  const { words, covered } = props;
  // As first drawn: a save's refresh reads the cookie written below, and must not close the help under the
  // officer's thumb.
  const [first] = useState(!props.seen);
  useEffect(() => {
    if (first && !covered) {
      document.cookie = `${FOLLOW_UP_HELP_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    }
  }, [first, covered]);
  return (
    <details open={first} className="mt-1 text-body-sm">
      <summary className="min-h-11 cursor-pointer py-2.5">
        {words.tap}{" "}
        <span className="font-semibold text-plum underline underline-offset-4">{words.head}</span>
      </summary>
      <div className="space-y-1 pb-2 text-ink/80">
        {words.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </details>
  );
}

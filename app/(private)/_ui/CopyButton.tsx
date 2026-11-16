"use client";

// Copies a text the server made (the members shown, as spreadsheet rows; the how-to's address) and says
// whether that worked, for 2.5 s. `event` counts the use in analytics (D77): the members' copy only.
import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics/events";

export function CopyButton({
  text,
  labels,
  event,
}: {
  text: string;
  labels: { copy: string; copied: string; failed: string };
  event?: "ws_copy_spreadsheet";
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const done = (next: "copied" | "failed") => {
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  };
  return (
    <button
      type="button"
      onClick={() => {
        if (event) track(event);
        // Inside a promise, so a missing clipboard (an insecure page) also lands in "failed".
        void Promise.resolve()
          .then(() => navigator.clipboard.writeText(text))
          .then(
            () => done("copied"),
            () => done("failed"),
          );
      }}
      className="drawn-frame-soft tint-button inline-flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-plum"
    >
      <span aria-hidden="true">⧉</span>
      <span aria-live="polite">
        {state === "copied" ? labels.copied : state === "failed" ? labels.failed : labels.copy}
      </span>
    </button>
  );
}

"use client";

// Copies a text the server made (the members shown, as spreadsheet rows; the how-to's address) and says
// whether that worked, for 2.5 s. `event` counts the use in analytics (D77): the members' copy only.
import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics/events";

export function CopyButton({
  text,
  labels,
  event,
  onCopied,
  className = "",
  describedBy,
}: {
  text: string;
  labels: { copy: string; copied: string; failed: string };
  event?: "ws_copy_spreadsheet";
  /** Called once the text is on the clipboard (D115: the thanks copied for the game). */
  onCopied?: () => void;
  /** Extra classes, such as full width in the thanks sheet (D114). */
  className?: string;
  /** The id of the line that says what this copy holds (a notice's three copies, D116). */
  describedBy?: string;
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
      aria-describedby={describedBy}
      onClick={() => {
        if (event) track(event);
        // Inside a promise, so a missing clipboard (an insecure page) also lands in "failed".
        void Promise.resolve()
          .then(() => navigator.clipboard.writeText(text))
          .then(
            () => {
              done("copied");
              onCopied?.();
            },
            () => done("failed"),
          );
      }}
      className={`drawn-frame-soft tint-button inline-flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-plum ${className}`}
    >
      <span aria-hidden="true">⧉</span>
      <span aria-live="polite">
        {state === "copied" ? labels.copied : state === "failed" ? labels.failed : labels.copy}
      </span>
    </button>
  );
}

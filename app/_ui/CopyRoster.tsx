"use client";

// "Copy for spreadsheet" on a member history card (D60): puts the card's member list on the clipboard as
// tab-separated rows, which a spreadsheet pastes into columns. The text is built on the server; the
// button only copies it and says whether that worked.
import { useState } from "react";

import { useCopy } from "./LocaleProvider";

export function CopyRoster({ text }: { text: string }) {
  const copy = useCopy();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const done = (next: "copied" | "failed") => {
    setState(next);
    setTimeout(() => setState("idle"), 2500);
  };
  return (
    <button
      type="button"
      onClick={() =>
        // Inside a promise, so a missing clipboard (an insecure page) also lands in "failed".
        Promise.resolve()
          .then(() => navigator.clipboard.writeText(text))
          .then(
            () => done("copied"),
            () => done("failed"),
          )
      }
      className="drawn-frame-soft inline-flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-plum"
    >
      <span aria-hidden="true">⧉</span>
      <span aria-live="polite">
        {state === "copied"
          ? copy.history.copied
          : state === "failed"
            ? copy.history.copyFailed
            : copy.history.copy}
      </span>
    </button>
  );
}

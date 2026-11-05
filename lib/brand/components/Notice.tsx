// Notice (DESIGN.md `notice`): a short message about what is happening or what just happened, in the soft
// drawn frame, announced politely (`role="status"`). `info` has no icon, `busy` is plum with the hourglass, `fail` is seal
// with the dropped stitch, `ok` is ink with the stitched check; the word always says it too.
import type { ReactNode } from "react";

import { DroppedStitch, Hourglass, StitchedCheck } from "./StatusIcons";

export type NoticeTone = "info" | "ok" | "busy" | "fail";

const TONE: Record<NoticeTone, { text: string; icon: ReactNode }> = {
  info: { text: "text-ink", icon: null },
  ok: { text: "text-ink", icon: <StitchedCheck /> },
  busy: { text: "text-plum", icon: <Hourglass /> },
  fail: { text: "text-seal", icon: <DroppedStitch /> },
};

export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      role="status"
      className={`drawn-frame-soft flex items-start gap-2 p-3 ${t.text} ${className}`}
    >
      {t.icon && (
        <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0">
          {t.icon}
        </span>
      )}
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

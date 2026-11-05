// Status chip (DESIGN.md `status-strip`, `badge`): a word, an optional icon and a time inside the soft
// drawn frame, in the tone's colour. Three channels per state: colour, icon and word.
import type { ReactNode } from "react";

export type ChipTone = "ink" | "plum" | "seal" | "muted";

const TONE: Record<ChipTone, string> = {
  ink: "text-ink",
  plum: "text-plum",
  seal: "text-seal",
  muted: "text-ink/70",
};

export function Chip({
  tone = "ink",
  icon,
  children,
}: {
  tone?: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`drawn-frame-soft inline-flex min-h-8 items-center gap-1.5 px-3 text-body-sm ${TONE[tone]}`}
    >
      {icon && (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

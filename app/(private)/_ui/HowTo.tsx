// In-place help (DESIGN.md "Workspace components", issue 585): a how-to that a 44 px summary opens, where the
// step needs it, so the page stays short for an officer who knows it and the help is one tap away for one
// who does not. `open` starts it open (a channel not set yet shows how to get its webhook).
import type { ReactNode } from "react";

export function HowTo({
  summary,
  open = false,
  children,
}: {
  summary: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group mt-2">
      <summary className="tint-button inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold text-plum [&::-webkit-details-marker]:hidden">
        <span className="underline decoration-plum/40 underline-offset-[3px]">{summary}</span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-1 border-l-2 border-rule pl-3">{children}</div>
    </details>
  );
}

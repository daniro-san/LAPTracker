// The wax seal (DESIGN.md `seal-button`): the one round control, for confirming or destructive actions.
// The wax (lumpy edge, drips, pressed ring) is hand-drawn SVG behind a real <button>; the label is text.
// Hover lifts and turns the stamp a little; pressing pushes it in (off under reduced motion).
import type { ButtonHTMLAttributes } from "react";

import { MarkLine } from "./Logo";
import { Wax } from "./Wax";

export function SealButton({
  label,
  className = "",
  ...rest
}: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`relative inline-grid size-24 shrink-0 cursor-pointer place-items-center rounded-full text-wax-ink-seal transition-transform duration-200 ease-out hover:-rotate-6 hover:scale-105 focus-visible:outline-plum active:scale-95 active:rotate-0 motion-reduce:transition-none ${className}`}
    >
      <Wax tone="seal" className="absolute inset-0 size-full" />
      <span className="relative flex flex-col items-center gap-0.5">
        <MarkLine size={24} />
        <span className="text-label font-semibold uppercase">{label}</span>
      </span>
    </button>
  );
}

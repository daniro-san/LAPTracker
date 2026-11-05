// The wax seal (DESIGN.md `seal-button`): the one round control, for confirming or destructive actions.
// The irregular wax edge and the pressed inner ring are SVG behind a real <button>; the label is text.
import type { ButtonHTMLAttributes } from "react";

import { Mark } from "./Logo";

const WAX =
  "M42.7 8.7Q50 7.5 57.6 7.7Q65.3 8 70.9 13.3Q76.4 18.5 82.4 23.2Q88.4 27.9 91.8 34.9Q95.2 42 93.2 49.7Q91.3 57.3 89.6 64.6Q87.8 71.8 81.9 76.4Q76 81 70.8 86.8Q65.5 92.6 57.7 92.7Q50 92.9 43 90.7Q36 88.4 28.6 86.4Q21.1 84.4 16.7 78.1Q12.3 71.8 10.6 64.5Q8.9 57.2 7.1 49.7Q5.2 42.1 9.7 35.7Q14.2 29.3 17.9 22.8Q21.7 16.2 28.5 13Q35.4 9.9 42.7 8.7Z";

export function SealButton({
  label,
  className = "",
  ...rest
}: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`relative inline-grid size-24 shrink-0 cursor-pointer place-items-center rounded-full text-paper focus-visible:outline-plum ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full text-seal"
        aria-hidden="true"
      >
        <path d={WAX} fill="currentColor" />
        <circle
          cx="50"
          cy="50"
          r="31"
          fill="none"
          stroke="var(--paper)"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="2 2.5"
        />
      </svg>
      <span className="relative flex flex-col items-center gap-0.5">
        <Mark size={22} />
        <span className="text-label font-semibold uppercase">{label}</span>
      </span>
    </button>
  );
}

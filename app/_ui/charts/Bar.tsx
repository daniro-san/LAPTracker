// One bar (D158, amending D68): every column and horizontal bar on the site. An HTML box, server-safe (no
// hooks), so client components can draw it too. Its length is a share of its track, and one zero rule holds
// everywhere: null (no figure) draws nothing, not even the track; zero or less draws a 1 px hairline; above
// zero is at least MIN_PX long, so a small value still shows; above 1 fills the track. A bar never gets a fixed
// minimum such as 6 %, which made a zero or a loss look like a small gain. The drawing is aria-hidden: its words
// are the row's own text or an sr-only span beside it, never an aria-label on a non-interactive element.
import type { CSSProperties } from "react";

/** Above zero, a bar is never shorter than this, in px. */
export const MIN_PX = 2;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const percent = (x: number) => `${Math.round(clamp(x) * 1000) / 10}%`;

type Axis = "column" | "row";

/** The drawn box: where it starts and how long it is, by the zero rule. */
function box(share: number, axis: Axis, reverse: boolean): { from: string; style: CSSProperties } {
  const from =
    axis === "column" ? "inset-x-0 bottom-0" : `inset-y-0 ${reverse ? "right-0" : "left-0"}`;
  const length = share <= 0 ? "1px" : `max(${MIN_PX}px, ${percent(share)})`;
  return { from, style: { [axis === "column" ? "height" : "width"]: length } };
}

/** The reference tick across the track, from the same end as the bar. */
function tick(reference: number, axis: Axis, reverse: boolean) {
  return axis === "column"
    ? { className: "inset-x-0 h-0.5", style: { bottom: percent(reference) } }
    : {
        className: "-inset-y-1 w-0.5",
        style: { [reverse ? "right" : "left"]: percent(reference) },
      };
}

export function Bar({
  share,
  axis,
  reverse = false,
  tone = "bg-plum/60",
  reference = null,
  className = "",
}: {
  /** The length as a share of the track; null when there is no figure. */
  share: number | null;
  /** "column": growing up from the track's bottom; "row": growing from its start. */
  axis: Axis;
  /** A row only: grow from the track's end, as the left half of a bar centred on 0. */
  reverse?: boolean;
  /** The bar's own classes: its colour and corners. */
  tone?: string;
  /** Where a threshold sits (a cap, 100 %), as a share of the track: a 2 px ink tick across it. */
  reference?: number | null | undefined;
  /** The track's classes: its size and background. */
  className?: string;
}) {
  if (share === null || Number.isNaN(share)) return null;
  const drawn = box(share, axis, reverse);
  const at = reference === null || reference === undefined ? null : tick(reference, axis, reverse);
  return (
    <span className={`relative block ${className}`}>
      <span aria-hidden="true" className={`absolute ${drawn.from} ${tone}`} style={drawn.style} />
      {at && (
        <span aria-hidden="true" className={`absolute bg-ink ${at.className}`} style={at.style} />
      )}
    </span>
  );
}

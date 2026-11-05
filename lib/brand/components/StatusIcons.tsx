// Snapshot status icons (Phase 5b): hourglass = running, stitched check = complete, dropped stitch =
// partial. 16 px line art in currentColor; the chip beside them always carries the word too.
const BASE = {
  viewBox: "0 0 16 16",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function Hourglass() {
  return (
    <svg {...BASE} strokeWidth="1.5">
      <path d="M3.5 1.75h9M3.5 14.25h9" />
      <path d="M4.75 1.75c0 3.5 6.5 3.75 6.5 6.25s-6.5 2.75-6.5 6.25M11.25 1.75c0 3.5-6.5 3.75-6.5 6.25s6.5 2.75 6.5 6.25" />
      <path d="M6.25 13.25 8 11.5l1.75 1.75Z" fill="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function StitchedCheck() {
  return (
    <svg {...BASE} strokeWidth="2">
      <path d="M2.5 8.5l2 2M6.75 11.5l2.75-3M10.75 7l3-3.25" />
    </svg>
  );
}

/** A dropped stitch leaves a ladder: two knitted columns with bare rungs where the middle one ran. */
export function DroppedStitch() {
  return (
    <svg {...BASE} strokeWidth="1.5">
      <path d="M1.5 2.5l2 2 2-2M1.5 7l2 2 2-2M1.5 11.5l2 2 2-2M10.5 2.5l2 2 2-2M10.5 7l2 2 2-2M10.5 11.5l2 2 2-2" />
      <path d="M7 4.5h2M7 9h2M7 13.5h2" />
    </svg>
  );
}

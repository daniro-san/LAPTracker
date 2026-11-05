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
    <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M2.8 1.4c.8-.1 3.5-.8 5.2-.8c1.7 0 4.4.7 5.2.8l0 1.2c-.9-.1-3.5 0-5.2 0c-1.7 0-4.3-.1-5.2 0zm0 12c.9.1 3.5 0 5.2 0c1.7 0 4.3.1 5.2 0l0 1.2c-.8.1-3.5.8-5.2.8c-1.7 0-4.4-.7-5.2-.8zm2.4-11.2c.1.5.4 1.8.8 2.7c.4.9 1.5 1.8 1.8 2.3c.3.5.3 1.1 0 1.6c-.3.5-1.4 1.4-1.8 2.3c-.4.9-.7 2.2-.8 2.7l-1-.2c.1-.5 0-2.2.4-3.1c.4-.9 1.5-2 1.8-2.5c.3-.5.3.5 0 0c-.3-.5-1.4-1.6-1.8-2.5c-.4-.9-.3-2.6-.4-3.1zm6.6.2c-.1.5 0 2.2-.4 3.1c-.4.9-1.5 2-1.8 2.5c-.3.5-.3-.5 0 0c.3.5 1.4 1.6 1.8 2.5c.4.9.3 2.6.4 3.1l-1 .2c-.1-.5-.4-1.8-.8-2.7c-.4-.9-1.5-1.8-1.8-2.3c-.3-.5-.3-1.1 0-1.6c.3-.5 1.4-1.4 1.8-2.3c.4-.9.7-2.2.8-2.7zm-6.2 11.2c-.6-.3 1-1.2 1.4-1.6c.4-.4.7-.6 1-.6c.3 0 .6.2 1 .6c.4.4 2 1.3 1.4 1.6c-.6.3-4.2.3-4.8 0zm2.6-5c0 .2.2.9.2 1.4c0 .5-.2 1.2-.2 1.4l-.4 0c0-.2 0-.9 0-1.4c0-.5 0-1.2 0-1.4z" />
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

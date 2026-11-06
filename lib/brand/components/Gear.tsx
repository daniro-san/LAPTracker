// The settings symbol (DESIGN.md `viewer-settings`): a toothed wheel in the 20 px line style of the theme
// switch's sun and moon, drawn in currentColor.
export function Gear() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="2.75" />
      <circle cx="10" cy="10" r="5.5" />
      <path d="M10 1.75v2.75M10 15.5v2.75M1.75 10h2.75M15.5 10h2.75M4.2 4.2l1.9 1.9M13.9 13.9l1.9 1.9M4.2 15.8l1.9-1.9M13.9 6.1l1.9-1.9" />
    </svg>
  );
}

// One ball of yarn per page, in a corner, with its thread running off along the edge. Line art in
// currentColor; the parent places it (absolute, out of the layout) so it never touches a card.
export function YarnCorner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 64"
      width="160"
      height="64"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <circle cx="30" cy="34" r="22" strokeWidth="2.5" />
      <path
        d="M14 19c8 9 9 22 2 31M21 14c11 10 13 27 4 40M30 12c12 10 15 29 6 43M10 30c10-3 24 1 36 13M12 41c10-2 21 2 29 11"
        strokeWidth="1.6"
      />
      <path d="M50 46c10 6 18 10 30 6s16-14 28-13 14 10 24 9 14-6 26-6" strokeWidth="1.8" />
    </svg>
  );
}

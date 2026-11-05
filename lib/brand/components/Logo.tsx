// The mark (Phase 5b): a plague-doctor beak mask whose head is a ball of yarn, with two knitting
// needles crossed behind it where the bones would be. Original, single colour (currentColor), drawn on a
// 64-unit grid so it still reads at 16–24 px. The needles stop short of the ball instead of being
// masked, so there are no ids and the mark works on any background.
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="4" fill="none">
        <path d="M7 7 19 19M43 43 58 58M57 7 45 19M21 43 6 58" />
      </g>
      <circle cx="6" cy="6" r="4.5" />
      <circle cx="58" cy="6" r="4.5" />
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        <circle cx="31" cy="30" r="13" strokeWidth="3.5" />
        <path d="M21 21.5c4 5 4 12.5 0 18M25.5 18c5 6 5.5 17 .5 24.5" strokeWidth="2.6" />
      </g>
      <circle cx="35.5" cy="25.5" r="3.2" />
      <path d="M42.5 21.5c7.5 1.2 13.5 7 18 18.5-6.5.6-13 .4-19.3-1.6 1.6-5.4 2-11.4 1.3-16.9Z" />
    </svg>
  );
}

/** Mark + wordmark. The wordmark is text, so it stays crisp and is the accessible name of the lockup. */
export function Logo({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={size} />
      <span className="font-display text-display-md">{name}</span>
    </span>
  );
}

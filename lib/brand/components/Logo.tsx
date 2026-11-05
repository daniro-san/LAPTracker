// The mark (Phase 5b, owner's pick "B" at the Session 7 mock): a plague doctor in profile facing left
// (hooked, riveted beak, goggle eye, cowl) under a wide-brimmed hat, with a ball of yarn and two knitting
// needles tucked into the hatband where a feather would go. Original, single colour (currentColor),
// holes by evenodd, no ids, on a 64-unit grid; the hat, beak and cowl still read at 16-24 px.
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
      <path d="M21.3 16.3L22 11Q22.5 8 26 8H38.8A7.8 7.8 0 0 0 39 16.3Z" />
      <path d="M21.1 17.7H40.2A7.8 7.8 0 0 0 42 19V22.5H20.4Z" />
      <path d="M4 25.5C10 21.5 50 20.8 60 22.8C57 26.5 14 28.5 4 25.5Z" />
      <path
        fillRule="evenodd"
        d="M38.9 12a6.6 6.6 0 1 0 13.2 0a6.6 6.6 0 1 0-13.2 0ZM46.6 17.3A6.75 6.75 0 0 0 40.1 11.8L40.2 12.9A5.65 5.65 0 0 1 45.5 17.4ZM49.5 15.6A9.95 9.95 0 0 0 41.3 8.6L40.6 9.7A8.85 8.85 0 0 1 48.6 16.4Z"
      />
      <path
        d="M45.5 12L55.6 3.3M45.5 12L60 8.3"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="55.9" cy="3" r="2.2" />
      <circle cx="60.3" cy="8.2" r="2.2" />
      <path
        fillRule="evenodd"
        d="M24.5 28.4L40 27.6C42 31 42 38 37 42.5L27 44.2C18 45 9 47.5 3.5 50.5C8 41 15 36 23.6 33.8C24 32 23.8 30 24.5 28.4ZM31.5 29.6a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2ZM19.5 38.2a.9 .9 0 1 0 0 1.8a.9 .9 0 1 0 0-1.8ZM14.3 41.2a.9 .9 0 1 0 0 1.8a.9 .9 0 1 0 0-1.8ZM9.6 44.6a.9 .9 0 1 0 0 1.8a.9 .9 0 1 0 0-1.8Z"
      />
      <circle cx="31.5" cy="33.2" r="1.6" />
      <path d="M41.6 27.4C43.6 31 43.6 39.4 38.2 44.2L28.4 46C24.5 50 21.5 55 20 61H58C55.5 52 53 44 52.5 37C52 30 48 27 43.5 27.2Z" />
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

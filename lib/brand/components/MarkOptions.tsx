// Mark candidates drawn for the owner's review on /brand (Session 7 step 1). The chosen one replaces
// Mark in Logo.tsx and this file is deleted. Original single-colour SVGs on a 64-unit grid.
type P = { size?: number };

/** Granny Doctor bust: bonnet, ribbon bow and ruff. */
export function BustMark({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M19 22C16 10 27 3 38 3C52 3 60 12 60 24C60 34 57 41 51 45L48.5 44V38C48 30 43 21 34 19.5C28 18.5 23 19.5 19 22ZM22.6 11.4C31 8.6 45 10 51.6 19.6C55.4 25 56.8 31.6 56 38.4L54.4 38.2C55 31.6 53.8 25.8 50.2 20.6C44 11.8 31 10.6 23.2 13Z"
      />
      <circle cx="19.5" cy="22.5" r="2.6" />
      <circle cx="24.5" cy="20" r="2.6" />
      <circle cx="30" cy="18.8" r="2.6" />
      <circle cx="35.6" cy="19.6" r="2.6" />
      <circle cx="40.6" cy="22.6" r="2.6" />
      <circle cx="44.6" cy="27" r="2.6" />
      <circle cx="47.3" cy="32.4" r="2.6" />
      <circle cx="48.5" cy="38.2" r="2.6" />
      <circle cx="48.6" cy="44" r="2.6" />
      <path
        fillRule="evenodd"
        d="M22 26.5C25 24.5 28 23.5 31 23.6C37 24 42 30 43.5 38C44 42 43 45.5 40.5 46H33C29 45 26 43 25 39.5C20 38.6 14 38.4 10 39.4C7 40.2 5 42 3.5 44.5C5 36 13 29 22 27ZM31 26.4a4.6 4.6 0 1 0 .01 0ZM18 31.5a1.2 1.2 0 1 0 .01 0ZM13 33.6a1.2 1.2 0 1 0 .01 0ZM8.6 36.6a1.2 1.2 0 1 0 .01 0Z"
      />
      <circle cx="31" cy="31" r="2.2" />
      <path d="M46.5 47.3L36 50.5L35 48.6L45.5 45.6ZM33 51C28 45.5 23.6 45.6 23.8 49.6C24 53.4 28.4 53.4 33 51ZM33 51C34.6 45.6 38.6 43.8 39.8 46.4C40.8 48.8 37.8 50.6 33 51ZM32.6 52L28 61L30.6 59.6L32 62L34.4 52.6ZM34.4 52.6L38 61L39 58.6L41.4 59.4L35.6 51.4Z" />
      <circle cx="33.5" cy="51.3" r="2.3" />
      <path d="M37 52.6C43 51.6 50 50 56.6 46.4C58.4 48 58.6 50 57.6 51.5C57.6 54 55.5 55.5 53.6 55.3C52.6 57.5 49.8 58.6 47.6 57.8C46 59.6 42.6 59.6 41.2 58C38.6 58.6 36.4 56.4 37 54Z" />
    </svg>
  );
}

/** Wide brim with a yarn ball and needles in the hatband. */
export function BrimMark({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" fill="currentColor">
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

/** Crest: hooded mask, needles crossed behind, yarn ball. */
export function CrestMark({ size = 24 }: P) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      fill="currentColor"
      fillRule="evenodd"
    >
      <path d="M19 25C18 15.5 26 10.5 35 10.5C44 10.5 50 17 50.5 25C51 34 51 42 53 48Q40 52.5 25 55C24 51 25 48 27.5 46C34 47 42.4 43.4 44.4 36C46.4 28 40.2 21.2 32 21.2C26 21.2 21.5 22.8 19 25Z" />
      <path d="M23.2 27.3C25.2 25.2 27.6 24.4 32 24.4C38.6 24.4 42.3 29 41.1 35.4C40.1 40.2 34.8 43.1 29 42.9C20 42.5 10 43.6 4.5 46.5C9 37 17 33 25 32.3Z M33 26.6a4.9 4.9 0 1 0 0 9.8a4.9 4.9 0 1 0 0-9.8Z M33 29.4a2.1 2.1 0 1 1 0 4.2a2.1 2.1 0 1 1 0-4.2Z M24.6 33.3a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2Z M19.8 34.2a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2Z M15 36.1a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2Z M10.8 39.2a1 1 0 1 0 0 2a1 1 0 1 0 0-2Z" />
      <path d="M7.5 51.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z M3.7 53.9Q9 55.3 9.7 60.6Q7.5 56.9 3.7 53.9Z M6.5 52Q11.1 53.9 11.5 58.8Q9.7 55.5 6.5 52Z" />
      <path d="M4.6 46C2.5 49 2.5 51.5 4 53.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 5L16.5 16.5M59 5L50.3 13.7M17.2 46.8L12.2 51.8"
        stroke="currentColor"
        strokeWidth="3.6"
      />
      <circle cx="5" cy="5" r="3.7" />
      <circle cx="59" cy="5" r="3.7" />
      <path d="M53.3 50.7L58.3 55.7L60.6 60.6L55.7 58.3L50.7 53.3Z" />
    </svg>
  );
}

/** Yarn-ball head: the mask's head is a ball of yarn, needles crossed behind. */
export function YarnheadMark({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" fill="currentColor">
      <path d="M60.3 9.8L52.8 18.3L49.8 15.7L57.3 7.1ZM28.2 46.3L21.4 54.1L16.6 56.5L18.4 51.5L25.2 43.7ZM20.7 7.1L28.2 15.7L25.2 18.3L17.7 9.8ZM52.8 43.7L59.6 51.5L61.4 56.5L56.6 54.1L49.8 46.3Z" />
      <circle cx="58.8" cy="8.5" r="3.7" />
      <circle cx="19.2" cy="8.5" r="3.7" />
      <path
        fillRule="evenodd"
        d="M23 31a16 16 0 1 0 32 0a16 16 0 1 0 -32 0ZM49.8 21.2A33.2 33.2 0 0 0 53.2 34.6A14.6 14.6 0 0 0 53.6 30.4A31.2 31.2 0 0 1 52.1 24.7A14.6 14.6 0 0 0 49.8 21.2ZM45.6 18A37.5 37.5 0 0 0 50.9 39.4A14.6 14.6 0 0 0 52.1 37.5A35.5 35.5 0 0 1 47.5 19.1A14.6 14.6 0 0 0 45.6 18ZM41.5 16.6A41.6 41.6 0 0 0 48 42.5A14.6 14.6 0 0 0 49.4 41.3A39.8 39.8 0 0 1 43.3 17.1A14.6 14.6 0 0 0 41.5 16.6ZM38.1 45.6A46.4 46.4 0 0 0 26 37.7A14.6 14.6 0 0 0 28.5 41.2A44.4 44.4 0 0 1 33.9 44.7A14.6 14.6 0 0 0 38.1 45.6ZM43.5 44.9A50.6 50.6 0 0 0 24.5 32.5A14.6 14.6 0 0 0 24.8 34.6A48.8 48.8 0 0 1 41.4 45.4A14.6 14.6 0 0 0 43.5 44.9ZM25.1 27a8.4 8.4 0 1 0 16.8 0a8.4 8.4 0 1 0 -16.8 0Z"
      />
      <path
        fillRule="evenodd"
        d="M26.7 27a6.8 6.8 0 1 0 13.6 0a6.8 6.8 0 1 0 -13.6 0ZM29.6 27a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0 -7.8 0Z"
      />
      <path
        d="M44 46.3C45 51 39 53 40 57S46 60 46 62.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        fillRule="evenodd"
        d="M21.1 26.5C12 26.4 6 35.5 1.5 48C7 43.5 13 40.8 23.1 40.2A18.4 18.4 0 0 1 21.1 26.5ZM15.6 33.2a1.2 1.2 0 1 0 2.5 0a1.2 1.2 0 1 0 -2.5 0ZM10.9 35.6a1.2 1.2 0 1 0 2.5 0a1.2 1.2 0 1 0 -2.5 0ZM6.8 39.4a1.2 1.2 0 1 0 2.5 0a1.2 1.2 0 1 0 -2.5 0Z"
      />
    </svg>
  );
}

// The mark (Phase 5b, owner's pick "B" at the Session 7 mock): a plague doctor in profile facing left
// (hooked, riveted beak, goggle eye, cowl) under a wide-brimmed hat, with a ball of yarn and two knitting
// needles tucked into the hatband where a feather would go. Original, single colour (currentColor),
// holes by evenodd, no ids, on a 64-unit grid; the hat, beak and cowl still read at 16-24 px.
import { Wax, WAX_INK, type WaxTone } from "./Wax";

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

/** The same mark drawn in the vignettes' hand (tapered strokes), for 96 px and up: the brand sheet, the
 *  link preview and the 192/512 px app icons. Below that the solid `Mark` reads better. */
export function MarkLine({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M21.3 18.4c0-.7-1-3.2-.8-4.6c.2-1.3.6-3.1 1.2-4c.6-.9 1.8-1.8 3-2.2c1.2-.3 3.6-.4 5.3-.4c1.7 0 3.5.4 5 .4c1.5.1 3.5.5 4.2.5l0 .2c-.7.1-2.7 1.1-4.2 1.1c-1.5-.1-3.3-.4-5-.4c-1.7 0-3.5.2-4.7.6c-1.2.3-1.2.5-1.8 1.4c-.6.9-.6 1.8-.8 3.2c-.2 1.3-1.1 3.5-1.2 4.2zm-.1-.4c.6-.5 2.6.6 3.8.6c1.2.1 4.6-.2 6-.2c1.4 0 3.7.4 5 .3c1.3-.1 4.6-1.1 5.4-.9c.7.2.6 1.6.6 2.2c0 .6 1 1.9-.4 2.2c-1.4.3-8 0-10.6.1c-2.6.1-9.4.8-10.6.3c-1.2-.5.2-4.1.8-4.6zm-17.8 7.2c1.5.2 4.6-.2 8.7.1c4.1.2 10.2.5 15.8.3c5.7-.3 12.5-1 18-1.7c5.4-.7 12.2-1 14.7-1.4l0 .2c-2.4.4-9 2.7-14.5 3.4c-5.4.7-12.4 1.7-18 1.9c-5.7.3-12.1.2-16.2-.1c-4.1-.2-7.1-2.3-8.5-2.5zm.6-.1c1.1-.3 3.6-1.7 6.9-2.1c3.4-.4 7.9-.6 13.1-.8c5.1-.2 12-.5 18-.5c6 0 15.2.9 18.2 1l0 .2c-3-.1-12.2 0-18.2 0c-6 0-12.8.3-18 .5c-5.1.2-9.6.4-12.9.8c-3.4.4-5.9.9-7.1 1.1zm37.7-7.8c-.4-.6-3-2.1-3.3-3.4c-.4-1.3 0-3.7.6-5c.6-1.2 2.2-2.8 3.5-3.4c1.2-.5 3.5-.9 4.9-.6c1.3.4 3.4 1.7 4.1 2.9c.8 1.1 1.4 3.5 1.2 4.9c-.1 1.3-1.3 3.2-2.3 4.2c-1 1-3.6 1.3-4.3 1.6l-.1-.2c.7-.4 2.5-1.4 3.5-2.3c.9-1 1.4-2.2 1.5-3.5c.2-1.4-.1-2.6-.9-3.8c-.7-1.1-1.8-1.8-3.1-2.1c-1.4-.3-2.5-.1-3.8.5c-1.2.6-2.1 1.4-2.7 2.6c-.6 1.2-.8 2.5-.5 3.8c.4 1.3 1.5 3.1 1.9 3.7zm7.7-9.8c-.4.5-1.3 2.4-2.2 3.4c-.9.9-2 1.8-3.1 2.6c-1.1.7-3.1 1.3-3.7 1.6l-.1-.2c.6-.3 2.3-1.4 3.3-2.1c1.1-.8 2.1-1.6 3-2.5c.9-.9 2.2-2.4 2.6-2.9zm1.6 2.1c-.4.5-1.4 2.3-2.3 3.2c-.9.9-2 1.8-3.1 2.5c-1.1.7-3.1 1.2-3.7 1.5l-.1-.2c.6-.3 2.3-1.3 3.3-2c1.1-.7 2.1-1.5 3-2.4c.9-.9 2.3-2.3 2.7-2.8zm-.8 2.8c-.1.4-.2 1.7-.6 2.3c-.4.7-1.6 1.2-1.9 1.5l-.1-.2c.3-.3 1-1 1.4-1.7c.4-.6.9-1.6 1-1.9zm-.7-5.3c1-.8 4.7-3.9 5.6-4.6l.6.6c-1 .8-4.7 3.9-5.6 4.6zm7.7-4.6c0 .3-.5 1-.9 1.1c-.4.1-1.2-.2-1.4-.5c-.2-.4-.1-1.1.2-1.4c.3-.3 1.2-.3 1.5-.2c.4.2.7.7.6 1zm-5.5 7.4c1.3-.3 6.3-1.6 7.6-1.9l.2.8c-1.3.3-6.3 1.6-7.6 1.9zm9.8-1.7c-.1.3-.6 1-1 1.1c-.4.1-1.2-.2-1.4-.5c-.2-.4-.1-1.1.2-1.4c.3-.3 1.2-.3 1.5-.2c.4.2.7.7.7 1zm-36.4 20.2c-.1.5.9 2.4.3 3.3c-.6 1-1 1.9-3.2 3.4c-2.2 1.4-7.6 4-10.2 5.8c-2.6 1.7-3.6 2.9-5 4.6c-1.3 1.6-2.3 3.2-2.7 4.6c-.4 1.4-.5 2.2-.2 3c.2.7.6.8.8 1l-.2.2c-.2-.2-1.1-.2-1.4-1c-.2-.7-1.4-2.4-1-3.8c.4-1.4 1.7-3.7 3.1-5.4c1.3-1.6 2.8-3.2 5.4-5c2.6-1.7 8-4.3 10.2-5.8c2.2-1.4 2-1.7 2.6-2.6c.6-1 1.2-1.9 1.3-2.3zm15.2-.4c.3.7 2.4 2.8 2.5 4.5c.1 1.7-.1 4.5-.8 6.1c-.7 1.6-2 3.6-3.9 4.6c-1.8 1-4.6 1.5-7.9 2.1c-3.2.7-8.7 1.1-11.9 1.9c-3.3.7-5.3 1.6-7.4 2.6c-2.1.9-4.8 1.4-5.6 1.9l-.2-.2c.9-.5 2.7-3.1 4.8-4.1c2.1-.9 4.6-1.8 7.8-2.6c3.3-.7 8.8-1.1 12.1-1.7c3.2-.7 5.4-.9 7.3-1.9c1.8-1 2.2-1.8 2.9-3.4c.7-1.6.9-3.4.8-5.1c-.1-1.7-.4-3.9-.7-4.7zm-17 5.7c.4.9 2.4 3.3 3 5c.5 1.7.1 4.4.2 5.3l-.2 0c-.1-.9-.4-3.4-1-5.1c-.5-1.7-1.8-4.2-2.2-5zm-3.3 5.7c0 .2-.2.5-.4.5c-.2.1-.6-.1-.7-.2c-.1-.2-.1-.6.1-.7c.1-.1.5-.1.7-.1c.2.1.3.3.3.5zm-5 2.8c0 .2-.2.5-.4.5c-.2.1-.6-.1-.7-.2c-.1-.2-.1-.6.1-.7c.1-.1.5-.1.7-.1c.2.1.3.3.3.5zm-4.6 3.2c0 .2-.2.5-.4.5c-.2.1-.6-.1-.7-.2c-.1-.2-.1-.6.1-.7c.1-.1.5-.1.7-.1c.2.1.3.3.3.5zm17.8-10.3c-.1-.6-1.2-2.9-.8-3.8c.5-.9 2.3-2.3 3.3-2.5c1-.1 3.1.6 3.9 1.3c.7.7 1.5 2.9 1.4 3.9c-.2 1-1.7 2.7-2.7 3.2c-.9.4-3.1-.7-3.6-.7l0-.3c.6.1 2.2.2 3.1-.2c.9-.5 1.6-1.3 1.7-2.3c.2-.9-.2-1.8-.9-2.5c-.8-.8-1.6-1.1-2.6-.9c-1 .1-1.8.7-2.3 1.6c-.4.9-.3 2.6-.3 3.1zm4.7-1.8c-.1.4-.6 1.2-1.1 1.3c-.5.1-1.5-.2-1.7-.6c-.2-.4-.1-1.3.2-1.7c.4-.3 1.4-.3 1.8-.2c.5.2.9.8.8 1.2zm9.5-6.7c1 .2 4.5-.5 6.1.3c1.5.9 3.3 2.2 4.1 4.3c.9 2 1.1 5.6 1.6 8.6c.5 3 .9 6 1.7 9.5c.9 3.4 1.8 9.4 2.4 11.3l-.2 0c-.6-1.8-4-7.2-4.8-10.7c-.9-3.4-1-6.7-1.5-9.7c-.5-3-.4-6.1-1.2-8.2c-.9-2-1.5-2.5-3.1-3.3c-1.5-.9-4.2-1.7-5.1-1.9zm-11.3 16.9c-.8.8-2.4 3.9-3.8 5.8c-1.4 1.8-2.7 3.8-3.7 5.8c-1 2-2.7 4.7-3.1 5.7l-.2 0c.4-1.1.3-4.7 1.3-6.7c1-2 2.5-4.3 3.9-6.2c1.4-1.8 4.6-3.7 5.4-4.6zm-12.5 17.6c3.2 0 12.6-.1 19.4-.2c6.8-.1 18-.1 21.6-.2l0 .2c-3.6.2-14.8 1.3-21.6 1.4c-6.8.1-16.2-.9-19.4-1zm22.5-16.5c-.4 1.1-1.3 4.2-2.1 6.5c-.8 2.4-2.1 6.4-2.5 7.7l-.2 0c.4-1.3 1.1-5.6 1.9-7.9c.8-2.4 2.3-5.3 2.7-6.3zm6.8-8.6c.2 1.7 1.2 6.9 1.1 10.4c0 3.5-1.1 8.8-1.3 10.6l-.2 0c.1-1.8.6-7.1.7-10.6c0-3.5-.4-8.7-.5-10.4z" />
    </svg>
  );
}

/** The mark pressed into a small wax seal: the header's logo. The wax is ivory and the mark plum in both
 *  themes (wax is pigment, DESIGN.md `wax`). */
export function WaxedMark({
  size = 40,
  tone = "paper",
  solid = false,
}: {
  size?: number;
  tone?: WaxTone;
  /** Press the solid cut, which holds up below 32 px (the header's 40 px seal), instead of the line drawing. */
  solid?: boolean;
}) {
  const Cut = solid ? Mark : MarkLine;
  const markSize = Math.round(size * (solid ? 0.6 : 0.5));
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <Wax tone={tone} className="absolute inset-0 size-full" />
      <Cut size={markSize} className={`relative ${WAX_INK[tone]}`} />
    </span>
  );
}

/** Waxed mark + wordmark. The wordmark is text, so it stays crisp and is the accessible name of the lockup. */
export function Logo({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <WaxedMark size={size} />
      <span className="font-display text-display-md">{name}</span>
    </span>
  );
}

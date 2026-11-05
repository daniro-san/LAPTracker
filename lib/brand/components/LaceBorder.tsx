// A crochet scallop edge drawn in the vignettes' hand: a band, then a row of tapered scallops, each
// with a ring eyelet. Drawn in currentColor so it reads as the header's own fabric hanging below
// it. The pattern id comes from useId so two borders on a page never collide.
import { useId } from "react";

export function LaceBorder({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} width="100%" height="12" aria-hidden="true">
      <defs>
        <pattern id={id} width="24" height="12" patternUnits="userSpaceOnUse">
          <g fill="currentColor">
            <path d="M-1-1c2.2-.3 23.8-.3 26 0c2.2.3.1 3.4 0 3.7c-.1.3.1.2-1 .2c-1.1 0-10-.1-12-.1c-2 0-10.9.1-12 .1c-1.1 0-.9.1-1-.2c-.1-.3-2.2-3.4 0-3.7zm1.4 3c.4.9 1.7 3.5 2.9 4.8c1.1 1.4 2.5 1.9 4.1 2.5c1.6.6 2.9.5 4.6.5c1.7 0 3 .1 4.6-.5c1.6-.6 3-1.1 4.1-2.5c1.2-1.3 2.5-3.9 2.9-4.8l.8.4c-.5.8-1.2 4.2-2.3 5.6c-1.2 1.3-3.1 2.7-4.7 3.3c-1.6.6-3.7.7-5.4.7c-1.7 0-3.8-.1-5.4-.7c-1.6-.6-3.5-2-4.7-3.3c-1.1-1.4-1.8-4.8-2.3-5.6zm.9 2.6c0 .4-.3 1.1-.6 1.3c-.4.2-1 .2-1.3 0c-.4-.2-.7-.9-.7-1.3c0-.4.3-1.1.6-1.3c.4-.2 1-.2 1.4 0c.3.2.6.9.6 1.3zm24 0c0 .4-.3 1.1-.7 1.3c-.3.2-.9.2-1.2 0c-.4-.2-.7-.9-.7-1.3c0-.4.3-1.1.6-1.3c.4-.2 1-.2 1.3 0c.4.2.7.9.7 1.3z" />
            <path
              fillRule="evenodd"
              d="M14.6 5.3c-.1.5-.4 1.4-.9 1.8c-.4.4-1.3.7-1.9.6c-.6 0-1.4-.4-1.8-.9c-.4-.4-.6-1.3-.5-1.9c.1-.6.5-1.3 1.1-1.6c.5-.4 1.4-.5 2-.4c.6.1 1.3.8 1.6 1.2c.3.4.4.7.4 1.2zm-1-.3c0 .2-.2.7-.4 1c-.3.2-.8.4-1.1.3c-.4 0-.8-.2-1-.5c-.3-.2-.4-.7-.3-1.1c0-.3.3-.7.6-.9c.3-.2.8-.3 1.1-.2c.4.1.8.4 1 .6c.1.3.2.5.1.8z"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="12" fill={`url(#${id})`} />
    </svg>
  );
}

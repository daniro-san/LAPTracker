// A crochet scallop edge: a solid band, then a row of scallops, each with an eyelet hole and a picot
// where two scallops meet. Drawn in currentColor so it reads as the header's own fabric hanging below
// it. The pattern id comes from useId so two borders on a page never collide.
import { useId } from "react";

export function LaceBorder({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} width="100%" height="12" aria-hidden="true">
      <defs>
        <pattern id={id} width="24" height="12" patternUnits="userSpaceOnUse">
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M0 0h24v3c0 4.6-4.9 8-12 8S0 7.6 0 3Zm12 2.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6Z"
          />
          <circle cx="0" cy="5.5" r="1.4" fill="currentColor" />
          <circle cx="24" cy="5.5" r="1.4" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="12" fill={`url(#${id})`} />
    </svg>
  );
}

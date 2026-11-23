// The path over a chart's next level (D158 rule 7 (b), chart to chart): a 44 px Back step to the level above,
// then where the reader is ("Server pulse › 11:00–11:15"), each level above a link. The level lives in the
// address query, so a link can reopen it, and every link here keeps the scroll position (`scroll={false}`):
// the card stays where it was while its chart changes. `sticky` keeps the path at the top of the window while
// its card scrolls (the desk, which has no sticky header); DrillReveal brings it into view on arrival.
import Link from "next/link";

import { DrillReveal } from "./DrillReveal";

export interface DrillStep {
  label: string;
  /** The level's address; none for the level shown. */
  href?: string;
}

const STEP = "tint-button inline-flex min-h-11 items-center px-2";

export function DrillPath({
  name,
  back,
  steps,
  sticky = false,
}: {
  /** The path's accessible name ("Where you are in this chart"). */
  name: string;
  back: { href: string; label: string };
  steps: DrillStep[];
  sticky?: boolean;
}) {
  const stuck = sticky ? "sticky top-0 z-[5] border-b border-rule bg-paper" : "";
  return (
    <nav
      aria-label={name}
      className={`mt-2 flex flex-wrap items-center gap-x-2 text-body-sm ${stuck}`}
    >
      <DrillReveal />
      <Link href={back.href} scroll={false} prefetch={false} className={`${STEP} font-semibold`}>
        <span aria-hidden="true">‹&nbsp;</span>
        {back.label}
      </Link>
      <ol className="flex min-w-0 flex-wrap items-center">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center">
            {i > 0 && (
              <span aria-hidden="true" className="px-1 text-ink/60">
                ›
              </span>
            )}
            {s.href ? (
              <Link href={s.href} scroll={false} prefetch={false} className={`${STEP} underline`}>
                {s.label}
              </Link>
            ) : (
              <span
                aria-current="location"
                className="inline-flex min-h-11 items-center px-1 font-semibold"
              >
                {s.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

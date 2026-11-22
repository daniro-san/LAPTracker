// The side rail (DESIGN.md "Layout components", D122): the desk's destinations down the left edge from 768
// to 1279, the icon over its word (up to two lines, never hyphenated), each item 64 px tall. The open one
// has a 3 px plum bar on its left edge and a plum tint. Under each destination its views (Members › Former
// members, Insights; Calendar › Caravans, Notices, Thefts) as 44 px words, and the `footer` under a
// hairline, so every page the sidebar lists is reachable at these widths too (issue 720). Shown by AppShell
// between `md` and `xl` only.
import type { ReactNode } from "react";

import { type NavItem, sidebarEntries } from "./layout-rules";

export interface NavProps {
  /** The nav's accessible name ("Sections"). */
  label: string;
  items: readonly NavItem[];
  /** The open destination; null on a page outside them (Alliance settings, Start here). */
  current: string | null;
  /** The open view of the current destination (the sidebar and, since issue 720, the rail). */
  view?: string;
  icons: Readonly<Record<string, ReactNode>>;
  /** A count beside a destination's icon (Home's waiting drafts), with its own screen-reader words. */
  badges?: Readonly<Record<string, ReactNode>>;
  /** The word added to a destination that is not open yet. */
  soon: string;
}

export const NAV_ITEM_ON = "border-plum bg-plum/15 font-semibold text-plum";
export const NAV_ITEM_OFF = "border-transparent";

export function NavRail({
  label,
  items,
  current,
  view,
  icons,
  badges,
  soon,
  footer,
}: NavProps & { footer?: ReactNode }) {
  return (
    <nav aria-label={label} className="sticky top-0 h-dvh overflow-y-auto pt-3 pb-6">
      <ul>
        {sidebarEntries(items, current, view).map((entry) => {
          const top = entry.depth === 0;
          const on = entry.current === "page" || entry.within;
          const box = top
            ? `relative flex min-h-16 flex-col items-center justify-center gap-0.5 border-l-[3px] px-1 text-center text-[12px] leading-tight hyphens-none [overflow-wrap:normal] ${on ? NAV_ITEM_ON : NAV_ITEM_OFF}`
            : `flex min-h-11 items-center justify-center border-l-[3px] px-1 py-1 text-center text-[12px] leading-tight hyphens-none [overflow-wrap:normal] ${entry.current ? NAV_ITEM_ON : NAV_ITEM_OFF}`;
          const inside = (
            <>
              {top && icons[entry.id]}
              <span className="max-w-full">{entry.label}</span>
              {top && badges?.[entry.id]}
            </>
          );
          return (
            <li key={entry.id} className={top ? "[&:not(:first-child)]:mt-2" : undefined}>
              {entry.href === undefined ? (
                <span
                  aria-disabled="true"
                  aria-label={`${entry.label} (${soon})`}
                  className={`${box} text-ink/70`}
                >
                  {inside}
                </span>
              ) : (
                <a href={entry.href} aria-current={entry.current} className={`${box} tint-button`}>
                  {inside}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {footer && (
        <div className="mt-3 border-t border-rule px-1 pt-2 text-center text-[12px] leading-tight">
          {footer}
        </div>
      )}
    </nav>
  );
}

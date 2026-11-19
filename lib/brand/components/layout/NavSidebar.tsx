// The labelled sidebar (DESIGN.md "Layout components", D122): from 1280 the desk's destinations with their
// words beside the icons, and under each its views (Members › Former members; Calendar › Caravans, Notices,
// Thefts) as indented 44 px links. The open view carries aria-current; its destination keeps the plum bar.
// `footer` sits under a hairline at the end (the desk's "See what members see").
import type { ReactNode } from "react";

import { sidebarEntries } from "./layout-rules";
import { NAV_ITEM_OFF, NAV_ITEM_ON, type NavProps } from "./NavRail";

export function NavSidebar({
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
            ? `relative flex min-h-12 items-center gap-3 border-l-[3px] px-4 text-body ${on ? NAV_ITEM_ON : NAV_ITEM_OFF}`
            : `flex min-h-11 items-center border-l-[3px] pr-4 pl-[52px] text-body-sm ${entry.current ? NAV_ITEM_ON : NAV_ITEM_OFF}`;
          const inside = (
            <>
              {top && icons[entry.id]}
              <span className="min-w-0">{entry.label}</span>
              {top && badges?.[entry.id]}
            </>
          );
          return (
            <li key={entry.id}>
              {entry.href === undefined ? (
                <span
                  aria-disabled="true"
                  aria-label={`${entry.label} (${soon})`}
                  className={`${box} text-ink/55`}
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
      {footer && <div className="mt-3 border-t border-rule px-4 pt-2 text-body-sm">{footer}</div>}
    </nav>
  );
}

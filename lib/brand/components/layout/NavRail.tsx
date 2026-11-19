// The side rail (DESIGN.md "Layout components", D122): the desk's destinations down the left edge from 768
// to 1279, the icon over its word (up to two lines, never hyphenated), each item 64 px tall. The open one
// has a 3 px plum bar on its left edge and a plum tint. Shown by AppShell between `md` and `xl` only.
import type { ReactNode } from "react";

import type { NavItem } from "./layout-rules";

export interface NavProps {
  /** The nav's accessible name ("Sections"). */
  label: string;
  items: readonly NavItem[];
  current: string;
  /** The open view of the current destination (sidebar only). */
  view?: string;
  icons: Readonly<Record<string, ReactNode>>;
  /** A count beside a destination's icon (Home's waiting drafts), with its own screen-reader words. */
  badges?: Readonly<Record<string, ReactNode>>;
  /** The word added to a destination that is not open yet. */
  soon: string;
}

export const NAV_ITEM_ON = "border-plum bg-plum/15 font-semibold text-plum";
export const NAV_ITEM_OFF = "border-transparent";

export function NavRail({ label, items, current, icons, badges, soon }: NavProps) {
  return (
    <nav aria-label={label} className="sticky top-0 h-dvh overflow-y-auto pt-3">
      <ul>
        {items.map((item) => {
          const on = item.id === current;
          const box = `relative flex min-h-16 flex-col items-center justify-center gap-0.5 border-l-[3px] px-1 text-center text-[12px] leading-tight hyphens-none [overflow-wrap:normal] ${on ? NAV_ITEM_ON : NAV_ITEM_OFF}`;
          const inside = (
            <>
              {icons[item.id]}
              <span className="max-w-full">{item.label}</span>
              {badges?.[item.id]}
            </>
          );
          return (
            <li key={item.id}>
              {item.href === undefined ? (
                <span
                  aria-disabled="true"
                  aria-label={`${item.label} (${soon})`}
                  className={`${box} text-ink/55`}
                >
                  {inside}
                </span>
              ) : (
                <a
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={`${box} tint-button`}
                >
                  {inside}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

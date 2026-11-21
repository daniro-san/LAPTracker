// The pure parts of the layout components (DESIGN.md "Layout components", D122): which table cells show at
// which width, how a page's actions split on a phone, and the side navigation's items. No React, so the
// rules are tested on their own.

/** When a table column shows: always, from 640 (`sm`), from 1024 (`lg`) or from 1440 (`wide`). */
export type ColumnPriority = "always" | "sm" | "lg" | "wide";

// Full class names, so Tailwind finds them in this file.
const CELL: Record<ColumnPriority, string> = {
  always: "table-cell",
  sm: "hidden sm:table-cell",
  lg: "hidden lg:table-cell",
  wide: "hidden wide:table-cell",
};

/** The display classes of a head or body cell of a column with this priority. */
export function cellClass(priority: ColumnPriority): string {
  return CELL[priority];
}

/** One action of a page head: a link or a control, already rendered, and whether it is the main one. */
export interface PageAction {
  key: string;
  node: unknown;
  primary?: boolean;
}

/**
 * How a page head's actions show below 768: the main action stays in view and the others go into the
 * More menu. With no action marked main, the first one is. From 768 all of them show in their own order.
 */
export function splitActions<T extends PageAction>(
  actions: readonly T[],
): { shown: T | null; more: T[] } {
  const shown = actions.find((a) => a.primary) ?? actions[0];
  if (shown === undefined) return { shown: null, more: [] };
  return { shown, more: actions.filter((a) => a !== shown) };
}

/** A view inside a navigation item (Members › Former members; Calendar › Caravans). */
export interface NavView {
  id: string;
  label: string;
  href: string;
}

/** A destination of the side navigation and the bottom tabs; `href` undefined means "soon". */
export interface NavItem<Id extends string = string> {
  id: Id;
  label: string;
  href?: string;
  views?: readonly NavView[];
}

export interface NavEntry {
  id: string;
  label: string;
  href?: string;
  /** "page" on the open destination or view, for `aria-current`. */
  current?: "page";
  /** The open destination when one of its views is open: marked, but not `aria-current`. */
  within: boolean;
  depth: 0 | 1;
}

/**
 * The sidebar's rows in reading order: each destination, then its views indented. The open view gets
 * `aria-current`; its destination is still marked (`within`) so the eye finds the section. With no view
 * open, the destination itself is current.
 */
export function sidebarEntries(
  items: readonly NavItem[],
  current: string | null,
  view?: string,
): NavEntry[] {
  return items.flatMap((item) => {
    const open = item.id === current;
    const viewOpen = open && view !== undefined && (item.views ?? []).some((v) => v.id === view);
    const head: NavEntry = {
      id: item.id,
      label: item.label,
      ...(item.href !== undefined && { href: item.href }),
      ...(open && !viewOpen && { current: "page" as const }),
      within: open,
      depth: 0,
    };
    const views = (item.views ?? []).map((v): NavEntry => ({
      id: `${item.id}/${v.id}`,
      label: v.label,
      href: v.href,
      ...(viewOpen && v.id === view && { current: "page" as const }),
      within: false,
      depth: 1,
    }));
    return [head, ...views];
  });
}

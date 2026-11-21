// Equal cards in columns (DESIGN.md "Layout components", D122): as many 18rem columns as fit, one at 360,
// two at 768. Reading order is row by row, so it is for items without an order (notices, roll call kinds);
// an ordered list (members, a week's days) stays one list. `list`: the grid is a <ul> of the children's
// <li>, for results that are a list (the players search, issue 473).
import type { ReactNode } from "react";

const GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,var(--card-min)),1fr))] gap-4 lg:gap-6";

export function CardGrid({ list = false, children }: { list?: boolean; children: ReactNode }) {
  return list ? <ul className={GRID}>{children}</ul> : <div className={GRID}>{children}</div>;
}

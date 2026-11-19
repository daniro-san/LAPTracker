// Equal cards in columns (DESIGN.md "Layout components", D122): as many 18rem columns as fit, one at 360,
// two at 768. Reading order is row by row, so it is for items without an order (notices, roll call kinds);
// an ordered list (members, a week's days) stays one list.
import type { ReactNode } from "react";

export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,var(--card-min)),1fr))] gap-4 lg:gap-6">
      {children}
    </div>
  );
}

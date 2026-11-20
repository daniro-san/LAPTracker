// The ledger spread (DESIGN.md "Layout system", D122): from 1024 the page's main column (2/3) and its margin
// column (1/3) on the right, divided by a 2 px ink rule; one column below. The HTML order is the phone order
// (`marginFirst` puts the margin first there, as the alliance figures before the member list); grid areas
// put the margin on the right at every width that has one, so it is never on the left. `even` makes two
// equal columns from 768 for a pair of blocks of the same weight. The rule runs the full height of the
// spread; with `stickyMargin` only the notes inside it stick, in a `MarginPane` that fits the window and
// scrolls on its own, so a note that grows ("Show more") never makes the page longer than its main column
// (issue 412 UX pass). `marginLabelledBy` names that pane by its notes' heads.
import type { ReactNode } from "react";

import { MarginPane } from "./MarginPane";

export function Spread({
  main,
  margin,
  marginFirst = false,
  stickyMargin = false,
  even = false,
  marginLabelledBy,
}: {
  main: ReactNode;
  margin: ReactNode;
  marginFirst?: boolean;
  stickyMargin?: boolean;
  even?: boolean;
  /** The ids of the margin notes' heads (a sticky margin that scrolls is a region they name). */
  marginLabelledBy?: string;
}) {
  const mainBox = <div className="min-w-0 lg:[grid-area:main]">{main}</div>;
  const marginBox = (
    <div className="min-w-0 lg:border-l-2 lg:border-ink lg:pl-6 lg:[grid-area:margin]">
      {stickyMargin ? <MarginPane labelledBy={marginLabelledBy}>{margin}</MarginPane> : margin}
    </div>
  );
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6 lg:[grid-template-areas:'main_margin'] ${even ? "md:grid-cols-2" : ""}`}
    >
      {marginFirst ? (
        <>
          {marginBox}
          {mainBox}
        </>
      ) : (
        <>
          {mainBox}
          {marginBox}
        </>
      )}
    </div>
  );
}

// List and detail (DESIGN.md "Layout system", D122): from 1024 the list (7/12) and the open item (5/12,
// sticky) side by side; below 1024 only the list, and the caller opens the same detail in its Sheet. The
// open item comes from the URL (`?m=`), read by the caller, which also marks the open row
// (`aria-current="true"`). With nothing open the pane says so in one muted line, never an empty frame.
import type { ReactNode } from "react";

export function MasterDetail({
  list,
  detail,
  detailLabel,
  empty,
}: {
  list: ReactNode;
  /** The open item's content, or null with nothing open. */
  detail: ReactNode | null;
  /** The pane's accessible name (the open member's name). */
  detailLabel?: string;
  /** The line shown with nothing open ("Pick a member to see their info."). */
  empty: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(20rem,5fr)]">
      <div className="min-w-0">{list}</div>
      <aside
        aria-label={detailLabel}
        className="hidden min-w-0 lg:sticky lg:top-2 lg:block lg:self-start"
      >
        {detail ?? <p className="py-4 text-body-sm text-ink/70">{empty}</p>}
      </aside>
    </div>
  );
}

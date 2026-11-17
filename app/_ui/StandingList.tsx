"use client";

// The tracked alliances' rows (D90): the first few, the page's own alliance and the viewer's own wherever
// they are, and a "Show all (n)" button for the rest, by WhoFought's rule. The rows are rendered on the
// server and come in as data with their union id.
import { useState, type ReactNode } from "react";

import { useMyAlliance } from "./MyAlliance";
import { ShowAllButton } from "./ShowFirst";
import { visibleEntries } from "./WhoFought";

export function StandingList({
  own,
  head,
  rows,
}: {
  /** The page's own alliance. */
  own: number;
  /** The first row, the tracked alliances together; always shown. */
  head: ReactNode;
  rows: { t: { unionId: number }; node: ReactNode }[];
}) {
  const mine = useMyAlliance();
  const [all, setAll] = useState(false);
  const shown = visibleEntries(rows, mine, all, own);
  return (
    <>
      <ol className="divide-y divide-rule border-y border-rule">
        {head}
        {shown.map((r) => r.node)}
      </ol>
      {shown.length < rows.length && <ShowAllButton n={rows.length} onClick={() => setAll(true)} />}
    </>
  );
}

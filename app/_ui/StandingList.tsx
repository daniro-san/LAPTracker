"use client";

// The tracked alliances' rows (D90): the first few, the page's own alliance and the viewer's own wherever
// they are, and a "Show all (n)" button for the rest, as WhoFought does. The rows are rendered on the
// server and already in the page; each carries its union id as its key.
import { Children, useState, type ReactNode } from "react";

import { useMyAlliance } from "./MyAlliance";
import { ShowAllButton } from "./ShowFirst";

/** Rows shown before "Show all": the first ones. */
const SHOWN = 5;

export function StandingList({
  own,
  head,
  children,
}: {
  /** The page's own alliance. */
  own: number;
  /** The first row, the tracked alliances together; always shown. */
  head: ReactNode;
  children: ReactNode;
}) {
  const mine = useMyAlliance();
  const [all, setAll] = useState(false);
  const rows = Children.toArray(children);
  const keep = (i: number, key: string | null) =>
    i < SHOWN || key?.endsWith(`$${own}`) || key?.endsWith(`$${mine}`);
  const shown = all ? rows : rows.filter((r, i) => keep(i, (r as { key: string | null }).key));
  return (
    <>
      <ol className="divide-y divide-rule border-y border-rule">
        {head}
        {shown}
      </ol>
      {shown.length < rows.length && <ShowAllButton n={rows.length} onClick={() => setAll(true)} />}
    </>
  );
}

"use client";

// The live standings' list: the first 5 alliances and the viewer's own wherever it is, the rest behind
// "Show all (n)" (UX review N1), as the war turnout lists do. The rows are rendered on the server.
import { useState } from "react";

import { useCopy } from "./LocaleProvider";
import { useMyAlliance } from "./MyAlliance";
import { ShowAllButton } from "./ShowFirst";
import { StatTable, type StatRow } from "./StatTable";
import { visibleEntries } from "./WhoFought";

export function LiveStandings({ rows }: { rows: StatRow[] }) {
  const copy = useCopy();
  const mine = useMyAlliance();
  const [all, setAll] = useState(false);
  const entries = rows.map((row) => ({ t: { unionId: Number(row.key) }, row }));
  const shown = visibleEntries(entries, mine, all).map(({ row }) => ({
    ...row,
    mine: Number(row.key) === mine,
  }));
  return (
    <>
      <StatTable
        leadLabel={copy.ledger.alliance}
        columns={[copy.ledger.kills, copy.ledger.might]}
        rows={shown}
        copy={copy}
      />
      {shown.length < rows.length && <ShowAllButton n={rows.length} onClick={() => setAll(true)} />}
    </>
  );
}

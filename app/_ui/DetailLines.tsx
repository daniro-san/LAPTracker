// The Details panel that opens under a row (app/_ui/StatTable.tsx), the same at every depth (DESIGN.md
// `details-table`): one small table, a row per figure, the two moments compared as column heads (the
// snapshot times, or the two events' dates), then the change and, where there is one, the ledger rank.
// Numerals tabular and right-aligned; notes in seal under the change. Language-free but for the labels.
import type { ReactNode } from "react";

import { requestCopy } from "./locale";
import { Delta, Num, Rank, RankMove } from "./Num";
import type { StatMetric } from "./StatTable";

export interface RankPair {
  before: number | null;
  after: number | null;
  move: number | null;
}

export const rankText = (n: number | null) => (n === null ? "—" : `#${n}`);

export interface DetailRow {
  label: string;
  from: ReactNode;
  to: ReactNode;
  change: ReactNode;
  note?: string | undefined;
  /** The ledger rank for this figure (`#4 =`), in the last column. */
  rank?: ReactNode;
}

/** A rank row (`Server  #5  #4  ▲1`): the ranks are the figures and the move is the change. */
export const rankRow = (label: string, pair: RankPair): DetailRow => ({
  label,
  from: rankText(pair.before),
  to: rankText(pair.after),
  change: <RankMove move={pair.move} />,
});

/**
 * Might, Kills and Members before → after with their change (the percent stays on the card), the ledger
 * rank beside Might and Kills, then the server rank: the rows of an alliance's Details in one event.
 */
export function figureRows(
  metrics: StatMetric[],
  ranks: { might: RankPair; kills: RankPair; server: RankPair },
  serverLabel: string,
): DetailRow[] {
  const rankOf = [ranks.might, ranks.kills];
  return [
    ...metrics.map((m, i): DetailRow => {
      const rank = rankOf[i];
      return {
        label: m.label,
        from: <Num n={m.base ?? null} />,
        to: <Num n={m.value} />,
        change: <Delta delta={m.delta} base={null} />,
        note: m.detailNote,
        ...(rank && { rank: <Rank n={rank.after} move={rank.move} /> }),
      };
    }),
    rankRow(serverLabel, ranks.server),
  ];
}

export async function DetailTable({
  corner,
  from,
  to,
  rows,
}: {
  /** Names what the heads are, e.g. "server" for snapshot times. */
  corner?: ReactNode;
  from: ReactNode;
  to: ReactNode;
  rows: DetailRow[];
}) {
  const copy = await requestCopy();
  const hasRank = rows.some((r) => r.rank !== undefined);
  const cell = "py-1 pl-2 text-right align-top";
  return (
    <table className="w-full border-collapse text-sm tabular-nums">
      <thead className="text-xs text-ink/70">
        <tr className="border-b border-rule">
          <th scope="col" className="py-1 text-left font-normal">
            {corner}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {from}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            <span aria-hidden="true">→ </span>
            {to}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {copy.ledger.change}
          </th>
          {hasRank && (
            <th scope="col" className={`${cell} font-medium`}>
              {copy.ledger.rank}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-rule last:border-0">
            <th
              scope="row"
              className="py-1 text-left align-top text-label font-semibold uppercase tracking-[0.04em] text-ink/70"
            >
              {r.label}
            </th>
            <td className={`${cell} text-ink/70`}>{r.from}</td>
            <td className={`${cell} font-medium`}>{r.to}</td>
            <td className={cell}>
              {r.change}
              {r.note && <span className="block text-xs text-seal">{r.note}</span>}
            </td>
            {hasRank && <td className={`${cell} whitespace-nowrap`}>{r.rank}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

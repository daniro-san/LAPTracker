// Lines of the Details panel that opens under a row (app/_ui/StatTable.tsx), the same at every depth:
// a label, then figures. Ranks read `#3 → #1 ▲2`, language-free.
import type { ReactNode } from "react";

import { RankMove } from "./Num";

export interface RankPair {
  before: number | null;
  after: number | null;
  move: number | null;
}

const rankText = (n: number | null) => (n === null ? "—" : `#${n}`);

export function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
      <span className="w-20 shrink-0 font-medium">{label}</span>
      {children}
    </li>
  );
}

export function RankLine({ label, pair }: { label: string; pair: RankPair }) {
  return (
    <DetailLine label={label}>
      <span>
        {rankText(pair.before)} → {rankText(pair.after)}
      </span>
      <RankMove move={pair.move} />
    </DetailLine>
  );
}

// The alliance page's totals (plan Phase 5c): might, kills and members, Before to After, as the summary
// band's metrics. Split from app/(pages)/events/[id]/alliances/[unionId]/page.tsx for its size.
import type { Dictionary } from "@/lib/copy";
import type { AllianceRow, HistoryRow } from "@/lib/queries";

import { inEventMarked } from "./AcrossEvents";
import { fellWithLeavers } from "./event-rows";
import type { StatMetric } from "./StatTable";

function totalsMetric(
  label: string,
  before: number | null | undefined,
  after: number | null | undefined,
  canDelta: boolean,
  left = 0,
): StatMetric {
  const [b, a] = [before ?? null, after ?? null];
  const delta = canDelta && a !== null && b !== null ? a - b : null;
  return { label, value: a ?? b, delta, base: b, memberMark: fellWithLeavers(delta, left) };
}

/** The page shows a `*`: on the summary, or on a change inside an event under Across events. */
export const showsMemberMark = (metrics: StatMetric[], history: HistoryRow[]) =>
  metrics.some((m) => m.memberMark) || inEventMarked(history);

/** `left`: members of the Before roster gone from the After roster (0 when the rosters cannot be compared). */
export function totalsMetrics(
  { before, after }: { before: AllianceRow | null; after: AllianceRow | null },
  canDelta: boolean,
  left: number,
  copy: Dictionary,
): StatMetric[] {
  const l = copy.ledger;
  return [
    totalsMetric(l.might, before?.totalPower, after?.totalPower, canDelta, left),
    totalsMetric(l.kills, before?.totalKills, after?.totalKills, canDelta, left),
    totalsMetric(l.members, before?.memberCount, after?.memberCount, canDelta),
  ];
}

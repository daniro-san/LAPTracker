// The alliance page's totals (plan Phase 5c): might, kills and members, Before to After, as the summary
// band's metrics. Split from app/(pages)/events/[id]/alliances/[unionId]/page.tsx for its size.
import type { Dictionary } from "@/lib/copy";
import type { AllianceRow, HistoryRow, RosterChange } from "@/lib/queries";
import type { MemberShare } from "@/lib/queries/rosters";

import { inEventMarked } from "./AcrossEvents";
import { markOf } from "./event-rows";
import type { StatMetric } from "./StatTable";

function totalsMetric(
  label: string,
  before: number | null | undefined,
  after: number | null | undefined,
  canDelta: boolean,
  change?: RosterChange,
  share?: (c: RosterChange) => MemberShare,
): StatMetric {
  const [b, a] = [before ?? null, after ?? null];
  const delta = canDelta && a !== null && b !== null ? a - b : null;
  return { label, value: a ?? b, delta, base: b, ...(share && markOf(delta, change, share)) };
}

/** The page shows a `*`: on the summary, or on a change inside an event under Across events. */
export const showsMemberMark = (metrics: StatMetric[], history: HistoryRow[]) =>
  metrics.some((m) => m.memberMark || m.split) || inEventMarked(history);

/** `change`: the alliance's roster change from Start to End (undefined when the rosters cannot be compared). */
export function totalsMetrics(
  { before, after }: { before: AllianceRow | null; after: AllianceRow | null },
  canDelta: boolean,
  change: RosterChange | undefined,
  copy: Dictionary,
): StatMetric[] {
  const l = copy.ledger;
  return [
    totalsMetric(l.might, before?.totalPower, after?.totalPower, canDelta, change, (c) => c.power),
    totalsMetric(l.kills, before?.totalKills, after?.totalKills, canDelta, change, (c) => c.kills),
    totalsMetric(l.members, before?.memberCount, after?.memberCount, canDelta),
  ];
}

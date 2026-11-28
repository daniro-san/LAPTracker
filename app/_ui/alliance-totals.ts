// The alliance page's totals (plan Phase 5c): might, kills and members, Before to After, as the summary
// band's metrics. Split from app/(pages)/events/[id]/alliances/[unionId]/page.tsx for its size.
import { comparable } from "@/lib/compute";
import type { Dictionary } from "@/lib/copy";
import type { AllianceRow, HistoryRow, RosterChange } from "@/lib/queries";
import type { MemberShare } from "@/lib/queries/rosters";

import { inEventMarked } from "./AcrossEvents";
import { markOf } from "./event-rows";
import type { StatMetric } from "./StatTable";

/** `from`: the figure the change is measured from, the Start's unless the event has several windows (D160). */
function totalsMetric(
  label: string,
  [before, from]: [number | null | undefined, number | null | undefined],
  after: number | null | undefined,
  canDelta: boolean,
  change?: RosterChange,
  share?: (c: RosterChange) => MemberShare,
): StatMetric {
  const [b, a] = [before ?? null, after ?? null];
  const f = from ?? null;
  const delta = canDelta && a !== null && f !== null ? a - f : null;
  return { label, value: a ?? b, delta, base: b, ...(share && markOf(delta, change, share)) };
}

/** Whether the page shows a change: both sides usable and, with several windows (D160), the windowed Start
 * too, which is stale when one window's rows are. */
export const canChange = (d: {
  before: AllianceRow | null;
  after: AllianceRow | null;
  changeFrom?: AllianceRow;
}) => comparable(d.before, d.after) && (d.changeFrom === undefined || d.changeFrom.isFresh);

/** The page shows a `*`: on the summary, or on a change inside an event under Across events. */
export const showsMemberMark = (metrics: StatMetric[], history: HistoryRow[]) =>
  metrics.some((m) => m.memberMark || m.split) || inEventMarked(history);

/** `change`: the alliance's roster change from Start to End (undefined when the rosters cannot be compared).
 * `changeFrom`: with several windows (D160), the Start Might and Kills are changed from, so each change is
 * the sum of the windows' changes; Members stay Start to End. */
export function totalsMetrics(
  {
    before,
    after,
    changeFrom,
  }: { before: AllianceRow | null; after: AllianceRow | null; changeFrom?: AllianceRow },
  canDelta: boolean,
  change: RosterChange | undefined,
  copy: Dictionary,
): StatMetric[] {
  const l = copy.ledger;
  const from = changeFrom ?? before;
  return [
    totalsMetric(
      l.might,
      [before?.totalPower, from?.totalPower],
      after?.totalPower,
      canDelta,
      change,
      (c) => c.power,
    ),
    totalsMetric(
      l.kills,
      [before?.totalKills, from?.totalKills],
      after?.totalKills,
      canDelta,
      change,
      (c) => c.kills,
    ),
    totalsMetric(
      l.members,
      [before?.memberCount, before?.memberCount],
      after?.memberCount,
      canDelta,
    ),
  ];
}

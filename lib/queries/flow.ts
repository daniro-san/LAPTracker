// Member flow between tracked alliances (D89, #275): which alliance each member was in on two days, from
// the usable daily rosters of those days (D60; event rosters are not counted), counted per source and
// destination. Fields read: an alliance's tag and name and each roster's uids and read time. No member name,
// might, kills or blocked key is selected, and only counts leave this file: cells under FLOW_MIN are dropped here,
// and every total and the order of the rows are made of the cells kept, so no hidden move can be subtracted out.
import { and, desc, gte, inArray } from "drizzle-orm";

import { ALLIANCES } from "../../config/alliances";
import type { Db } from "../db";
import {
  activityOrder,
  buildFlow,
  placeMembers,
  summarise,
  visibleCells,
  type FlowCell,
  type FlowSummary,
} from "../flow";
import { dailyRosters } from "../schema";
import { dailyFit } from "./history-readings";

/** The choices of days reach back this many days. */
export const FLOW_DAYS = 90;
/** The default start is the read this many days before the newest one. */
export const FLOW_DEFAULT_SPAN = 7;

const TRACKED = ALLIANCES.map((a) => a.unionId);
const DAY_MS = 86_400_000;

export interface FlowAlliance {
  unionId: number;
  tag: string | null;
  name: string | null;
}

export interface FlowResult extends FlowSummary {
  /** The counted alliances, the ones with the most moves shown first. */
  alliances: FlowAlliance[];
  /** Only the cells of at least FLOW_MIN members; the stayed cells have `from === to`. */
  cells: FlowCell[];
  /** Tracked alliances with a usable read on only one of the two days: not counted. */
  notCounted: FlowAlliance[];
}

export interface FlowPage {
  /** The days with a usable daily read, newest first: the choices of both selects. */
  days: string[];
  /** The period shown: the one asked for, else the default; null when there are fewer than two days. */
  period: { from: string; to: string } | null;
  /** Null when the period is not two different days in order. */
  flow: FlowResult | null;
}

/** The newest day, and the latest day on or before FLOW_DEFAULT_SPAN days earlier, else the oldest day. */
export function defaultPeriod(days: readonly string[]) {
  const to = days[0];
  const oldest = days[days.length - 1];
  if (to === undefined || oldest === undefined || to === oldest) return null;
  const target = new Date(Date.parse(`${to}T00:00:00Z`) - FLOW_DEFAULT_SPAN * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return { from: days.find((d) => d <= target) ?? oldest, to };
}

export async function flowPage(
  db: Db,
  now: Date,
  period: { from: string; to: string } | null,
  tracked: readonly number[] = TRACKED,
): Promise<FlowPage> {
  const since = new Date(now.getTime() - FLOW_DAYS * DAY_MS).toISOString().slice(0, 10);
  const dayRows = await db
    .selectDistinct({ day: dailyRosters.readDay })
    .from(dailyRosters)
    .where(
      and(inArray(dailyRosters.unionId, [...tracked]), dailyFit, gte(dailyRosters.readDay, since)),
    )
    .orderBy(desc(dailyRosters.readDay));
  const days = dayRows.map((r) => r.day);
  const chosen = period ?? defaultPeriod(days);
  if (!chosen || chosen.from >= chosen.to) return { days, period: chosen, flow: null };
  const rows = await db
    .select({
      day: dailyRosters.readDay,
      unionId: dailyRosters.unionId,
      tag: dailyRosters.tag,
      name: dailyRosters.name,
      at: dailyRosters.sourceUpdatedAt,
      uids: dailyRosters.memberUids,
    })
    .from(dailyRosters)
    .where(
      and(
        inArray(dailyRosters.unionId, [...tracked]),
        inArray(dailyRosters.readDay, [chosen.from, chosen.to]),
        dailyFit,
      ),
    );
  const onDay = (day: string) => rows.filter((r) => r.day === day);
  const [startRows, endRows] = [onDay(chosen.from), onDay(chosen.to)];
  const read = (rs: typeof rows) => new Set(rs.map((r) => r.unionId));
  const [atStart, atEnd] = [read(startRows), read(endRows)];
  const ids = tracked.filter((id) => atStart.has(id) && atEnd.has(id));
  const placement = (rs: typeof rows) =>
    placeMembers(rs.map((r) => ({ unionId: r.unionId, at: r.at?.getTime() ?? 0, uids: r.uids })));
  const cells = visibleCells(buildFlow(placement(startRows), placement(endRows), ids));
  const label = (id: number): FlowAlliance => {
    // The end day's tag and name, else the start day's.
    const r = endRows.find((x) => x.unionId === id) ?? startRows.find((x) => x.unionId === id);
    return { unionId: id, tag: r?.tag ?? null, name: r?.name ?? null };
  };
  const alliances = activityOrder(cells, ids).map(label);
  const notCounted = tracked
    .filter((id) => !ids.includes(id) && (atStart.has(id) || atEnd.has(id)))
    .map(label);
  return {
    days,
    period: chosen,
    flow: { ...summarise(cells), alliances, cells, notCounted },
  };
}
